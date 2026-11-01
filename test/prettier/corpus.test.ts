// Formats every .svelte file under $SVELTE_WHITESPACE_CORPUS and checks that nothing renders
// differently. Skipped unless the variable is set, e.g.
//   SVELTE_WHITESPACE_CORPUS=~/Documents/website/src npx vitest run test/prettier/corpus

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { expectSafe } from '../helpers/format.js';

const corpus = process.env.SVELTE_WHITESPACE_CORPUS;
const files = corpus
	? globSync('**/*.svelte', { cwd: corpus, exclude: ['**/node_modules/**'] })
	: [];

describe.skipIf(!corpus)('corpus', () => {
	for (const file of files) {
		for (const preset of ['jsx', 'display'] as const) {
			it(`${file} under ${preset}`, () =>
				expectSafe(readFileSync(join(corpus!, file), 'utf8'), preset));
		}
	}
});
