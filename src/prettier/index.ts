// The Prettier plugin (SPEC §8). Prettier uses the printer from the plugin whose parser it chose,
// so we re-export prettier-plugin-svelte's parser (wrapped, to run the rule once per file) as well
// as supplying our own printer; a printer on its own is silently ignored.

import type { ParserOptions, Plugin, Printer } from 'prettier';
import { resolveOptions, type Options, type ResolvedOptions } from '../rule/index.js';
import { loadOptions } from './config.js';
import type { Node } from './derived.js';
import { attachState, print } from './printer.js';
import { upstream } from './upstream.js';

function createPluginFrom(
	getOptions: (options: ParserOptions) => ResolvedOptions | Promise<ResolvedOptions>
) {
	const upstreamParser = upstream.parsers.svelte;
	const printer: Printer = { ...upstream.printers['svelte-ast'], print };
	return {
		languages: upstream.languages,
		options: upstream.options,
		parsers: {
			// Upstream also registers parsers it uses internally to format expressions.
			...upstream.parsers,
			svelte: {
				...upstreamParser,
				async parse(text: string, options: ParserOptions) {
					const root = (await upstreamParser.parse(text, options)) as Node;
					attachState(root, text, await getOptions(options));
					return root;
				}
			}
		},
		printers: { 'svelte-ast': printer }
	} satisfies Plugin;
}

/** A plugin with fixed options, for formatting without a svelte.config.js. */
export function createPlugin(options: Options = {}) {
	const resolved = resolveOptions(options);
	return createPluginFrom(() => resolved);
}

/** The plugin for Prettier config files: reads its options from svelte.config.js. */
const plugin = createPluginFrom((options) => loadOptions(options.filepath));

export default plugin;
export const { languages, options, parsers, printers } = plugin;
