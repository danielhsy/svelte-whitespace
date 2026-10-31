// `migrate` (SPEC §7.1): rewrites a file written for Svelte's own rule so that it renders the same
// under the configured options.

import MagicString from 'magic-string';
import { parse, type AST } from 'svelte/compiler';
import {
	analyse,
	blankScriptsAndStyles,
	resolveOptions,
	type ResolvedOptions
} from '../rule/index.js';

const SVELTE = resolveOptions({ preset: 'svelte' });

/**
 * For each gap where Svelte and the configured rule disagree:
 * - Svelte renders a space the rule would drop: write it as `{' '}`, before the whitespace;
 * - Svelte trims a space the rule would keep: remove it.
 * Whitespace next to a block-level element is left alone: browsers don't display it, and keeping
 * it would mean a `{' '}` between every pair of block elements.
 */
export function migrate(source: string, options: ResolvedOptions, quote: "'" | '"' = "'"): string {
	const svelte = new Map(analyse(source, SVELTE).map((gap) => [gap.start, gap]));
	const code = new MagicString(source);
	for (const gap of analyse(source, options)) {
		if (gap.passthrough || gap.start === gap.end) continue;
		if (gap.left === 'block' || gap.right === 'block') continue;
		const before = svelte.get(gap.start)?.renders ?? gap.renders;
		if (before === gap.renders) continue;
		if (before === '') code.remove(gap.start, gap.end);
		else code.prependLeft(gap.start, `{${quote} ${quote}}`);
	}
	return code.toString();
}

/**
 * Whether a file looks migrated already: it has a `{' '}` before whitespace with a line break.
 * That's how migrate and the Prettier plugin write a kept space, and it means the file follows
 * the configured rule, not Svelte's, so migrating it again would add a second space.
 */
export function looksMigrated(source: string): boolean {
	const visit = (fragment: AST.Fragment): boolean =>
		fragment.nodes.some((node, i) => {
			const next = fragment.nodes[i + 1];
			if (
				node.type === 'ExpressionTag' &&
				node.expression.type === 'Literal' &&
				node.expression.value === ' ' &&
				next?.type === 'Text' &&
				/^[ \t]*[\r\n]/.test(next.data)
			) {
				return true;
			}
			return Object.values(node).some(
				(value) =>
					typeof value === 'object' && value?.type === 'Fragment' && visit(value as AST.Fragment)
			);
		});
	return visit(parse(blankScriptsAndStyles(source), { modern: true }).fragment);
}
