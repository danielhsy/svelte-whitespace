// The markup printer (SPEC §8). Elements, blocks, comments and the top level are printed here;
// everything else (attributes, expressions, <script>, <style>) is handed to prettier-plugin-svelte.
// Children are printed as a `fill`, like Prettier's JSX printer, with each separator chosen from
// the gap's behaviour by the table in SPEC §8.3.

import { doc, type AstPath, type Doc, type Printer } from 'prettier';
import {
	analyse,
	defaultClassification,
	strictest,
	type Behaviour,
	type Gap,
	type ResolvedOptions
} from '../rule/index.js';
import {
	ELEMENT_TYPES,
	blockClosing,
	isASTNode,
	isBracketSameLine,
	isEmptyTextNode,
	isIgnoreEndDirective,
	isNodeSupportedLanguage,
	isSelfClosingTag,
	prepareTopLevelChildren,
	printAwaitBlock,
	printBlockOpening,
	printCommentNode,
	printIgnored,
	printOpeningTagStart,
	printPre,
	printRaw,
	printSelfClosingTag,
	printTopLevelParts,
	type Node,
	type PrintFn,
	type SvelteOptions,
	type TopLevelState
} from './derived.js';
import { upstream } from './upstream.js';

const { breakParent, dedent, fill, group, hardline, ifBreak, indent, line, softline } =
	doc.builders;

interface FileState extends TopLevelState {
	options: ResolvedOptions;
	/** Gaps by start position. Each position has at most one gap the printer needs. */
	gaps: Map<number, Gap>;
	/**
	 * Gaps by end position. The legacy AST leaves out whitespace just inside a block, so a
	 * block's start edge is found by where its gap ends: at the first child.
	 */
	gapsByEnd: Map<number, Gap>;
}

interface PrintArgs {
	/** Leave off the final `>` of the closing tag: the parent prints it after a line break. */
	omitClosingBracket?: boolean;
}

/** Runs the rule over the file once, and keeps the result on the root for the printer. */
export function attachState(root: Node, text: string, options: ResolvedOptions): void {
	const gaps = new Map<number, Gap>();
	const gapsByEnd = new Map<number, Gap>();
	for (const gap of analyse(text, options)) {
		if (!gaps.has(gap.start)) gaps.set(gap.start, gap);
		if (!gapsByEnd.has(gap.end)) gapsByEnd.set(gap.end, gap);
	}
	const state: FileState = {
		options,
		gaps,
		gapsByEnd,
		ignoreNext: false,
		ignoreRange: false,
		svelteOptionsDoc: undefined
	};
	// Not enumerable: upstream walks every enumerable key of every node to find expressions.
	Object.defineProperty(root, '__svelteWhitespace', { value: state, enumerable: false });
}

function stateOf(path: AstPath<Node>): FileState {
	return (path.stack[0] as Node).__svelteWhitespace;
}

const upstreamPrint = upstream.printers['svelte-ast'].print;

export const print: Printer<Node>['print'] = (path, prettierOptions, print, args) => {
	const options = prettierOptions as SvelteOptions;
	const printFn = print as unknown as PrintFn;
	const node = path.node;
	if (!node) return '';
	const state = stateOf(path);
	if (isASTNode(node)) return printTopLevelParts(node, options, path, printFn, state);

	if (
		(state.ignoreNext || (state.ignoreRange && !isIgnoreEndDirective(node))) &&
		!isEmptyTextNode(node)
	) {
		state.ignoreNext = false;
		return printIgnored(node, options);
	}

	if (ELEMENT_TYPES.has(node.type)) {
		return printElement(path, options, printFn, state, (args ?? {}) as PrintArgs);
	}
	switch (node.type) {
		case 'Fragment':
			return printTopLevelMarkup(path, options, printFn, state);
		case 'IfBlock':
		case 'EachBlock':
		case 'KeyBlock':
		case 'SnippetBlock':
			return group([
				printBlockOpening(path, options, printFn),
				printBlockBody(path, options, printFn, state),
				node.else ? printFn('else') : '',
				blockClosing[node.type]!
			]);
		case 'ElseBlock':
			return printElseBlock(path, options, printFn, state);
		case 'AwaitBlock':
			return printAwaitBlock(path, options, printFn, (part) =>
				path.call(() => printBlockBody(path, options, printFn, state), part)
			);
		case 'PendingBlock':
		case 'ThenBlock':
		case 'CatchBlock':
			return printBlockBody(path, options, printFn, state);
		case 'Comment':
			return printCommentNode(path, state);
		default:
			return upstreamPrint(path, options, print, args);
	}
};

