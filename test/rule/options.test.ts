import { describe, expect, it } from 'vitest';
import { KINDS, PRESETS, resolveOptions, strictest, type Options } from '../../src/rule/index.js';

describe('resolveOptions', () => {
	it('defaults to the jsx preset and excludes node_modules', () => {
		const resolved = resolveOptions();
		expect(resolved.preset).toBe('jsx');
		expect(resolved.spaces).toEqual(PRESETS.jsx);
		expect(resolved.exclude).toEqual(['**/node_modules/**']);
	});

	it('applies per-kind overrides on top of the preset', () => {
		const resolved = resolveOptions({ preset: 'display', spaces: { expressions: 'never' } });
		expect(resolved.spaces).toEqual({ ...PRESETS.display, expressions: 'never' });
	});

	it('rejects unknown presets, kinds, behaviours and classifications', () => {
		const bad = [
			{ preset: 'react' },
			{ spaces: { blocks: 'never' } },
			{ spaces: { inline: 'sometimes' } },
			{ classify: { components: { Card: 'flex' } } }
		] as unknown as Options[];
		for (const options of bad) expect(() => resolveOptions(options)).toThrow(/svelte-whitespace/);
	});
});

describe('presets (SPEC §5.2)', () => {
	it('display is svelte plus never next to block elements', () => {
		expect(PRESETS.display).toEqual({ ...PRESETS.svelte, block: 'never' });
	});

	it('jsx is same-line for every kind', () => {
		for (const kind of KINDS) expect(PRESETS.jsx[kind]).toBe('same-line');
	});
});

describe('strictest (SPEC §3.3)', () => {
	it('never beats same-line beats always', () => {
		expect(strictest('always', 'same-line')).toBe('same-line');
		expect(strictest('never', 'same-line')).toBe('never');
		expect(strictest('always', 'never')).toBe('never');
		expect(strictest('always', 'always')).toBe('always');
	});
});
