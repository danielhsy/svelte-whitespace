/*
 * Derived from prettier-plugin-svelte 3.5.2 (src/print/index.ts, src/print/helpers.ts,
 * src/print/node-helpers.ts, src/options.ts, src/lib/elements.ts, src/lib/snipTagContent.ts).
 * Everything here is about tags, attributes, block syntax, comments and the file's top level;
 * nothing decides whitespace between nodes, which is svelte-whitespace's own code in printer.ts.
 *
 * MIT License
 *
 * Copyright (c) 2019 [Contributors](https://github.com/sveltejs/prettier-plugin-svelte/graphs/contributors)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { doc, type AstPath, type Doc, type ParserOptions } from 'prettier';

const { join, line, group, indent, dedent, hardline, literalline } = doc.builders;

/** A node of prettier-plugin-svelte's (legacy) Svelte AST. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Node = { type: string; start: number; end: number; [key: string]: any };

export type PrintFn = (selector?: string | number | (string | number)[], args?: unknown) => Doc;

/** prettier-plugin-svelte's options, as they arrive in a printer. */
export interface SvelteOptions extends ParserOptions {
	svelteSortOrder: string;
	svelteStrictMode: boolean;
	svelteBracketNewLine?: boolean;
	_svelte_is5Plus?: boolean;
}

/** Per-file printing state that upstream keeps in module variables. */
export interface TopLevelState {
	ignoreNext: boolean;
	ignoreRange: boolean;
	svelteOptionsDoc: Doc | undefined;
}

// @see http://xahlee.info/js/html5_non-closing_tag.html
export const selfClosingTags = [
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
];

const unsupportedLanguages = ['coffee', 'coffeescript', 'styl', 'stylus', 'sass'];
const snippedTagContentAttribute = '✂prettier:content✂';

export function isASTNode(n: unknown): boolean {
	return !!n && !!(n as { __isRoot?: boolean }).__isRoot;
}

export function isBracketSameLine(options: SvelteOptions): boolean {
	return options.svelteBracketNewLine != null
		? !options.svelteBracketNewLine
		: options.bracketSameLine != null
			? options.bracketSameLine
			: false;
}

type SortOrderPart = 'scripts' | 'markup' | 'styles' | 'options';

function parseSortOrder(sortOrder = 'options-scripts-markup-styles'): SortOrderPart[] {
	if (sortOrder === 'none') return [];
	const order = sortOrder.split('-') as SortOrderPart[];
	if (!order.includes('options')) {
		throw new Error('svelteSortOrder is missing option `options`');
	}
	return order;
}

export function hasPragma(text: string) {
	return /^\s*<!--\s*@(format|prettier)\W/.test(text);
}

export function getUnencodedText(node: Node): string {
	return node.raw || node.data;
}

export function isEmptyTextNode(node: Node | undefined): boolean {
	return !!node && node.type === 'Text' && /^[\t\n\f\r ]*$/.test(getUnencodedText(node));
}

export function isIgnoreDirective(node: Node | undefined): boolean {
	return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore';
}

export function isIgnoreStartDirective(node: Node | undefined): boolean {
	return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore-start';
}

export function isIgnoreEndDirective(node: Node | undefined): boolean {
	return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore-end';
}

function getSiblings(path: AstPath<Node>): Node[] {
	let parent = path.getParentNode() as Node;
	if (isASTNode(parent)) parent = parent.html;
	return parent?.children ?? [];
}

function getNextNode(path: AstPath<Node>, node: Node = path.node): Node | undefined {
	return getSiblings(path).find((child) => child.start === node.end);
}

function isNodeTopLevelHTML(node: Node, path: AstPath<Node>): boolean {
	const root = path.stack[0] as Node;
	return !!root.html?.children?.includes(node);
}

/** Whether a cut-out top-level `<script>` or `<style>` started right after this node. */
export function doesEmbedStartAfterNode(
	node: Node,
	path: AstPath<Node>,
	siblings = getSiblings(path)
): boolean {
	if (!isNodeTopLevelHTML(node, path)) return false;
	const position = node.end;
	const root = path.stack[0] as Node;
	const embeds = [root.css, root.html, root.instance, root.js, root.module] as Node[];
	const nextNode = siblings[siblings.indexOf(node) + 1];
	return !!embeds.find((n) => n && n.start >= position && (!nextNode || n.end <= nextNode.start));
}

