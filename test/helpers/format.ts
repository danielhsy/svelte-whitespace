import * as prettier from 'prettier';
import { expect } from 'vitest';
import { createPlugin } from '../../src/prettier/index.js';
import { outline, resolveOptions, type PresetName } from '../../src/rule/index.js';

export const WIDTHS = [40, 80, 120];

export function format(source: string, preset: PresetName, printWidth = 80, extra = {}) {
	return prettier.format(source, {
		parser: 'svelte',
		plugins: [createPlugin({ preset })],
		useTabs: true,
		singleQuote: true,
		printWidth,
		...extra
	});
}

/** Formatting must not change what renders, at any width, and must be stable. */
export async function expectSafe(source: string, preset: PresetName) {
	const options = resolveOptions({ preset });
	for (const width of WIDTHS) {
		const formatted = await format(source, preset, width);
		expect(outline(formatted, options), `${preset} at width ${width}:\n${formatted}`).toBe(
			outline(source, options)
		);
		expect(await format(formatted, preset, width), `idempotent at width ${width}`).toBe(formatted);
	}
}
