# svelte-whitespace

This repository includes a preprocessor and a Prettier plugin with configurations for how to handle and collapse whitespaces. The behaviour in Svelte is different from that in JSX; this is configurable here.

For example, Svelte renders a line break between two tags as a space, while JSX doesn’t. The preprocessor includes the rule, and it is combined with the Prettier plugin so it adds `{' '}` into a Svelte source just like it does with JSX.

## Credits

The Prettier plugin builds on [prettier-plugin-svelte](https://github.com/sveltejs/prettier-plugin-svelte) (MIT). It reuses that plugin’s parser, options and printing, and replaces how whitespace in markup is printed. Files derived from it keep its licence notice.
