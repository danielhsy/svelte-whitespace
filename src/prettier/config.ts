// Finds the options passed to svelteWhitespace() in svelte.config.js, so the formatter follows
// the same rule as the compiler (SPEC §8.2).

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ResolvedOptions } from '../rule/index.js';

const OPTIONS = Symbol.for('svelte-whitespace.options');
const CONFIG_FILES = [
	'svelte.config.js',
	'svelte.config.mjs',
	'svelte.config.cjs',
	'svelte.config.ts'
];

const cache = new Map<string, Promise<ResolvedOptions>>();

export function loadOptions(filepath: string | undefined): Promise<ResolvedOptions> {
	const configFile = findConfigFile(filepath ? dirname(resolve(filepath)) : process.cwd());
	if (!configFile) {
		return Promise.reject(
			new Error(
				`svelte-whitespace: no svelte.config.js found above ${filepath ?? process.cwd()}. ` +
					'The Prettier plugin reads the svelteWhitespace() options from it, so that ' +
					'formatting follows the same rule as the compiler.'
			)
		);
	}
	let options = cache.get(configFile);
	if (!options) {
		options = readOptions(configFile);
		cache.set(configFile, options);
	}
	return options;
}

function findConfigFile(directory: string): string | undefined {
	for (let current = directory; ; current = dirname(current)) {
		const found = CONFIG_FILES.map((name) => join(current, name)).find((file) => existsSync(file));
		if (found) return found;
		if (dirname(current) === current) return undefined;
	}
}

async function readOptions(configFile: string): Promise<ResolvedOptions> {
	const module = await import(pathToFileURL(configFile).href);
	const config = module.default ?? module;
	const preprocessors = [config.preprocess ?? []].flat(Infinity) as Record<symbol, unknown>[];
	const ours = preprocessors.find((preprocessor) => preprocessor && OPTIONS in preprocessor);
	if (!ours) {
		throw new Error(
			`svelte-whitespace: ${configFile} has no svelteWhitespace() preprocessor. ` +
				'Add it to `preprocess`, or remove svelte-whitespace/prettier from your Prettier plugins.'
		);
	}
	return ours[OPTIONS] as ResolvedOptions;
}
