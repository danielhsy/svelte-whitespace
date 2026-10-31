// What gaps render. Svelte drops comments and hoisted tags (`{@const}`, `{@debug}`,
// `<svelte:head>`…) before it trims and collapses whitespace, so the whitespace on either side of
// them meets: one space at most, and none at an edge (SPEC §3).

import { describe, expect, it } from 'vitest';
import { applyRule } from '../../src/preprocess/index.js';
import { resolveOptions, type PresetName } from '../../src/rule/index.js';
import { renderHtml } from '../helpers/render.js';

const cases: { source: string; expected: Record<PresetName, string> }[] = [
	{
		source: '<p>\n\t<!-- c -->\n\t<b>x</b>\n</p>',
		expected: { svelte: '<p><b>x</b></p>', display: '<p><b>x</b></p>', jsx: '<p><b>x</b></p>' }
	},
	{
		source: '<p><!-- c --> <b>x</b></p>',
		expected: { svelte: '<p><b>x</b></p>', display: '<p><b>x</b></p>', jsx: '<p> <b>x</b></p>' }
	},
	{
		source: '<p><b>x</b> <!-- c --></p>',
		expected: { svelte: '<p><b>x</b></p>', display: '<p><b>x</b></p>', jsx: '<p><b>x</b> </p>' }
	},
	{
		source: '<p><b>a</b> <!-- c --> <b>b</b></p>',
		expected: {
			svelte: '<p><b>a</b> <b>b</b></p>',
			display: '<p><b>a</b> <b>b</b></p>',
			jsx: '<p><b>a</b> <b>b</b></p>'
		}
	},
	{
		source: '<p><b>a</b>\n<!-- c -->\n<b>b</b></p>',
		expected: {
			svelte: '<p><b>a</b> <b>b</b></p>',
			display: '<p><b>a</b> <b>b</b></p>',
			jsx: '<p><b>a</b><b>b</b></p>'
		}
	},
	{
		source: '<p>a <!-- c -->\nb</p>',
		expected: { svelte: '<p>a b</p>', display: '<p>a b</p>', jsx: '<p>a b</p>' }
	},
	{
		source: '<p>a<!-- c -->b</p>',
		expected: { svelte: '<p>ab</p>', display: '<p>ab</p>', jsx: '<p>ab</p>' }
	},
	{
		source: '{#if ok}\n\t{@const n = 1}\n\t<b>{n}</b>\n{/if}',
		expected: { svelte: '<b>1</b>', display: '<b>1</b>', jsx: '<b>1</b>' }
	},
	{
		source: '<p>\n\t<b>a</b>\n\t{@debug ok}\n\t<b>b</b>\n</p>',
		expected: {
			svelte: '<p><b>a</b> <b>b</b></p>',
			display: '<p><b>a</b> <b>b</b></p>',
			jsx: '<p><b>a</b><b>b</b></p>'
		}
	}
];

describe('whitespace around nodes Svelte drops', () => {
	for (const { source, expected } of cases) {
		for (const [preset, html] of Object.entries(expected)) {
			it(`${JSON.stringify(source)} under ${preset}`, async () => {
				const options = resolveOptions({ preset: preset as PresetName });
				const code = applyRule(source, options).toString();
				expect(await renderHtml({ source: code, scope: { ok: true } })).toBe(html);
			});
		}
	}
});
