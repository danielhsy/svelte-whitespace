import { preprocess } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { svelteWhitespace } from '../../src/preprocess/index.js';
import type { PresetName } from '../../src/rule/index.js';
import { renderHtml } from '../helpers/render.js';
import { examples } from './examples.js';

describe('conformance (SPEC §10)', () => {
	for (const example of examples) {
		for (const [preset, expected] of Object.entries(example.expected)) {
			it(`example ${example.id} renders as specified under ${preset}`, async () => {
				const { code } = await preprocess(
					example.source,
					svelteWhitespace({ preset: preset as PresetName }),
					{ filename: 'Example.svelte' }
				);
				expect(await renderHtml({ ...example, source: code })).toBe(expected);
			});
			// Pending until the markup printer exists.
			it.todo(`example ${example.id} keeps its rendering when formatted under ${preset}`);
		}
	}
});