function printElseBlock(
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn,
	state: FileState
): Doc {
	const node = path.node;
	const parent = path.getParentNode() as Node;
	const elseIf = node.children.length === 1 && node.children[0].type === 'IfBlock';
	if (elseIf && parent.type !== 'EachBlock') {
		const ifNode = node.children[0] as Node;
		return path.call(
			() => [
				'{:else if ',
				print('expression'),
				'}',
				printBlockBody(path, options, print, state),
				ifNode.else ? print('else') : ''
			],
			'children',
			0
		);
	}
	return ['{:else}', printBlockBody(path, options, print, state)];
}

function printTopLevelMarkup(
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn,
	state: FileState
): Doc {
	// Upstream modifies the children in place too, so that path.call(…, 'children', i) agrees.
	path.node.children = prepareTopLevelChildren(path, options, print, state);
	const children = printChildren(path, options, print, state, 'root');
	if (!children) return '';
	return group([children.start, children.middle, children.end, hardline]);
}

function printBlockBody(
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn,
	state: FileState
): Doc {
	const children = printChildren(path, options, print, state, 'block');
	if (!children) return '';
	return [indent([children.start, children.middle]), children.end];
}

function printElement(
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn,
	state: FileState,
	args: PrintArgs
): Doc {
	const node = path.node;
	const closing = [`</${node.name}`, args.omitClosingBracket ? '' : '>'];

	if (node.name === 'template' && !isNodeSupportedLanguage(node)) {
		return group([
			printOpeningTagStart(node, path, options, print, ''),
			'>',
			group([hardline, printRaw(node, options.originalText, true), hardline]),
			...closing
		]);
	}

	if (isRawContent(path)) {
		return group([
			printOpeningTagStart(node, path, options, print, ''),
			'>',
			printPre(node, options.originalText, path, print),
			...closing
		]);
	}

	const isEmpty = isEmptyElement(node, state);
	if (isSelfClosingTag(node, options, isEmpty)) {
		return printSelfClosingTag(node, path, options, print);
	}

	const openingTag = [
		printOpeningTagStart(
			node,
			path,
			options,
			print,
			isBracketSameLine(options) ? '' : dedent(softline)
		),
		'>'
	];
	const children = isEmpty ? null : printChildren(path, options, print, state, 'element');
	if (!children) return group([...openingTag, ...closing]);
	return group([
		...openingTag,
		indent([children.start, children.middle]),
		children.end,
		...closing,
		children.forceBreak ? breakParent : ''
	]);
}

/** `<pre>` and `<textarea>` contents, and everything inside them, are printed as written. */
function isRawContent(path: AstPath<Node>): boolean {
	return path.stack.some(
		(n) =>
			!!n &&
			typeof n === 'object' &&
			(n as Node).type === 'Element' &&
			['pre', 'textarea'].includes((n as Node).name?.toLowerCase())
	);
}

// --- Children ---------------------------------------------------------------------------------

type Token =
	| { type: 'word'; text: string; start: number; end: number }
	| { type: 'node'; index: number; node: Node; start: number; end: number }
	| { type: 'gap'; gap: Gap | undefined; start: number }
	/** A `{' '}` that has been folded into the separator around it. */
	| { type: 'space'; behaviour: Behaviour };

interface Separator {
	doc: Doc;
	/** For merging adjacent gaps: the one with more line breaks wins. */
	rank: number;
	/** The item before must leave off its closing `>`, which this separator prints. */
	hug?: boolean;
}

type Context = 'root' | 'element' | 'block';

interface PrintedChildren {
	start: Doc;
	middle: Doc;
	end: Doc;
	forceBreak: boolean;
}

