// Server-renders Svelte source to HTML, for comparing what markup renders. Compiled modules are
// loaded from data: URLs, with their imports pointed at absolute file URLs so they still resolve.

import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

const internal = import.meta.resolve('svelte/internal/server');

function toModuleUrl(code: string): string {
	const resolved = code.replaceAll("'svelte/internal/server'", `'${internal}'`);
	return `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`;
}

export interface RenderInput {
	source: string;
	/** Values declared in the component's script, e.g. `{ name: 'N' }`. */
	scope?: Record<string, unknown>;
	/** Child components by name, as Svelte source. They're rendered as-is, not preprocessed. */
	components?: Record<string, string>;
}

/** Renders head and body HTML, with Svelte's hydration comments removed. */
export async function renderHtml({ source, scope = {}, components = {} }: RenderInput) {
	const imports = await Promise.all(
		Object.entries(components).map(async ([name, componentSource]) => {
			const { js } = compile(componentSource, { generate: 'server', filename: `${name}.svelte` });
			return `import ${name} from '${toModuleUrl(js.code)}';`;
		})
	);
	const declarations = Object.entries(scope).map(
		([name, value]) => `let ${name} = ${JSON.stringify(value)};`
	);
	const script = `<script>${[...imports, ...declarations].join('\n')}</script>\n`;

	const { js } = compile(script + source, { generate: 'server', filename: 'Example.svelte' });
	const module = await import(toModuleUrl(js.code));
	const { head, body } = render(module.default);
	return (head + body).replace(/<!--[^]*?-->/g, '');
}
