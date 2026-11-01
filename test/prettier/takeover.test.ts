// Our plugin must actually be the printer Prettier uses, and until the markup printer exists it
// must format exactly as prettier-plugin-svelte does.

import * as prettier from 'prettier';
import { upstream } from '../../src/prettier/upstream.js';
import { describe, expect, it, vi } from 'vitest';
import plugin from '../../src/prettier/index.js';

const source = `<script>let x = 1</script>
<p>Hello <em>world</em> {x}</p>
{#if x}<a href="/a">a</a> <a href="/b">b</a>{/if}
`;

describe('prettier plugin takeover', () => {
	it('is the printer Prettier uses, even when listed after upstream', async () => {
		const print = vi.spyOn(plugin.printers['svelte-ast'], 'print');
		await prettier.format(source, { parser: 'svelte', plugins: [upstream, plugin] });
		expect(print).toHaveBeenCalled();
		print.mockRestore();
	});

	it('formats exactly as prettier-plugin-svelte does for now', async () => {
		const ours = await prettier.format(source, { parser: 'svelte', plugins: [plugin] });
		const theirs = await prettier.format(source, { parser: 'svelte', plugins: [upstream] });
		expect(ours).toBe(theirs);
	});
});
