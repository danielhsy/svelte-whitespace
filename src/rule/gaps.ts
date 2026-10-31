// Finds every gap in a template and decides what it renders (SPEC §2–§3). Both the preprocessor
// and the Prettier plugin work from this analysis.

import { parse, type AST } from 'svelte/compiler';
import { defaultClassification } from './display.js';
import { parseDirective, type Directive } from './directives.js';
import {
	PRESETS,
	strictest,
	type Behaviour,
	type Kind,
	type ResolvedOptions,
	type Spaces
} from './options.js';

/** A side of a gap: a kind, or a word of text (which has no behaviour of its own). */
export type Side = Kind | 'word';

export interface Gap {
	/** The whitespace's range in the source. Equal for an empty gap, where two things touch. */
	start: number;
	end: number;
	left: Side;
	right: Side;
	/** Null for a gap between two words, which always renders one space. */
	behaviour: Behaviour | null;
	/** Each side's own behaviour (null for a word), before combining. */
	leftBehaviour: Behaviour | null;
	rightBehaviour: Behaviour | null;
	/** What the gap renders: one space or nothing. */
	renders: ' ' | '';
	/** True if the gap is in a region left to Svelte (the `svelte` preset without overrides). */
	passthrough: boolean;
	/**
	 * True if Svelte trims this gap as part of an edge: it touches the start or end of its
	 * content, directly or across nodes Svelte drops. A space kept here must be written `{' '}`.
	 */
	edge: boolean;
}

/** A gap while its fragment is analysed, with what Svelte drops on either side. */
interface Entry {
	gap: Gap;
	settings: Settings;
	hasBreak: boolean;
	/** Whether the node on each side is one Svelte drops before trimming (see DROPPED). */
	leftDropped: boolean;
	rightDropped: boolean;
}

/** The settings in force for one content area. */
interface Settings {
	spaces: Spaces;
	passthrough: boolean;
}

const RAW_ELEMENTS = new Set(['pre', 'textarea', 'script', 'style']);

/**
 * Nodes Svelte takes out of a fragment before it trims and collapses whitespace (`clean_nodes`
 * in the compiler): comments, and tags it hoists. The whitespace on either side then meets.
 */
const DROPPED = new Set([
	'Comment',
	'ConstTag',
	'DebugTag',
	'SvelteHead',
	'SvelteWindow',
	'SvelteBody',
	'SvelteDocument',
	'TitleElement',
	'SnippetBlock'
]);
const WHITESPACE = /[ \t\r\n]+/g;
const LINE_BREAK = /[\r\n]/;

