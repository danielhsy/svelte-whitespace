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
}

/** The settings in force for one content area. */
interface Settings {
	spaces: Spaces;
	passthrough: boolean;
}

const RAW_ELEMENTS = new Set(['pre', 'textarea', 'script', 'style']);
const WHITESPACE = /[ \t\r\n]+/g;
const LINE_BREAK = /[\r\n]/;

export function analyse(source: string, options: ResolvedOptions): Gap[] {
	const root = parse(blankScriptsAndStyles(source), { modern: true });
	const gaps: Gap[] = [];

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

	const addGap = (start: number, end: number, left: Side, right: Side, settings: Settings) => {
		const leftBehaviour = behaviourOf(left, settings);
		const rightBehaviour = behaviourOf(right, settings);
		const sides = [leftBehaviour, rightBehaviour].filter(
			(behaviour): behaviour is Behaviour => behaviour !== null
		);
		const behaviour = sides.length ? sides.reduce(strictest) : null;
		const hasBreak = LINE_BREAK.test(source.slice(start, end));
		// SPEC §3.1: no behaviour adds a space where the source has none.
		const keeps =
			start < end &&
			(behaviour === null || behaviour === 'always' || (behaviour === 'same-line' && !hasBreak));
		gaps.push({
			start,
			end,
			left,
			right,
			behaviour,
			leftBehaviour,
			rightBehaviour,
			renders: keeps ? ' ' : '',
			passthrough: settings.passthrough
		});
	};

	const visitText = (text: AST.Text, left: Side, right: Side, settings: Settings) => {
		const raw = source.slice(text.start, text.end);
		// Text touching its neighbours with no whitespace still makes a gap, an empty one.
		if (!/^[ \t\r\n]/.test(raw)) addGap(text.start, text.start, left, 'word', settings);
		if (!/[ \t\r\n]$/.test(raw)) addGap(text.end, text.end, 'word', right, settings);
		for (const match of raw.matchAll(WHITESPACE)) {
			const start = text.start + match.index;
			const end = start + match[0].length;
			addGap(
				start,
				end,
				start === text.start ? left : 'word',
				end === text.end ? right : 'word',
				settings
			);
		}
	};

	const visitFragment = (fragment: AST.Fragment, settings: Settings) => {
		const { nodes } = fragment;
		let pending: Directive | null = null;

		nodes.forEach((node, i) => {
			// Empty gaps where a non-text node touches an edge or another non-text node.
			if (node.type !== 'Text') {
				const previous = nodes[i - 1];
				if (!previous) addGap(node.start, node.start, 'edges', kindOf(node), settings);
				else if (previous.type !== 'Text') {
					addGap(node.start, node.start, kindOf(previous), kindOf(node), settings);
				}
				if (i === nodes.length - 1) addGap(node.end, node.end, kindOf(node), 'edges', settings);
			}

			if (node.type === 'Text') {
				const previous = nodes[i - 1];
				const next = nodes[i + 1];
				visitText(
					node,
					previous ? kindOf(previous) : 'edges',
					next ? kindOf(next) : 'edges',
					settings
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
