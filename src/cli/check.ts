// `check` (SPEC §7.2): formats a file in memory and confirms that nothing renders differently.

import { readFile } from 'node:fs/promises';
import * as prettier from 'prettier';
import plugin from '../prettier/index.js';
import { outline, type ResolvedOptions } from '../rule/index.js';

export interface CheckResult {
	file: string;
	/** Where the rendering first differs, if it does: a little context from before and after. */
	difference?: { before: string; after: string };
}

export async function checkFile(file: string, options: ResolvedOptions): Promise<CheckResult> {
	const source = await readFile(file, 'utf8');
	const config = (await prettier.resolveConfig(file)) ?? {};
	const formatted = await prettier.format(source, {
		...config,
		filepath: file,
		parser: 'svelte',
		plugins: [...otherPlugins(config.plugins), plugin]
	});
	const before = outline(source, options);
	const after = outline(formatted, options);
	if (before === after) return { file };

	let i = 0;
	while (before[i] === after[i]) i++;
	const excerpt = (text: string) => text.slice(Math.max(0, i - 40), i + 40);
	return { file, difference: { before: excerpt(before), after: excerpt(after) } };
}

/** The project's other Prettier plugins, without the Svelte ones we replace. */
function otherPlugins(plugins: prettier.Config['plugins']) {
	return (plugins ?? []).filter(
		(p) => p !== 'prettier-plugin-svelte' && p !== 'svelte-whitespace/prettier'
	);
}

export async function quoteFor(file: string): Promise<"'" | '"'> {
	const config = await prettier.resolveConfig(file);
	return config?.singleQuote ? "'" : '"';
}
