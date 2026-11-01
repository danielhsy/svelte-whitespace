// Options and presets, as specified in SPEC.md §3 and §5.

/** What whitespace in a gap renders as (SPEC §3.1). */
export type Behaviour = 'always' | 'same-line' | 'never';

/** The kinds of side a gap can have (SPEC §3.2). Words have no kind. */
export const KINDS = [
	'inline',
	'block',
	'components',
	'expressions',
	'logic',
	'comments',
	'edges'
] as const;
export type Kind = (typeof KINDS)[number];

export type Spaces = Record<Kind, Behaviour>;

export const PRESET_NAMES = ['jsx', 'display', 'svelte'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

/** SPEC §5.2. Each preset builds on the one before: svelte → display → jsx. */
export const PRESETS: Record<PresetName, Spaces> = {
	jsx: {
		inline: 'same-line',
		block: 'same-line',
		components: 'same-line',
		expressions: 'same-line',
		logic: 'same-line',
		comments: 'same-line',
		edges: 'same-line'
	},
	display: {
		inline: 'always',
		block: 'never',
		components: 'always',
		expressions: 'always',
		logic: 'always',
		comments: 'always',
		edges: 'never'
	},
	svelte: {
		inline: 'always',
		block: 'always',
		components: 'always',
		expressions: 'always',
		logic: 'always',
		comments: 'always',
		edges: 'never'
	}
};

export type Classification = 'inline' | 'block';

export interface Options {
	preset?: PresetName;
	spaces?: Partial<Spaces>;
	classify?: {
		elements?: Record<string, Classification>;
		components?: Record<string, Classification>;
	};
	include?: string[];
	exclude?: string[];
}

export interface ResolvedOptions {
	preset: PresetName;
	spaces: Spaces;
	classify: {
		elements: Map<string, Classification>;
		components: Map<string, Classification>;
	};
	include: string[];
	exclude: string[];
}

const BEHAVIOURS: readonly Behaviour[] = ['always', 'same-line', 'never'];
const CLASSIFICATIONS: readonly Classification[] = ['inline', 'block'];

/** Validates user options (they come from plain JavaScript config) and fills in defaults. */
export function resolveOptions(options: Options = {}): ResolvedOptions {
	const preset = options.preset ?? 'jsx';
	if (!PRESET_NAMES.includes(preset)) {
		throw new Error(
			`svelte-whitespace: unknown preset ${JSON.stringify(preset)}; expected one of ${PRESET_NAMES.join(', ')}`
		);
	}

	const spaces = { ...PRESETS[preset] };
	for (const [kind, behaviour] of Object.entries(options.spaces ?? {})) {
		if (!(KINDS as readonly string[]).includes(kind)) {
			throw new Error(
				`svelte-whitespace: unknown kind ${JSON.stringify(kind)} in spaces; expected one of ${KINDS.join(', ')}`
			);
		}
		if (!BEHAVIOURS.includes(behaviour)) {
			throw new Error(
				`svelte-whitespace: unknown behaviour ${JSON.stringify(behaviour)} for ${kind}; expected one of ${BEHAVIOURS.join(', ')}`
			);
		}
		spaces[kind as Kind] = behaviour;
	}

	return {
		preset,
		spaces,
		classify: {
			elements: classificationMap('elements', options.classify?.elements),
			components: classificationMap('components', options.classify?.components)
		},
		include: options.include ?? [],
		exclude: options.exclude ?? ['**/node_modules/**']
	};
}

function classificationMap(
	field: string,
	entries: Record<string, Classification> | undefined
): Map<string, Classification> {
	const map = new Map<string, Classification>();
	for (const [name, classification] of Object.entries(entries ?? {})) {
		if (!CLASSIFICATIONS.includes(classification)) {
			throw new Error(
				`svelte-whitespace: classify.${field}.${name} must be 'inline' or 'block', not ${JSON.stringify(classification)}`
			);
		}
		map.set(name, classification);
	}
	return map;
}

const STRICTNESS: Record<Behaviour, number> = { always: 0, 'same-line': 1, never: 2 };

/** SPEC §3.3: a gap takes the strictest of its sides' behaviours. */
export function strictest(a: Behaviour, b: Behaviour): Behaviour {
	return STRICTNESS[a] >= STRICTNESS[b] ? a : b;
}
