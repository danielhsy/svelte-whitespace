import { resolve } from 'node:path';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import plugin from '../../src/prettier/index.js';
import { expectSafe, format } from '../helpers/format.js';

const hazards = [
	'<p>\n\tThis is a fairly long sentence with a <a href="/somewhere/quite/long">link in the middle</a> and then more words after it.\n</p>\n',
	'<p><a href="/a/really/long/path/one">first link text</a> <a href="/a/really/long/path/two">second link text</a></p>\n',
	'<p>\n\tSome words that go on for quite a while until we reach an <em class="emphasis-class">emphasised phrase</em>.\n</p>\n',
	'<p>Hello there, the current count of things in the basket is {count} and the total is {total}.</p>\n',
	'<p><b>first bold phrase here</b><i>then an italic phrase touching it</i><b>and more</b></p>\n'
];

describe('formatting never changes what renders (SPEC §8.3)', () => {
	for (const preset of ['jsx', 'display', 'svelte'] as const) {
		hazards.forEach((source, i) => {
			it(`hazard ${i + 1} under ${preset}`, () => expectSafe(source, preset));
		});
	}
});

describe('meaningful spaces', () => {
	it("writes {' '} before a line break at a meaningful space under jsx", async () => {
		const formatted = await format(hazards[1]!, 'jsx');
		expect(formatted).toContain("</a>{' '}\n");
	});

	it("follows singleQuote for {' '}", async () => {
		const formatted = await format(hazards[1]!, 'jsx', 80, { singleQuote: false });
		expect(formatted).toContain('</a>{" "}\n');
	});

	it("turns a {' '} that fits on the line into a plain space", async () => {
		expect(await format("<p>a{' '}\n\t<b>b</b></p>\n", 'jsx')).toBe('<p>a <b>b</b></p>\n');
	});

	it("keeps a {' '} that a plain space couldn't replace", async () => {
		const source = "<div>a</div>{' '}<div>b</div>\n";
		expect(await format(source, 'display')).toBe(source);
	});
});

describe('hugging (SPEC appendix)', () => {
	it('breaks inside tags where touching inline tags would otherwise gain a space', async () => {
		const formatted = await format(hazards[4]!, 'display', 40);
		expect(formatted).toMatch(/<\/b\n\s*><i>/);
	});
});

describe('layout', () => {
	it('keeps line breaks between tags and inside blocks', async () => {
		const source = '<ul>\n\t<li>a</li>\n\t<li>b</li>\n</ul>\n\n{#if x}\n\t<p>x</p>\n{/if}\n';
		expect(await format(source, 'jsx')).toBe(source);
	});

	it('leaves pre and textarea contents alone', async () => {
		const source = '<pre>\n  a   b\n    c\n</pre>\n<textarea>\n x  y\n</textarea>\n';
		expect(await format(source, 'jsx')).toBe(source);
	});

	it('honours prettier-ignore', async () => {
		const source = '<!-- prettier-ignore -->\n<p>  a     b  </p>\n';
		expect(await format(source, 'jsx')).toBe(source);
	});

	it('orders the top level as configured', async () => {
		const source =
			'<style>\n\tp {\n\t\tcolor: red;\n\t}\n</style>\n\n<p>x</p>\n\n<script>\n\tlet x = 1;\n</script>\n';
		expect(await format(source, 'jsx')).toBe(
			'<script>\n\tlet x = 1;\n</script>\n\n<p>x</p>\n\n<style>\n\tp {\n\t\tcolor: red;\n\t}\n</style>\n'
		);
	});
});

describe('configuration (SPEC §8.2)', () => {
	it('reads its options from svelte.config.js', async () => {
		const formatted = await prettier.format('<p>\n\t<b>a</b>\n\t<i>b</i>\n</p>\n', {
			parser: 'svelte',
			plugins: [plugin],
			filepath: resolve('test/fixtures/project/src/A.svelte'),
			useTabs: true,
			printWidth: 20
		});
		// display: the line break between inline tags is a space, so it may stay a line break.
		expect(formatted).toBe('<p>\n\t<b>a</b>\n\t<i>b</i>\n</p>\n');
	});

	it('refuses to format without a config', async () => {
		await expect(
			prettier.format('<p>x</p>', { parser: 'svelte', plugins: [plugin], filepath: '/A.svelte' })
		).rejects.toThrow(/no svelte\.config\.js/);
	});
});
