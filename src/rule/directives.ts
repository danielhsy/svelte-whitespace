// Comment directives (SPEC §6): `<!-- svelte-whitespace: <preset> [kind=behaviour …] -->` applies
// to the next element or block; `<!-- svelte-whitespace-file: … -->` applies to the whole file.

import { KINDS, PRESET_NAMES, type Behaviour, type Kind, type PresetName } from './options.js';

export interface Directive {
	scope: 'node' | 'file';
	preset: PresetName;
	spaces: Partial<Record<Kind, Behaviour>>;
}

const PREFIX = /^\s*svelte-whitespace(-file)?\s*:/;
const BEHAVIOURS: readonly string[] = ['always', 'same-line', 'never'];

/** Reads a comment's text. Returns null if it isn't a directive; throws if it's a malformed one. */
export function parseDirective(comment: string): Directive | null {
	const prefix = PREFIX.exec(comment);
	if (!prefix) return null;

	const fail = (problem: string): never => {
		throw new Error(`svelte-whitespace: ${problem} in directive <!--${comment}-->`);
	};
	const [preset, ...overrides] = comment.slice(prefix[0].length).trim().split(/\s+/);
	if (!preset || !(PRESET_NAMES as readonly string[]).includes(preset)) {
		fail(`expected a preset (${PRESET_NAMES.join(', ')})`);
	}

	const spaces: Partial<Record<Kind, Behaviour>> = {};
	for (const override of overrides) {
		const [kind, behaviour, ...rest] = override.split('=');
		if (rest.length || !kind || !behaviour) fail(`expected kind=behaviour, not '${override}'`);
		if (!(KINDS as readonly string[]).includes(kind!)) fail(`unknown kind '${kind}'`);
		if (!BEHAVIOURS.includes(behaviour!)) fail(`unknown behaviour '${behaviour}'`);
		spaces[kind as Kind] = behaviour as Behaviour;
	}

	return { scope: prefix[1] ? 'file' : 'node', preset: preset as PresetName, spaces };
}
