import { relative } from 'node:path';
import MagicString from 'magic-string';
import picomatch from 'picomatch';
import type { PreprocessorGroup } from 'svelte/compiler';
import { analyse, resolveOptions, type Options, type ResolvedOptions } from '../rule/index.js';

export type { Behaviour, Kind, Options, PresetName } from '../rule/index.js';

/**
 * Where the resolved options are attached to the preprocessor, so the Prettier plugin can read
 * them from svelte.config.js (SPEC §8.2). A registered symbol survives duplicate copies of
 * this package.
 */
export const OPTIONS = Symbol.for('svelte-whitespace.options');

export interface SvelteWhitespacePreprocessor extends PreprocessorGroup {
	name: 'svelte-whitespace';
	[OPTIONS]: ResolvedOptions;
}

export function svelteWhitespace(options: Options = {}): SvelteWhitespacePreprocessor {
	const resolved = resolveOptions(options);

	return {
		name: 'svelte-whitespace',
		[OPTIONS]: resolved,
		markup({ content, filename }) {
			if (filename !== undefined && !isIncluded(filename, resolved)) return;
			const code = applyRule(content, resolved);
			if (!code.hasChanged()) return;
			return {
				code: code.toString(),
				map: code.generateMap({
					hires: true,
					includeContent: true,
					...(filename === undefined ? {} : { source: filename })
				})
			};
		}
	};
}

/**
 * Rewrites each gap so that Svelte's own whitespace handling renders what the rule says
 * (SPEC §9). Svelte trims whitespace at edges, so a space kept there is written as `{' '}`.
 */
export function applyRule(content: string, options: ResolvedOptions): MagicString {
	const code = new MagicString(content);
	for (const gap of analyse(content, options)) {
		if (gap.passthrough || gap.start === gap.end) continue;
		const atEdge = gap.left === 'edges' || gap.right === 'edges';
		if (gap.renders === '') code.remove(gap.start, gap.end);
		else if (atEdge) code.overwrite(gap.start, gap.end, "{' '}");
		else if (content.slice(gap.start, gap.end) !== ' ') code.overwrite(gap.start, gap.end, ' ');
	}
	return code;
}

const filters = new WeakMap<ResolvedOptions, (filename: string) => boolean>();

/** SPEC §5.4: whether the preprocessor applies the rule to this file. */
export function isIncluded(filename: string, options: ResolvedOptions): boolean {
	let filter = filters.get(options);
	if (!filter) filters.set(options, (filter = fileFilter(options)));
	return filter(filename);
}

/** Patterns match the absolute path or the path relative to the working directory. */
function fileFilter({ include, exclude }: ResolvedOptions): (filename: string) => boolean {
	const included = include.length ? picomatch(include, { dot: true }) : () => true;
	const excluded = exclude.length ? picomatch(exclude, { dot: true }) : () => false;
	return (filename) => {
		const paths = [filename, relative(process.cwd(), filename)];
		return paths.some((path) => included(path)) && !paths.some((path) => excluded(path));
	};
}
