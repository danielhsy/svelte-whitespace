import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import { preprocess } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { svelteWhitespace } from '../../src/preprocess/index.js';
import type { Options } from '../../src/rule/index.js';

async function run(source: string, options: Options = {}, filename = '/project/src/A.svelte') {
	return preprocess(source, svelteWhitespace(options), { filename });
}

describe('raw regions (SPEC §4)', () => {
	it('leaves pre, textarea, and nested script and style alone', async () => {
		const source = [
			'<pre>\n  a\n  b\n</pre>',
			'<textarea>\n x \n</textarea>',
			'<svelte:head>\n\t<script type="application/ld+json">\n\t\t{ "a": 1 }\n\t</script>\n</svelte:head>'
		].join('');
		const { code } = await run(source);
		expect(code).toContain('<pre>\n  a\n  b\n</pre>');
		expect(code).toContain('<textarea>\n x \n</textarea>');
		expect(code).toContain('\n\t\t{ "a": 1 }\n\t');
	});

	it('parses files whose script and style are not yet plain JavaScript and CSS', async () => {
		const source = [
			'<script lang="ts">\n\tconst x: Map<string, number> = new Map();\n</script>',
			'<p>\n\t{x}\n</p>',
			'<style lang="scss">\n\t$c: red;\n\tp { &:hover { color: $c; } }\n</style>'
		].join('\n');
		const { code } = await run(source);
		expect(code).toContain('<p>{x}</p>');
		expect(code).toContain('$c: red;');
	});
});

describe('directives (SPEC §6)', () => {
	const pair = '<p>\n\t<b>a</b>\n\t<b>b</b>\n</p>';

	it('applies a directive to the next element only', async () => {
		const { code } = await run(`<!-- svelte-whitespace: svelte -->\n${pair}\n${pair}`);
		expect(code).toBe(`<!-- svelte-whitespace: svelte -->${pair}<p><b>a</b><b>b</b></p>`);
	});

	it('applies a file directive everywhere', async () => {
		const { code } = await run(`${pair}\n<!-- svelte-whitespace-file: display -->`);
		expect(code).toBe('<p><b>a</b> <b>b</b></p><!-- svelte-whitespace-file: display -->');
	});

	it('applies overrides given in a directive', async () => {
		const { code } = await run('<!-- svelte-whitespace: jsx inline=always -->\n' + pair);
		expect(code).toContain('<p><b>a</b> <b>b</b></p>');
	});

	it('rejects malformed directives', async () => {
		await expect(run('<!-- svelte-whitespace: react -->\n<p></p>')).rejects.toThrow(/preset/);
		await expect(run('<!-- svelte-whitespace: jsx inline -->\n<p></p>')).rejects.toThrow(
			/kind=behaviour/
		);
		await expect(run('<!-- svelte-whitespace: jsx tags=never -->\n<p></p>')).rejects.toThrow(
			/unknown kind/
		);
	});
});

describe('options', () => {
	it('skips files in node_modules by default (SPEC §5.4)', async () => {
		const source = '<p>\n\t<b>a</b>\n</p>';
		const { code } = await run(source, {}, '/project/node_modules/lib/A.svelte');
		expect(code).toBe(source);
	});

	it('honours include patterns relative to the working directory', async () => {
		const source = '<p>\n\t<b>a</b>\n</p>';
		const inside = await run(source, { include: ['src/**'] }, `${process.cwd()}/src/A.svelte`);
		const outside = await run(source, { include: ['src/**'] }, `${process.cwd()}/lib/A.svelte`);
		expect(inside.code).toBe('<p><b>a</b></p>');
		expect(outside.code).toBe(source);
	});

	it('leaves everything to Svelte under the svelte preset', async () => {
		const source = '<p>\n\t<b> a </b>\n\t<b>b</b>\n</p>';
		const { code } = await run(source, { preset: 'svelte' });
		expect(code).toBe(source);
	});

	it('uses component classifications (SPEC §5.3)', async () => {
		const source = '<p>\n\t<Card />\n\t<Icon />\n</p>';
		const { code } = await run(source, {
			preset: 'display',
			classify: { components: { Card: 'block' } }
		});
		expect(code).toBe('<p><Card /><Icon /></p>');
	});
});

describe('source maps', () => {
	it('maps positions after removed whitespace back to the original', async () => {
		const source = '<p>\n\t<b>a</b>\n\t<i>c</i>\n</p>';
		const { code, map } = await run(source);
		const generated = code.indexOf('<i>');
		const trace = new TraceMap(map as ConstructorParameters<typeof TraceMap>[0]);
		const original = originalPositionFor(trace, { line: 1, column: generated });
		expect(original).toMatchObject({ line: 3, column: 1 });
	});
});
