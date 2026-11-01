// A stand-in for a project's config: what svelteWhitespace({ preset: 'display' }) attaches.
export default {
	preprocess: [
		{
			name: 'svelte-whitespace',
			[Symbol.for('svelte-whitespace.options')]: {
				preset: 'display',
				spaces: {
					inline: 'always',
					block: 'never',
					components: 'always',
					expressions: 'always',
					logic: 'always',
					comments: 'always',
					edges: 'never'
				},
				classify: { elements: new Map(), components: new Map() },
				include: [],
				exclude: ['**/node_modules/**']
			}
		}
	]
};