function printChildren(
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn,
	state: FileState,
	context: Context
): PrintedChildren | null {
	const text = options.originalText;
	const tokens = tokenise(path.node.children as Node[], text, state);
	if (tokens.length === 0) return null;

	// Edges: make sure the sequence starts and ends with a gap.
	const first = tokens[0]!;
	if (first.type !== 'gap') {
		const start = positionOf(first, 'start');
		tokens.unshift({ type: 'gap', gap: state.gapsByEnd.get(start), start });
	}
	const last = tokens[tokens.length - 1]!;
	if (last.type !== 'gap') tokens.push(gapToken(state, positionOf(last, 'end')));

	// Alternate items and separators, merging adjacent gaps.
	const items: Exclude<Token, { type: 'gap' } | { type: 'space' }>[] = [];
	const separators: Separator[] = [];
	let pending: Separator | null = null;
	const lastItem = tokens.findLastIndex((token) => token.type === 'word' || token.type === 'node');
	tokens.forEach((token, i) => {
		const position: 'start' | 'middle' | 'end' =
			items.length === 0 ? 'start' : i > lastItem ? 'end' : 'middle';
		if (token.type === 'gap' || token.type === 'space') {
			const separator =
				token.type === 'space'
					? spaceSeparator(token.behaviour, position, context, options)
					: gapSeparator(token.gap, text, position, context, options);
			pending = pending && pending.rank >= separator.rank ? pending : separator;
			return;
		}
		if (pending || items.length > 0) separators.push(pending ?? empty);
		pending = null;
		items.push(token);
	});
	separators.push(pending ?? empty);

	// separators[0] is the start edge, separators[items.length] the end edge.
	if (items.length === 0) {
		const only = separators[0]!;
		return {
			start: only.rank >= 2 ? spaceDoc(options) : '',
			middle: '',
			end: '',
			forceBreak: false
		};
	}

	// Hugging needs the item before to end in a closing tag whose `>` can move.
	items.forEach((item, i) => {
		if (separators[i + 1]?.hug && !canHug(item, options, state)) separators[i + 1] = empty;
	});

	const parts: Doc[] = [];
	items.forEach((item, i) => {
		const hugsNext = i < items.length - 1 && separators[i + 1]!.hug === true;
		parts.push(printItem(item, hugsNext, path, print));
		if (i < items.length - 1) parts.push(separators[i + 1]!.doc);
	});

	const blockChildren = items.filter(
		(item) => item.type === 'node' && classify(item.node, state.options) === 'block'
	).length;
	return {
		start: separators[0]!.doc,
		middle: fill(parts),
		end: separators[items.length]!.doc,
		forceBreak: context === 'element' && blockChildren > 0 && items.length > 1
	};
}

const empty: Separator = { doc: '', rank: 0 };

function tokenise(children: Node[], text: string, state: FileState): Token[] {
	const tokens: Token[] = [];
	const pushItem = (token: Extract<Token, { type: 'word' | 'node' }>) => {
		const previous = tokens[tokens.length - 1];
		// Two items touching: the empty gap between them.
		if (previous && previous.type !== 'gap' && previous.type !== 'space') {
			tokens.push(gapToken(state, token.start));
		}
		tokens.push(token);
	};

	children.forEach((child, index) => {
		if (child.type !== 'Text') {
			pushItem({ type: 'node', index, node: child, start: child.start, end: child.end });
			return;
		}
		if (state.ignoreNext && !isEmptyTextNode(child)) {
			state.ignoreNext = false;
			pushItem({
				type: 'word',
				text: text.slice(child.start, child.end),
				start: child.start,
				end: child.end
			});
			return;
		}
		const raw = text.slice(child.start, child.end);
		for (const match of raw.matchAll(/[ \t\r\n]+|[^ \t\r\n]+/g)) {
			const start = child.start + match.index;
			if (/^[ \t\r\n]/.test(match[0])) tokens.push(gapToken(state, start));
			else pushItem({ type: 'word', text: match[0], start, end: start + match[0].length });
		}
	});

	return foldExplicitSpaces(tokens);
}

function gapToken(state: FileState, start: number): Token {
	return { type: 'gap', gap: state.gaps.get(start), start };
}

function positionOf(token: Token, side: 'start' | 'end'): number {
	return token.type === 'word' || token.type === 'node' ? token[side] : 0;
}

/**
 * A hand-written `{' '}` between two gaps that render nothing is the only space there, so it
 * becomes an ordinary meaningful space: printed as a plain space mid-line, or as `{' '}` before a
 * line break (SPEC §8.3). If the two sides would drop a plain space (`never`), it's left alone.
 */
function foldExplicitSpaces(tokens: Token[]): Token[] {
	const result: Token[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const before = tokens[i - 1];
		const token = tokens[i]!;
		const after = tokens[i + 1];
		if (
			token.type === 'node' &&
			isExplicitSpace(token.node) &&
			before?.type === 'gap' &&
			after?.type === 'gap' &&
			before.gap?.renders === '' &&
			after.gap?.renders === '' &&
			before.gap.left !== 'edges' &&
			after.gap.right !== 'edges'
		) {
			const sides = [before.gap.leftBehaviour, after.gap.rightBehaviour];
			const behaviour = sides.reduce<Behaviour | null>(
				(a, b) => (a && b ? strictest(a, b) : (a ?? b)),
				null
			);
			if (behaviour !== 'never') {
				result.pop();
				result.push({ type: 'space', behaviour: behaviour ?? 'always' });
				i++;
				continue;
			}
		}
		result.push(token);
	}
	return result;
}

