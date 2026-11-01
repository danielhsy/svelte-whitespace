// prettier-plugin-svelte's type declarations only describe its config options, not the plugin
// object it exports, so we give that object its real type here, once.

import type { Plugin, Printer, SupportLanguage, SupportOptions, Parser } from 'prettier';
import * as untyped from 'prettier-plugin-svelte';

export interface UpstreamPlugin extends Plugin {
	languages: SupportLanguage[];
	options: SupportOptions;
	parsers: { svelte: Parser };
	printers: { 'svelte-ast': Printer };
}

export const upstream = untyped as unknown as UpstreamPlugin;
