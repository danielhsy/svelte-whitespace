import { describe, expect, it } from 'vitest';
import { looksMigrated, migrate } from '../../src/cli/migrate.js';
import { applyRule } from '../../src/preprocess/index.js';
import { outline, resolveOptions, type PresetName } from '../../src/rule/index.js';
import { renderHtml } from '../helpers/render.js';
import { examples } from '../conformance/examples.js';

const SVELTE = resolveOptions({ preset: 'svelte' });

// Written for Svelte's own rule, with no whitespace next to block-level elements.
const sources = [
	'<p>\n\tHello\n\t<em>world</em>\n\tagain\n</p>',
	'<p>\n\t<a href="/a">one</a>\n\t<a href="/b">two</a>\n</p>',
	'<p><b> a </b>b</p>',
	'<p>\n\tPosted by {author}\n\t{#if date}\n\t\ton <time>{date}</time>\n\t{/if}\n</p>',
	'<p>\n\t<Icon />\n\tSave\n</p>',
	"<p>a{' '}\n\t<b>b</b></p>"
];

describe('migrate (SPEC §7.1)', () => {
	for (const preset of ['jsx', 'display'] as PresetName[]) {
		const options = resolveOptions({ preset });
		sources.forEach((source, i) => {
			it(`source ${i + 1} renders the same under ${preset} as it did under Svelte`, async () => {
				const scope = { author: 'A', date: 'D' };
				const components = { Icon: '<i></i>' };
				const migrated = applyRule(migrate(source, options), options).toString();
				expect(await renderHtml({ source: migrated, scope, components })).toBe(
					await renderHtml({ source, scope, components })
				);
			});
		});
	}

	it("writes {' '} before the whitespace it keeps", () => {
		expect(
			migrate('<p>\n\t<a>one</a>\n\t<a>two</a>\n</p>', resolveOptions({ preset: 'jsx' }))
		).toBe("<p>\n\t<a>one</a>{' '}\n\t<a>two</a>\n</p>");
	});

	it('leaves whitespace next to block-level elements alone', () => {
		const source = '<div>\n\t<p>a</p>\n\t<p>b</p>\n</div>';
		expect(migrate(source, resolveOptions({ preset: 'jsx' }))).toBe(source);
	});

	it('keeps every example rendering the same, apart from whitespace next to blocks', () => {
		for (const preset of ['jsx', 'display'] as PresetName[]) {
			const options = resolveOptions({ preset });
			for (const { source } of examples) {
				expect(outline(migrate(source, options), options, { ignoreBlockWhitespace: true })).toBe(
					outline(source, SVELTE, { ignoreBlockWhitespace: true })
				);
			}
		}
	});

	it('follows the quote style it is given', () => {
		expect(
			migrate('<p>\n\t<a>x</a>\n\t<a>y</a>\n</p>', resolveOptions({ preset: 'jsx' }), '"')
		).toContain('{" "}');
	});

	// Svelte drops comments and `{@const}` before trimming, so it never rendered these spaces.
	const sameLine = resolveOptions({ spaces: { components: 'same-line' } });

	it('migrate adds nothing after a comment at the start', () => {
		const source = '<!-- A comment. -->\n<Modal />';
		expect(migrate(source, sameLine)).toBe(source);
	});

	it('migrate adds nothing after {@const}', () => {
		const source = '{#if ok}\n\t{@const Comp = c}\n\t<Comp />\n{/if}';
		expect(migrate(source, sameLine)).toBe(source);
	});
});

describe('looksMigrated', () => {
	it("is true after migrate has written a {' '}", () => {
		const migrated = migrate(
			'<p>\n\t<a>one</a>\n\t<a>two</a>\n</p>',
			resolveOptions({ preset: 'jsx' })
		);
		expect(looksMigrated(migrated)).toBe(true);
	});

	it('is true inside blocks, and with double quotes', () => {
		expect(looksMigrated('{#if ok}\n\t<a>one</a>{" "}\n\t<a>two</a>\n{/if}')).toBe(true);
	});

	it("is false for {' '} on one line, and for files without one", () => {
		expect(looksMigrated("<p><a>one</a>{' '}<a>two</a></p>")).toBe(false);
		expect(looksMigrated('<p>\n\t<a>one</a>\n\t<a>two</a>\n</p>')).toBe(false);
	});

	it('ignores scripts', () => {
		expect(looksMigrated("<script>\n\tconst s = `{' '}\n`;\n</script>\n<p>a</p>")).toBe(false);
	});
});
