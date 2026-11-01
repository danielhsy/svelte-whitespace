import type { PreprocessorGroup } from 'svelte/compiler';
import { resolveOptions, type Options, type ResolvedOptions } from '../rule/index.js';

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
		markup() {
			// Not implemented yet: returning nothing leaves the markup unchanged.
			return undefined;
		}
	};
}
