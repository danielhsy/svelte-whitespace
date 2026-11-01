import { preprocess } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { svelteWhitespace } from '../../src/preprocess/index.js';
import type { PresetName } from '../../src/rule/index.js';
import { WIDTHS, format } from '../helpers/format.js';
import { renderHtml } from '../helpers/render.js';
import { examples, type Example } from './examples.js';

async function rendered(example: Example, source: string, preset: PresetName) {
	const { code } = await preprocess(source, svelteWhitespace({ preset }), {
		filename: 'Example.svelte'
	});
	return renderHtml({ ...example, source: code });
}

describe('conformance (SPEC §10)', () => {
	for (const example of examples) {
		for (const [name, expected] of Object.entries(example.expected)) {
			const preset = name as PresetName;

			it(`example ${example.id} renders as specified under ${preset}`, async () => {
				expect(await rendered(example, example.source, preset)).toBe(expected);
			});

			it(`example ${example.id} keeps its rendering when formatted under ${preset}`, async () => {
				for (const width of WIDTHS) {
					const formatted = await format(example.source, preset, width);
					expect(await rendered(example, formatted, preset), `width ${width}:\n${formatted}`).toBe(
						expected
					);
					expect(await format(formatted, preset, width)).toBe(formatted);
				}
			});
		}
	}
});