function getAttributeValue(attributeName: string, node: Node) {
	const attributes = (node.attributes ?? []) as Node[];
	const attribute = attributes.find((a) => a.name === attributeName);
	return attribute?.value;
}

function getLangAttribute(node: Node): string | null {
	const value = getAttributeValue('lang', node) || getAttributeValue('type', node);
	if (value != null && typeof value === 'object') {
		const text = (value as Node[]).find((v) => v.type === 'Text');
		if (text) return text.data.replace(/^text\//, '');
	}
	return null;
}

export function isNodeSupportedLanguage(node: Node) {
	const lang = getLangAttribute(node);
	return !(lang && unsupportedLanguages.includes(lang));
}

export function printRaw(node: Node, originalText: string, stripLeadingAndTrailingNewline = false) {
	if (node.children.length === 0) return '';
	const firstChild = node.children[0] as Node;
	const lastChild = node.children[node.children.length - 1] as Node;
	let raw = originalText.substring(firstChild.start, lastChild.end);
	if (!stripLeadingAndTrailingNewline) return raw;
	if (/^[\t\f\r ]*\n/.test(raw)) raw = raw.substring(raw.indexOf('\n') + 1);
	if (/\n[\t\f\r ]*$/.test(raw)) {
		raw = raw.substring(0, raw.lastIndexOf('\n'));
		if (raw.charAt(raw.length - 1) === '\r') raw = raw.substring(0, raw.length - 1);
	}
	return raw;
}

/** Prints the original text of a node, for `prettier-ignore`. */
export function printIgnored(node: Node, options: ParserOptions): Doc {
	return options.originalText
		.slice(options.locStart(node), options.locEnd(node))
		.split('\n')
		.flatMap((o, i): Doc[] => (i === 0 ? [o] : [literalline, o]));
}

export function printPre(node: Node, originalText: string, path: AstPath<Node>, print: PrintFn) {
	const result: Doc[] = [];
	(node.children as Node[]).forEach((child, i) => {
		if (child.type === 'Text') {
			const lines = originalText.substring(child.start, child.end).split(/\r?\n/);
			lines.forEach((text, j) => {
				if (j > 0) result.push(literalline);
				result.push(text);
			});
		} else {
			result.push(path.call(() => print(), 'children', i));
		}
	});
	return result;
}

function getAttributeLine(node: Node, options: SvelteOptions) {
	const hasThisBinding =
		(node.type === 'InlineComponent' && !!node.expression) ||
		(node.type === 'Element' && !!node.tag);
	const attributes = (node.attributes as Node[]).filter(
		(attribute) => attribute.name !== snippedTagContentAttribute
	);
	return options.singleAttributePerLine &&
		(attributes.length > 1 || (attributes.length && hasThisBinding))
		? hardline
		: line;
}

function printAttributes(node: Node, path: AstPath<Node>, options: SvelteOptions, print: PrintFn) {
	return path.map(
		(attributePath) =>
			(attributePath as AstPath<Node>).node.name !== snippedTagContentAttribute
				? [getAttributeLine(node, options), print()]
				: '',
		'attributes'
	);
}

function expressionBrackets(options: SvelteOptions) {
	return options.svelteStrictMode && !options._svelte_is5Plus ? ['"{', '}"'] : ['{', '}'];
}

/** Element-like nodes printed by printElement, as in upstream's Element case. */
export const ELEMENT_TYPES = new Set([
	'Element',
	'InlineComponent',
	'Slot',
	'SlotTemplate',
	'Window',
	'Head',
	'SvelteBoundary',
	'Title'
]);

export function isSelfClosingTag(node: Node, options: SvelteOptions, isEmpty: boolean): boolean {
	const isDoctypeTag = node.name.toUpperCase() === '!DOCTYPE';
	const didSelfClose = options.originalText[node.end - 2] === '/';
	return (
		isEmpty &&
		((((node.type === 'Element' && !options.svelteStrictMode) ||
			node.type === 'Head' ||
			node.type === 'InlineComponent' ||
			node.type === 'Slot' ||
			node.type === 'SlotTemplate' ||
			node.type === 'SvelteBoundary' ||
			node.type === 'Title') &&
			didSelfClose) ||
			node.type === 'Window' ||
			selfClosingTags.includes(node.name) ||
			isDoctypeTag)
	);
}

/** `<name attributes`: the opening tag without its closing `>`. */
export function printOpeningTagStart(
	node: Node,
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn,
	beforeBracket: Doc
): Doc {
	const [open = '{', close = '}'] = expressionBrackets(options);
	const attributes = printAttributes(node, path, options, print);
	const attributeLine = getAttributeLine(node, options);
	const possibleThisBinding: Doc =
		node.type === 'InlineComponent' && node.expression
			? [attributeLine, 'this=', open, print('expression'), close]
			: node.type === 'Element' && node.tag
				? [
						attributeLine,
						'this=',
						...(typeof node.tag === 'string' ? [`"${node.tag}"`] : [open, print('tag'), close])
					]
				: '';
	return ['<', node.name, indent(group([possibleThisBinding, ...attributes, beforeBracket]))];
}

export function printSelfClosingTag(
	node: Node,
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn
): Doc {
	const bracketSameLine = isBracketSameLine(options);
	const isDoctypeTag = node.name.toUpperCase() === '!DOCTYPE';
	return group([
		printOpeningTagStart(
			node,
			path,
			options,
			print,
			bracketSameLine || isDoctypeTag ? '' : dedent(line)
		),
		bracketSameLine && !isDoctypeTag ? ' ' : '',
		`${isDoctypeTag ? '' : '/'}>`
	]);
}

/** The opening part of a block, up to and including its `}`. */
export function printBlockOpening(
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn
): Doc {
	const node = path.node;
	switch (node.type) {
		case 'IfBlock':
			return ['{#if ', print('expression'), '}'];
		case 'EachBlock': {
			const def: Doc[] = ['{#each ', print('expression')];
			if (node.context) def.push(' as', expandNode(node.context, options.originalText));
			if (node.index) def.push(', ', node.index);
			if (node.key) def.push(' (', print('key'), ')');
			def.push('}');
			return def;
		}
		case 'KeyBlock':
			return ['{#key ', print('expression'), '}'];
		case 'SnippetBlock':
			return ['{#snippet ', print('expression'), '}'];
		default:
			throw new Error(`svelte-whitespace: no block opening for ${node.type}`);
	}
}

export const blockClosing: Record<string, string> = {
	IfBlock: '{/if}',
	EachBlock: '{/each}',
	KeyBlock: '{/key}',
	SnippetBlock: '{/snippet}'
};

/**
 * `{#await}`: which parts to print, and their opening tags. `body` prints a part's children.
 */
export function printAwaitBlock(
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn,
	body: (part: 'pending' | 'then' | 'catch') => Doc
): Doc {
	const node = path.node;
	const has = (part: string) => (node[part].children as Node[]).some((n) => !isEmptyTextNode(n));
	const [hasPending, hasThen, hasCatch] = [has('pending'), has('then'), has('catch')];
	const block: Doc[] = [];

	if (!hasPending && hasThen) {
		block.push(
			group([
				'{#await ',
				print('expression'),
				' then',
				expandNode(node.value, options.originalText),
				'}'
			]),
			body('then')
		);
	} else if (!hasPending && hasCatch) {
		block.push(
			group([
				'{#await ',
				print('expression'),
				' catch',
				expandNode(node.error, options.originalText),
				'}'
			]),
			body('catch')
		);
	} else {
		block.push(group(['{#await ', print('expression'), '}']));
		if (hasPending) block.push(body('pending'));
		if (hasThen) {
			block.push(
				group(['{:then', expandNode(node.value, options.originalText), '}']),
				body('then')
			);
		}
	}
	if ((hasPending || hasThen) && hasCatch) {
		block.push(
			group(['{:catch', expandNode(node.error, options.originalText), '}']),
			body('catch')
		);
	}
	block.push('{/await}');
	return group(block);
}

export function printComment(node: Node): Doc {
	let text: string = node.data;
	if (text.includes(snippedTagContentAttribute)) {
		text = text.replace(
			/(<\w+.*?)\s*✂prettier:content✂="(.*?)">.*?(?=<\/)/gi,
			(_, start: string, encoded: string) => `${start}>${Buffer.from(encoded, 'base64').toString()}`
		);
	}
	return group(['<!--', text, '-->']);
}

/**
 * The `Comment` case: tracks `prettier-ignore` directives, and drops comments that belong to a
 * cut-out top-level `<script>` or `<style>` (upstream's `embed` prints those).
 */
export function printCommentNode(path: AstPath<Node>, state: TopLevelState): Doc {
	const node = path.node;
	const nodeAfterComment = getNextNode(path);
	if (isIgnoreStartDirective(node) && isNodeTopLevelHTML(node, path)) {
		state.ignoreRange = true;
	} else if (isIgnoreEndDirective(node) && isNodeTopLevelHTML(node, path)) {
		state.ignoreRange = false;
	} else if (
		doesEmbedStartAfterNode(node, path) ||
		(isEmptyTextNode(nodeAfterComment) && doesEmbedStartAfterNode(nodeAfterComment!, path))
	) {
		return '';
	} else if (isIgnoreDirective(node)) {
		state.ignoreNext = true;
	}
	return printComment(node);
}

/**
 * Takes `<svelte:options>` (and a comment just before it) out of the top-level children so it
 * can be printed in its configured place, and drops whitespace that preceded a cut-out
 * `<script>` or `<style>`.
 */
export function prepareTopLevelChildren(
	path: AstPath<Node>,
	options: SvelteOptions,
	print: PrintFn,
	state: TopLevelState
): Node[] {
	const children = path.node.children as Node[];
	const bracketSameLine = isBracketSameLine(options);
	let svelteOptionsComment: Doc | undefined;
	const result: Node[] = [];

	for (let idx = 0; idx < children.length; idx++) {
		const child = children[idx]!;
		if (child.type === 'Text' && getUnencodedText(child) === '') continue;
		if (isEmptyTextNode(child) && doesEmbedStartAfterNode(child, path, children)) continue;

		if (options.svelteSortOrder !== 'none') {
			if (isCommentFollowedByOptions(idx)) {
				svelteOptionsComment = printComment(child);
				const nextChild = children[idx + 1];
				idx += nextChild && isEmptyTextNode(nextChild) ? 1 : 0;
				continue;
			}
			if (child.type === 'Options') {
				state.svelteOptionsDoc = group([
					[
						'<',
						child.name,
						indent(
							group([
								...path.map(
									() => [getAttributeLine(child, options), print()],
									'children',
									idx,
									'attributes'
								),
								bracketSameLine ? '' : dedent(line)
							])
						),
						bracketSameLine ? ' ' : '',
						'/>'
					],
					hardline
				]);
				if (svelteOptionsComment) {
					state.svelteOptionsDoc = group([svelteOptionsComment, hardline, state.svelteOptionsDoc]);
				}
				continue;
			}
		}
		result.push(child);
	}
	return result;

	function isCommentFollowedByOptions(idx: number): boolean {
		const node = children[idx]!;
		if (node.type !== 'Comment' || isIgnoreEndDirective(node) || isIgnoreStartDirective(node)) {
			return false;
		}
		const nextChild = children[idx + 1];
		if (!nextChild) return false;
		if (isEmptyTextNode(nextChild)) return children[idx + 2]?.type === 'Options';
		return nextChild.type === 'Options';
	}
}

/** The file's top level: options, scripts, markup and styles in the configured order. */
export function printTopLevelParts(
	n: Node,
	options: SvelteOptions,
	path: AstPath<Node>,
	print: PrintFn,
	state: TopLevelState
): Doc {
	if (options.svelteSortOrder === 'none') {
		const topLevelPartsByEnd: Record<number, Node> = {};
		const topLevelPartsByStart: Record<number, Node> = {};
		for (const part of [n.module, n.instance, n.css] as (Node | undefined)[]) {
			if (part) {
				topLevelPartsByEnd[part.end] = part;
				topLevelPartsByStart[part.start] = part;
			}
		}
		const children = (n.html?.children ?? []) as Node[];
		for (let i = 0; i < children.length; i++) {
			const node = children[i]!;
			if (topLevelPartsByEnd[node.start]) {
				children.splice(i, 0, topLevelPartsByEnd[node.start]!);
				delete topLevelPartsByEnd[node.start];
			} else if (i === children.length - 1 && topLevelPartsByStart[node.end]) {
				children.push(topLevelPartsByStart[node.end]!);
			}
		}
		const result = print('html');
		return options.insertPragma && !hasPragma(options.originalText)
			? ['<!-- @format -->', hardline, result]
			: result;
	}

	const parts: Record<SortOrderPart, Doc[]> = { options: [], scripts: [], markup: [], styles: [] };
	if (n.module) parts.scripts.push(print('module'));
	if (n.instance) parts.scripts.push(print('instance'));
	if (n.css) parts.styles.push(print('css'));
	const htmlDoc = print('html');
	if (htmlDoc) parts.markup.push(htmlDoc);
	if (state.svelteOptionsDoc) parts.options.push(state.svelteOptionsDoc);

	const docs = parseSortOrder(options.svelteSortOrder).flatMap((p) => parts[p]);
	state.ignoreNext = false;
	state.ignoreRange = false;
	state.svelteOptionsDoc = undefined;

	return options.insertPragma && !hasPragma(options.originalText)
		? ['<!-- @format -->', hardline, group(docs)]
		: group([join(hardline, docs)]);
}

function expandNode(node: Node | null, original: string): string {
	let str = _expandNode(node, original);
	if (node?.typeAnnotation) {
		str +=
			': ' +
			original.slice(
				node.typeAnnotation.typeAnnotation.start,
				node.typeAnnotation.typeAnnotation.end
			);
	}
	return str;
}

function _expandNode(node: Node | string | null, original: string, parent?: Node): string {
	if (node === null) return '';
	if (typeof node === 'string') return ' ' + node;
	switch (node.type) {
		case 'ArrayExpression':
		case 'ArrayPattern':
			return (
				' [' +
				(node.elements as (Node | null)[])
					.map((el) => (el === null ? ' ' : _expandNode(el, original)))
					.join(',')
					.slice(1) +
				']'
			);
		case 'AssignmentPattern':
			return _expandNode(node.left, original) + ' =' + _expandNode(node.right, original);
		case 'Identifier':
			return ' ' + node.name;
		case 'Literal':
			return ' ' + node.raw;
		case 'ObjectExpression':
			return (
				' {' +
				(node.properties as Node[]).map((p) => _expandNode(p, original, node)).join(',') +
				' }'
			);
		case 'ObjectPattern':
			return (
				' {' + (node.properties as Node[]).map((p) => _expandNode(p, original)).join(',') + ' }'
			);
		case 'Property': {
			let computedKeyInner = '';
			if (node.computed) {
				computedKeyInner =
					typeof node.key?.start === 'number' && typeof node.key?.end === 'number'
						? original.slice(node.key.start, node.key.end)
						: _expandNode(node.key, original).trim();
			}
			if (node.value.type === 'ObjectPattern' || node.value.type === 'ArrayPattern') {
				const keyStr = node.computed ? ' [' + computedKeyInner + ']' : ' ' + node.key.name;
				return keyStr + ':' + _expandNode(node.value, original);
			} else if (
				(node.value.type === 'Identifier' && node.key.name !== node.value.name) ||
				(parent && parent.type === 'ObjectExpression')
			) {
				const keyStr = node.computed
					? ' [' + computedKeyInner + ']'
					: _expandNode(node.key, original);
				return keyStr + ':' + _expandNode(node.value, original);
			} else {
				return _expandNode(node.value, original);
			}
		}
		case 'RestElement':
			return ' ...' + node.argument.name;
	}
	throw new Error('unknown node type: ' + node.type);
}
