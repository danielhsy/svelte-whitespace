// docs/examples.md is generated from the conformance examples, so the documented examples are
// exactly the tested ones. `npm run docs` regenerates it; this test fails if it's out of date.

import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { examples } from '../conformance/examples.js';

const PATH = 'docs/examples.md';

function examplesMarkdown(): string {
	// Each example is a list item: its source, then what it renders under each preset.
	const items = examples.map((example) => {
		// The default preset first.
		const rows = (['display', 'jsx'] as const)
			.filter((preset) => example.expected[preset] !== undefined)
			.map(
				(preset) => `| \`${preset}\` | ${rendered(example.source, example.expected[preset]!)} |`
			);
		const body = [
			...example.source.split('\n'),
			'```',
			'',
			'| Preset | Renders |',
			'| --- | --- |',
			...rows
			// Two spaces, the width of `* `: a tab would add two spaces to every line of the code.
		].map((line) => (line === '' ? '' : `  ${line}`));
		return ['* ```svelte', ...body].join('\n');
	});
	return [
		'# Examples',
		'',
		'These are tests generated from `test/conformance/examples.ts` by `npm run docs`. Each is rendered with Svelte under each preset and formatted with the Prettier plugin at several widths.',
		'',
		items.join('\n\n'),
		''
	].join('\n');
}

/** A table cell can't hold a line break, so multi-line output is only shown when unchanged. */
function rendered(source: string, html: string): string {
	if (!html.includes('\n')) return `\`${html}\``;
	if (html === source) return '[_Unchanged_]';
	throw new Error(`Can't show multi-line output in a table: ${JSON.stringify(html)}`);
}

it('docs/examples.md is up to date', () => {
	const generated = examplesMarkdown();
	if (process.env.UPDATE_DOCS) writeFileSync(PATH, generated);
	expect(readFileSync(PATH, 'utf8')).toBe(generated);
});