function isExplicitSpace(node: Node): boolean {
	const expression = node.type === 'MustacheTag' ? node.expression : null;
	return expression?.type === 'Literal' && expression.value === ' ';
}

function spaceDoc(options: SvelteOptions): Doc {
	return options.singleQuote ? "{' '}" : '{" "}';
}

/** A meaningful space that a line break would drop: `{' '}` before the break, a space if not. */
function jsxSpace(position: 'start' | 'middle' | 'end', options: SvelteOptions): Doc {
	const space = spaceDoc(options);
	return position === 'start' ? ifBreak([softline, space], ' ') : ifBreak([space, softline], ' ');
}

function spaceSeparator(
	behaviour: Behaviour,
	position: 'start' | 'middle' | 'end',
	context: Context,
	options: SvelteOptions
): Separator {
	if (behaviour === 'always') return { doc: line, rank: 2 };
	if (context === 'root' && position !== 'middle') return { doc: spaceDoc(options), rank: 2 };
	return { doc: jsxSpace(position, options), rank: 2 };
}

const LINE_BREAKS = /\r\n|\r|\n/g;

function gapSeparator(
	gap: Gap | undefined,
	text: string,
	position: 'start' | 'middle' | 'end',
	context: Context,
	options: SvelteOptions
): Separator {
	// No gap known here: whitespace before a cut-out top-level <script> or <style>.
	if (!gap) return context === 'root' ? { doc: hardline, rank: 3 } : empty;

	const isEdge = position !== 'middle';
	const atRootEdge = context === 'root' && isEdge;
	const breaks = (text.slice(gap.start, gap.end).match(LINE_BREAKS) ?? []).length;
	const hasWord = gap.left === 'word' || gap.right === 'word';
	// Keep the author's line breaks at edges and between tags, as prettier-plugin-svelte does;
	// text around words is reflowed.
	const keepBreak = breaks > 0 && (isEdge || !hasWord);
	const lineBreak: Separator =
		breaks > 1 && !isEdge ? { doc: [hardline, hardline], rank: 4 } : { doc: hardline, rank: 3 };

	if (gap.behaviour === null) return { doc: line, rank: 2 };

	if (gap.renders === ' ') {
		// Svelte trims the file's edges, so a space kept there must be explicit.
		if (atRootEdge) return { doc: spaceDoc(options), rank: 2 };
		if (gap.behaviour === 'always') return keepBreak ? lineBreak : { doc: line, rank: 2 };
		return spaceSeparator('same-line', position, context, options);
	}

	if (atRootEdge) return empty;
	if (gap.start === gap.end && gap.behaviour === 'always') {
		// Two things touch, and a line break here would add a space: break inside the tag instead.
		return position === 'middle' ? { doc: [softline, '>'], rank: 1, hug: true } : empty;
	}
	return keepBreak ? lineBreak : { doc: softline, rank: 1 };
}

function canHug(
	item: Extract<Token, { type: 'word' | 'node' }>,
	options: SvelteOptions,
	state: FileState
): boolean {
	return (
		item.type === 'node' &&
		ELEMENT_TYPES.has(item.node.type) &&
		!isSelfClosingTag(item.node, options, isEmptyElement(item.node, state))
	);
}

/** No children, or only whitespace that renders nothing. */
function isEmptyElement(node: Node, state: FileState): boolean {
	return (node.children as Node[]).every(
		(child) => isEmptyTextNode(child) && state.gaps.get(child.start)?.renders !== ' '
	);
}

function printItem(
	item: Extract<Token, { type: 'word' | 'node' }>,
	omitClosingBracket: boolean,
	path: AstPath<Node>,
	print: PrintFn
): Doc {
	if (item.type === 'word') return item.text;
	return print(
		['children', item.index],
		omitClosingBracket ? { omitClosingBracket: true } : undefined
	);
}

function classify(node: Node, options: ResolvedOptions): 'inline' | 'block' | null {
	if (node.type === 'Element') {
		return options.classify.elements.get(node.name) ?? defaultClassification(node.name);
	}
	if (node.type === 'InlineComponent') return options.classify.components.get(node.name) ?? null;
	return null;
}