export function analyse(source: string, options: ResolvedOptions): Gap[] {
	const root = parse(blankScriptsAndStyles(source), { modern: true });
	const gaps: Gap[] = [];
	let entries: Entry[] = [];

	const kindOf = (node: AST.TemplateNode): Kind => {
		switch (node.type) {
			case 'RegularElement':
				return options.classify.elements.get(node.name) ?? defaultClassification(node.name);
			case 'Component':
				return options.classify.components.get(node.name) ?? 'components';
			case 'TitleElement':
			case 'SvelteHead':
			case 'SvelteWindow':
			case 'SvelteBody':
			case 'SvelteDocument':
			case 'SvelteOptions':
				return 'block';
			case 'ExpressionTag':
			case 'ConstTag':
			case 'DebugTag':
				return 'expressions';
			case 'IfBlock':
			case 'EachBlock':
			case 'AwaitBlock':
			case 'KeyBlock':
			case 'SnippetBlock':
				return 'logic';
			case 'Comment':
				return 'comments';
			case 'Text':
				// Two adjacent text nodes: something between them (`<svelte:options>`, `<script>`
				// or `<style>`) was taken out of the fragment by the parser.
				return 'block';
			default:
				// Components, `<svelte:element>`, `<svelte:boundary>`, `{@render}`, `{@html}` and
				// anything newer: markup whose display isn't known.
				return 'components';
		}
	};

	const behaviourOf = (side: Side, settings: Settings): Behaviour | null =>
		side === 'word' ? null : settings.spaces[side];

	const addGap = (
		start: number,
		end: number,
		left: Side,
		right: Side,
		settings: Settings,
		leftDropped = false,
		rightDropped = false
	) => {
		const leftBehaviour = behaviourOf(left, settings);
		const rightBehaviour = behaviourOf(right, settings);
		const sides = [leftBehaviour, rightBehaviour].filter(
			(behaviour): behaviour is Behaviour => behaviour !== null
		);
		const behaviour = sides.length ? sides.reduce(strictest) : null;
		const hasBreak = LINE_BREAK.test(source.slice(start, end));
		entries.push({
			gap: {
				start,
				end,
				left,
				right,
				behaviour,
				leftBehaviour,
				rightBehaviour,
				renders: keeps(start, end, behaviour, hasBreak) ? ' ' : '',
				passthrough: settings.passthrough,
				edge: left === 'edges' || right === 'edges'
			},
			settings,
			hasBreak,
			leftDropped,
			rightDropped
		});
	};

	const visitText = (
		text: AST.Text,
		left: Side,
		right: Side,
		settings: Settings,
		leftDropped: boolean,
		rightDropped: boolean
	) => {
		const raw = source.slice(text.start, text.end);
		// Text touching its neighbours with no whitespace still makes a gap, an empty one.
		if (!/^[ \t\r\n]/.test(raw)) {
			addGap(text.start, text.start, left, 'word', settings, leftDropped);
		}
		if (!/[ \t\r\n]$/.test(raw)) {
			addGap(text.end, text.end, 'word', right, settings, false, rightDropped);
		}
		for (const match of raw.matchAll(WHITESPACE)) {
			const start = text.start + match.index;
			const end = start + match[0].length;
			addGap(
				start,
				end,
				start === text.start ? left : 'word',
				end === text.end ? right : 'word',
				settings,
				start === text.start && leftDropped,
				end === text.end && rightDropped
			);
		}
	};

	const visitFragment = (fragment: AST.Fragment, settings: Settings) => {
		const { nodes } = fragment;
		const outer = entries;
		entries = [];
		let pending: Directive | null = null;

		nodes.forEach((node, i) => {
			// Empty gaps where a non-text node touches an edge or another non-text node.
			if (node.type !== 'Text') {
				const previous = nodes[i - 1];
				if (!previous) {
					addGap(node.start, node.start, 'edges', kindOf(node), settings, false, dropped(node));
				} else if (previous.type !== 'Text') {
					addGap(
						node.start,
						node.start,
						kindOf(previous),
						kindOf(node),
						settings,
						dropped(previous),
						dropped(node)
					);
				}
				if (i === nodes.length - 1) {
					addGap(node.end, node.end, kindOf(node), 'edges', settings, dropped(node));
				}
			}

			if (node.type === 'Text') {
				const previous = nodes[i - 1];
				const next = nodes[i + 1];
				visitText(
					node,
					previous ? kindOf(previous) : 'edges',
					next ? kindOf(next) : 'edges',
					settings,
					// Two adjacent text nodes: what was between them has been taken out.
					!!previous && (dropped(previous) || previous.type === 'Text'),
					!!next && (dropped(next) || next.type === 'Text')
				);
				return;
			}
			if (node.type === 'Comment') {
				const directive = parseDirective(node.data);
				if (directive?.scope === 'node') pending = directive;
				return;
			}

			const inner = pending ? settingsFrom(pending) : settings;
			pending = null;
			if (node.type === 'RegularElement' && RAW_ELEMENTS.has(node.name.toLowerCase())) return;
			for (const child of childFragments(node)) visitFragment(child, inner);
		});

		gaps.push(...joinAcrossDropped(entries));
		entries = outer;
	};

	const fileDirectives = findFileDirectives(root.fragment);
	if (fileDirectives.length > 1) {
		throw new Error('svelte-whitespace: more than one svelte-whitespace-file directive');
	}
	const [fileDirective] = fileDirectives;
	visitFragment(
		root.fragment,
		fileDirective
			? settingsFrom(fileDirective)
			: {
					spaces: options.spaces,
					passthrough: options.preset === 'svelte' && isPreset(options.spaces, 'svelte')
				}
	);
	return gaps;
}

