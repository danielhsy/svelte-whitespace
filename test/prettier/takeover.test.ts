// Our plugin must actually be the printer Prettier uses, and must leave everything other than
// markup whitespace to prettier-plugin-svelte.

import * as prettier from 'prettier';
import { describe, expect, it, vi } from 'vitest';
import { createPlugin } from '../../src/prettier/index.js';
import { upstream } from '../../src/prettier/upstream.js';

const plugin = createPlugin();

describe('prettier plugin takeover', () => {
	it('is the printer Prettier uses, even when listed after upstream', async () => {
		const print = vi.spyOn(plugin.printers['svelte-ast'], 'print');
		await prettier.format('<p>x</p>', { parser: 'svelte', plugins: [upstream, plugin] });
		expect(print).toHaveBeenCalled();
		print.mockRestore();
	});

	it('formats scripts, styles, attributes and expressions as prettier-plugin-svelte does', async () => {
		const source = `<script lang="ts">let x:number=1</script>
<p class="a" onclick={()=>x++} {...rest}>{x+1} {@html "<b>"}</p>
<style>p{color:red}</style>
`;
		const ours = await prettier.format(source, { parser: 'svelte', plugins: [plugin] });
		const theirs = await prettier.format(source, { parser: 'svelte', plugins: [upstream] });
		expect(ours).toBe(theirs);
	});
});
