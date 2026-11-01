// What a template renders under the rule, as a string: tags (without attributes), text with every
// gap applied, and placeholders for expressions. Two sources with the same outline render the
// same whitespace. This is what `check` and the formatter tests compare (SPEC §7.2).

import { parse, type AST } from 'svelte/compiler';
import { analyse, blankScriptsAndStyles } from './gaps.js';
import type { ResolvedOptions } from './options.js';

const RAW_ELEMENTS = new Set(['pre', 'textarea', 'script', 'style']);

export function outline(source: string, options: ResolvedOptions): string {
	const gaps = new Map(analyse(source, options).map((gap) => [gap.start, gap]));
	const root = parse(blankScriptsAndStyles(source), { modern: true });

	const text = (node: AST.Text): string =>
		source
			.slice(node.start, node.end)
			.replace(/[ \t\r\n]+/g, (whitespace, offset: number) =>
				gaps.get(node.start + offset)?.renders === '' ? '' : ' '
			);

	const nodes = (fragment: AST.Fragment): string => fragment.nodes.map(node).join('');

	const node = (n: AST.TemplateNode): string => {
		switch (n.type) {
			case 'Text':
				return text(n);
			case 'Comment':
				return '';
			case 'ExpressionTag':
				// A string literal renders as itself: this is how `{' '}` counts as a space.
				return n.expression.type === 'Literal' && typeof n.expression.value === 'string'
					? n.expression.value
					: '{…}';
			case 'RegularElement':
				if (RAW_ELEMENTS.has(n.name.toLowerCase())) {
					return `<${n.name}>${source.slice(contentStart(n), contentEnd(n))}</${n.name}>`;
				}
			// falls through
			default: {
				const name = 'name' in n ? n.name : n.type;
				const children = Object.entries(n)
					.filter(([, value]) => value && typeof value === 'object' && value.type === 'Fragment')
					.map(([key, value]) => `[${key}]${nodes(value as AST.Fragment)}`)
					.join('');
				return `<${name}>${children}</${name}>`;
			}
		}
	};

	return nodes(root.fragment);
}

function contentStart(element: AST.RegularElement): number {
	return element.fragment.nodes[0]?.start ?? element.end;
}

function contentEnd(element: AST.RegularElement): number {
	return element.fragment.nodes.at(-1)?.end ?? element.end;
}
