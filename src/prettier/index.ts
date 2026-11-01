// The Prettier plugin (SPEC §8). For now it takes over prettier-plugin-svelte's printer and
// delegates every node back to it, which is the mechanism the markup printer will build on.
//
// Prettier uses the printer from the plugin whose parser it chose, so we must re-export the
// parser as well as supplying the printer; a printer on its own is silently ignored.

import type { Plugin, Printer } from 'prettier';
import { upstream } from './upstream.js';

const upstreamPrinter = upstream.printers['svelte-ast'];

const printer: Printer = {
	...upstreamPrinter,
	print(path, options, print, args) {
		return upstreamPrinter.print(path, options, print, args);
	}
};

const plugin = {
	languages: upstream.languages,
	options: upstream.options,
	parsers: { svelte: upstream.parsers.svelte },
	printers: { 'svelte-ast': printer }
} satisfies Plugin;

export default plugin;
export const { languages, options, parsers, printers } = plugin;
