# svelte-whitespace

This repository includes a preprocessor and a Prettier plugin with configurations for how to handle and collapse whitespaces. The behaviour in Svelte is different from that in JSX; this is configurable here.

For example, Svelte renders a line break between two tags as a space, while JSX doesn’t. The preprocessor includes the rule, and it is combined with the Prettier plugin so it adds `{' '}` into a Svelte source just like it does with JSX.

## Setup

```sh
npm install --save-dev svelte-whitespace
```

Add the preprocessor to `svelte.config.js`, after any preprocessor that produces Svelte markup (such as mdsvex):

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { svelteWhitespace } from 'svelte-whitespace';

export default {
	preprocess: [vitePreprocess(), svelteWhitespace()]
};
```

Then use the Prettier plugin in place of `prettier-plugin-svelte`:

```json
{
	"plugins": ["svelte-whitespace/prettier"],
	"overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

The plugin also reads its options from `svelte.config.js`. If that file does not exist, it stops with an error.

## Presets

| Preset              | Whitespace renders as a space…                                     | `Hello⏎<em>world</em>` |
| ------------------- | ------------------------------------------------------------------ | ---------------------- |
| `display` (default) | except at the edges of an element and next to block-level elements | `Hello <em>world</em>` |
| `jsx`               | only if it’s on one line, as in React                              | `Hello<em>world</em>`  |
| `svelte`            | as Svelte does it                                                  | `Hello <em>world</em>` |

Under `display`, the stray spaces between block-level elements disappear: between `<div>`s and `<li>`s, or the `<meta>` and `<link>` tags in `<svelte:head>`. Text does not change.

Under `jsx`, a line break next to a tag or `{expression}` is removed, so if a space needs to be kept it must be written as `{' '}` as with React. The formatter will insert this automatically.

```js
svelteWhitespace({ preset: 'jsx' });
```

Each preset can be adjusted, and components can be marked as block-level. See [options](docs/options.md) and the [examples](docs/examples.md).

## For one element or file

A comment before an element or block switches the rule for everything inside it:

```svelte
<!-- svelte-whitespace: svelte -->
<div class="prose">…</div>
```

`<!-- svelte-whitespace-file: jsx -->`, anywhere in a file, switches the whole file.

## Commands

- `npx svelte-whitespace migrate [--dry-run] [files or folders]` rewrites existing components so they render the same under the configured rule, adding `{' '}` where a space would otherwise disappear. Run it once, then run Prettier.
- `npx svelte-whitespace check [files or folders]` formats each file in memory and confirms that nothing renders differently. It exits with an error if something would, which is useful in CI.

## Credits

The Prettier plugin builds on [prettier-plugin-svelte](https://github.com/sveltejs/prettier-plugin-svelte) (MIT). It reuses that plugin’s parser, options and printing, and replaces how whitespace in markup is printed. Files derived from it keep its licence notice.

## Licence

Apache-2.0