const dropped = (node: AST.TemplateNode): boolean => DROPPED.has(node.type);

/** SPEC §3.1: no behaviour adds a space where the source has none. */
function keeps(start: number, end: number, behaviour: Behaviour | null, hasBreak: boolean) {
	return (
		start < end &&
		(behaviour === null || behaviour === 'always' || (behaviour === 'same-line' && !hasBreak))
	);
}

/**
 * Svelte drops comments and hoisted tags before trimming, so the gaps on either side of them
 * meet and render as one: a single space if any of them renders one, and nothing at an edge.
 * Gaps in a run like that which reaches an edge are also subject to the `edges` behaviour, and at
 * most one of them renders the space.
 */
function joinAcrossDropped(entries: Entry[]): Gap[] {
	entries.sort((a, b) => a.gap.start - b.gap.start || a.gap.end - b.gap.end);
	for (let i = 0; i < entries.length; ) {
		let j = i + 1;
		while (j < entries.length && entries[j - 1]!.rightDropped && entries[j]!.leftDropped) j++;
		const run = entries.slice(i, j);
		i = j;
		if (run.length === 1) continue;

		const edge = run[0]!.gap.left === 'edges' || run.at(-1)!.gap.right === 'edges';
		for (const { gap, settings, hasBreak } of run) {
			gap.edge = edge;
			if (!edge) continue;
			const edges = settings.spaces.edges;
			gap.behaviour = gap.behaviour === null ? edges : strictest(gap.behaviour, edges);
			gap.renders = keeps(gap.start, gap.end, gap.behaviour, hasBreak) ? ' ' : '';
		}
		const kept = run.find(({ gap }) => gap.renders === ' ');
		for (const { gap } of run) if (gap !== kept?.gap) gap.renders = '';
	}
	return entries.map(({ gap }) => gap);
}

function settingsFrom(directive: Directive): Settings {
	return {
		spaces: { ...PRESETS[directive.preset], ...directive.spaces },
		passthrough: directive.preset === 'svelte' && Object.keys(directive.spaces).length === 0
	};
}

function isPreset(spaces: Spaces, preset: keyof typeof PRESETS): boolean {
	return Object.entries(PRESETS[preset]).every(([kind, b]) => spaces[kind as Kind] === b);
}

/** The content areas directly inside a node: an element's children, a block's bodies. */
function childFragments(node: AST.TemplateNode): AST.Fragment[] {
	return Object.values(node).filter(
		(value): value is AST.Fragment =>
			typeof value === 'object' && value !== null && value.type === 'Fragment'
	);
}

function findFileDirectives(fragment: AST.Fragment): Directive[] {
	const found: Directive[] = [];
	for (const node of fragment.nodes) {
		if (node.type === 'Comment') {
			const directive = parseDirective(node.data);
			if (directive?.scope === 'file') found.push(directive);
		}
		for (const child of childFragments(node)) found.push(...findFileDirectives(child));
	}
	return found;
}

/**
 * Replaces the contents of `<script>` and `<style>` tags with spaces before parsing, keeping
 * every position the same. The markup preprocessor can run before TypeScript or a CSS
 * preprocessor, so their contents may not be something Svelte's parser accepts.
 */
export function blankScriptsAndStyles(source: string): string {
	return source.replace(
		/(<(script|style)\b[^>]*>)([^]*?)(<\/\2\s*>)/gi,
		(_, open: string, _name, body: string, close: string) =>
			open + body.replace(/[^\r\n]/g, ' ') + close
	);
}
