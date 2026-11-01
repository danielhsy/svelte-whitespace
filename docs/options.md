# Options

Options are passed to the preprocessor in `svelte.config.js`. The Prettier plugin reads them from there too.

```js
svelteWhitespace({
	preset: 'display',
	spaces: { expressions: 'never' },
	classify: { components: { Icon: 'inline', Card: 'block' } },
	include: ['src/**'],
	exclude: ['**/node_modules/**']
});
```

## Classifying whitespace

### Gaps

A **gap** is the place between two neighbouring things, which include two words, a word and a tag, two tags, or a tag and the edge of its parent’s content. A gap may contain whitespace or it is empty.

A gap between two words always renders as one space, whatever it contains, so line breaks inside prose are always safe. Every other gap has a **behaviour**:

| Behaviour   | No whitespace | Whitespace on one line | Whitespace with a line break |
| ----------- | ------------- | ---------------------- | ---------------------------- |
| `always`    | nothing       | one space              | one space                    |
| `same-line` | nothing       | one space              | nothing                      |
| `never`     | nothing       | nothing                | nothing                      |

No behaviour adds spaces that do not exist in the source.

### Kinds

The behaviour comes from what is on each side of the gap:

| Kind          | Includes                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inline`      | inline HTML elements: `a`, `em`, `span`, `button`, `img`, custom elements…                                                                                       |
| `block`       | block-level HTML elements: `div`, `p`, `li`, `td`, `meta`, `link`…; `<svelte:head>`, `<svelte:window>`, `<svelte:body>`, `<svelte:document>`, `<svelte:options>` |
| `components`  | components, `<svelte:element>`, `<svelte:boundary>`, `<slot>`, `{@render}`, `{@html}`                                                                            |
| `expressions` | `{expression}`, `{@const}`, `{@debug}`                                                                                                                           |
| `logic`       | the outside of `{#if}`, `{:else}`, `{/if}` and the other block tags                                                                                              |
| `comments`    | `<!-- … -->`                                                                                                                                                     |
| `edges`       | the start and end of an element’s or block’s content, and of the file                                                                                            |

If the two sides have different behaviours, the stricter one takes precedence, so `never` beats `same-line`, which beats `always`. So under `display`, the line break in `</a>⏎<div>` is removed, because `div` is `block`.

HTML elements are sorted into `inline` and `block` by their default CSS `display` using the same table as Prettier’s HTML formatter. `inline`, `inline-block`, `contents`, `ruby` and `ruby-text` count as `inline`; everything else counts as `block`.

## `preset`

`'display'` (default), `'jsx'` or `'svelte'`.

| Kind          | `svelte` | `display` | `jsx`       |
| ------------- | -------- | --------- | ----------- |
| `inline`      | `always` | `always`  | `same-line` |
| `block`       | `always` | `never`   | `same-line` |
| `components`  | `always` | `always`  | `same-line` |
| `expressions` | `always` | `always`  | `same-line` |
| `logic`       | `always` | `always`  | `same-line` |
| `comments`    | `always` | `always`  | `same-line` |
| `edges`       | `never`  | `never`   | `same-line` |

- **`svelte`** is Svelte’s own behaviour. The preprocessor leaves it entirely to Svelte.
- **`display`** is `svelte` with whitespace next to block-level elements removed. Unlike HTML, it also trims whitespace at the edges of inline elements, as Svelte does: `<b> a </b>` renders `<b>a</b>`.
- **`jsx`** is React’s rule. Whitespace containing a line break disappears next to any tag or `{expression}`; whitespace on one line is kept, including at edges, so `<b> a </b>` keeps its spaces.

## `spaces`

Overrides the preset’s behaviour for individual kinds:

```js
svelteWhitespace({ preset: 'jsx', spaces: { expressions: 'always' } });
```

## `classify`

Specifies whether an element or component counts as `inline` or `block`:

```js
svelteWhitespace({
	classify: {
		elements: { 'my-card': 'block' },
		components: { Card: 'block', 'ui.Icon': 'inline' }
	}
});
```

Components are matched by their name exactly as written in the markup. A component that isn’t listed counts as `components`, which behaves like `inline` in every preset.

If a component is `block` that does not necessarily have to match its CSS, but whitespace next to it should never renders (under `display`). Then the formatter can put it on its own line.

## `include` and `exclude`

Glob patterns, matched against each file’s absolute path and its path relative to the working directory. A file is processed if it matches `include` (or `include` is empty) and doesn’t match `exclude`.

The default `exclude` is `['**/node_modules/**']` so the things in `node_modules` are not processed according to this behaviour.

## Directives

A comment directive names a preset, optionally followed by `kind=behaviour` overrides:

```svelte
<!-- svelte-whitespace: svelte -->
<div class="prose">…</div>

<!-- svelte-whitespace: jsx expressions=always -->
<p>…</p>
```

- Before an element or block, it applies to everything inside it, including its own edges. The whitespace around the element belongs to its parent.
- `<!-- svelte-whitespace-file: … -->`, anywhere in a file, applies to the whole file. A file may have only one.
- A directive’s preset replaces the config’s `spaces` for that region but the config’s `classify` still applies.

## Raw content

The contents of `<pre>`, `<textarea>`, `<script>` and `<style>` are not changed, and neither are attribute values or anything inside `{…}`.

## Prettier plugin

- It accepts all of `prettier-plugin-svelte`’s options, and formats scripts, styles, attributes and expressions according to `prettier-plugin-svelte`.
- `htmlWhitespaceSensitivity` is ignored.
- It looks for `svelte.config.js` (or `.mjs`, `.cjs`, `.ts`) from the formatted file’s folder upwards, and stops with an error if there isn’t one or it doesn’t use `svelteWhitespace()`.
- It never changes what renders. It adds `{' '}` if necessary (and the quotes follow `singleQuote`).
- If two inline tags touch with no whitespace and a line break would add a space, the plugin breaks inside the tag with `</b⏎><i>`.

## Commands

### `svelte-whitespace migrate [--dry-run] [files or folders]`

Rewrites components written for Svelte’s own rule so they render the same under the configured rule. It adds `{' '}` and removes spaces as necessary. Whitespace next to block-level elements is left unchanged.

`--dry-run` shows the changes without writing them. Run Prettier afterwards to tidy the layout.

### `svelte-whitespace check [files or folders]`

Formats each file in memory, with your Prettier config and other Prettier plugins, and confirms that nothing renders differently. It exits with an error and shows where if something would.

Folders are searched for `.svelte` files (the default is the current folder), and files excluded by `include` or `exclude` are skipped.
