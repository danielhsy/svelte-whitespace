// The examples from SPEC.md §10, as data. Each one is checked against the preprocessor (what it
// renders) and the Prettier plugin (formatting must not change what it renders).

import type { PresetName } from '../../src/rule/index.js';

export interface Example {
	/** The example's number in SPEC.md §10. */
	id: number;
	source: string;
	/** Rendered HTML (comments stripped) under each preset tested. */
	expected: Partial<Record<PresetName, string>>;
	/** Values for the component's script: props and stand-in child components. */
	scope?: Record<string, unknown>;
	/** Stand-in child components, as Svelte source. */
	components?: Record<string, string>;
}

const both = (html: string) => ({ jsx: html, display: html });

export const examples: Example[] = [
	{
		id: 1,
		source: '<p>\n\t<span>a</span>\n\t<span>b</span>\n</p>',
		expected: {
			jsx: '<p><span>a</span><span>b</span></p>',
			display: '<p><span>a</span> <span>b</span></p>'
		}
	},
	{
		id: 2,
		source: '<p>\n\tHello\n\t<em>world</em>\n\tagain\n</p>',
		expected: {
			jsx: '<p>Hello<em>world</em>again</p>',
			display: '<p>Hello <em>world</em> again</p>'
		}
	},
	{
		id: 3,
		source: '<p>Hello <em>world</em> again</p>',
		expected: both('<p>Hello <em>world</em> again</p>')
	},
	{
		id: 4,
		source: '<p>one\n\ttwo  three</p>',
		expected: both('<p>one two three</p>')
	},
	{
		id: 5,
		source: '<a>x</a> <b>y</b>',
		expected: both('<a>x</a> <b>y</b>')
	},
	{
		id: 6,
		source: '<svelte:head>\n\t<meta name="a" />\n\t<meta name="b" />\n</svelte:head>',
		expected: both('<meta name="a"/><meta name="b"/>')
	},
	{
		id: 7,
		source: "<p>a{' '}\n\t<b>b</b></p>",
		expected: both('<p>a <b>b</b></p>')
	},
	{
		id: 8,
		source: '<p><b>a</b>&#32;<b>b</b></p>',
		expected: both('<p><b>a</b> <b>b</b></p>')
	},
	{
		id: 9,
		source: '<pre>\n  x\n</pre>',
		expected: both('<pre>\n  x\n</pre>')
	},
	{
		id: 10,
		source: '<p>\n\tHello\n\t{name}\n</p>',
		scope: { name: 'N' },
		expected: { jsx: '<p>HelloN</p>', display: '<p>Hello N</p>' }
	},
	{
		id: 11,
		source: '<p>\n\tA\n\t{#if ok}\n\t\t<b>B</b>\n\t{/if}\n\tC\n</p>',
		scope: { ok: true },
		expected: { jsx: '<p>A<b>B</b>C</p>', display: '<p>A <b>B</b> C</p>' }
	},
	{
		id: 12,
		source: '<p><b> a </b>b</p>',
		expected: { jsx: '<p><b> a </b>b</p>', display: '<p><b>a</b>b</p>' }
	},
	{
		id: 13,
		source: '<div>a</div> <div>b</div>',
		expected: { jsx: '<div>a</div> <div>b</div>', display: '<div>a</div><div>b</div>' }
	},
	{
		id: 14,
		source: '<p>\n\tPosted by {author}\n\t{#if date}\n\t\ton <time>{date}</time>\n\t{/if}\n</p>',
		scope: { author: 'A', date: 'D' },
		expected: {
			jsx: '<p>Posted by Aon <time>D</time></p>',
			display: '<p>Posted by A on <time>D</time></p>'
		}
	},
	{
		id: 15,
		source: '<p>\n\t<Icon />\n\tSave\n</p>',
		components: { Icon: '<i></i>' },
		expected: { jsx: '<p><i></i>Save</p>', display: '<p><i></i> Save</p>' }
	},
	{
		id: 16,
		source: '<!-- svelte-whitespace: svelte -->\n<p>\n\t<b>a</b>\n\t<b>b</b>\n</p>',
		expected: both('<p><b>a</b> <b>b</b></p>')
	}
];
