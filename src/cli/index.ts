#!/usr/bin/env node
// The command-line tools (SPEC §7).

import { globSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { isIncluded } from '../preprocess/index.js';
import { loadOptions } from '../prettier/config.js';
import { checkFile, quoteFor } from './check.js';
import { migrate } from './migrate.js';

const files = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;

const USAGE = `Usage: svelte-whitespace <command> [files or folders…]

Commands:
  migrate [--dry-run]  rewrite files so they render the same under the configured rule
  check                check that formatting doesn't change what the rule renders

Folders are searched for .svelte files; the default is the current folder. Options are read
from svelte.config.js, as the Prettier plugin reads them.`;

const args = process.argv.slice(2);
const command = args[0];
const dryRun = args.includes('--dry-run');
const paths = args.slice(1).filter((arg) => !arg.startsWith('--'));

/** Expands folders into the .svelte files the preprocessor would process. */
async function svelteFiles(paths: string[]): Promise<string[]> {
	const files = (paths.length ? paths : ['.']).flatMap((path) =>
		statSync(path).isDirectory()
			? globSync('**/*.svelte', { cwd: path, exclude: (f) => f === 'node_modules' }).map((f) =>
					join(path, f)
				)
			: [path]
	);
	const included: string[] = [];
	for (const file of files) {
		if (isIncluded(file, await loadOptions(file))) included.push(file);
	}
	return included;
}

async function runMigrate() {
	const list = await svelteFiles(paths);
	let changed = 0;
	for (const file of list) {
		const source = await readFile(file, 'utf8');
		const migrated = migrate(source, await loadOptions(file), await quoteFor(file));
		if (migrated === source) continue;
		changed++;
		if (!dryRun) {
			await writeFile(file, migrated);
			console.log(`Updated ${relative('.', file)}`);
			continue;
		}
		// Migration never adds or removes lines, so a line-by-line comparison is a full diff.
		const before = source.split('\n');
		const after = migrated.split('\n');
		console.log(`--- ${relative('.', file)}`);
		before.forEach((line, i) => {
			if (line !== after[i]) console.log(`${i + 1}\n- ${line}\n+ ${after[i]}`);
		});
	}
	const verb = dryRun ? 'would change' : 'changed';
	console.log(`\n${changed} of ${files(list.length)} ${verb}.`);
	if (!dryRun && changed > 0) console.log('Run Prettier afterwards to tidy the layout.');
}

async function runCheck() {
	const list = await svelteFiles(paths);
	let failed = 0;
	for (const file of list) {
		const result = await checkFile(file, await loadOptions(file));
		if (!result.difference) continue;
		failed++;
		console.log(`✗ ${relative('.', file)}`);
		console.log(`  before: ${JSON.stringify(result.difference.before)}`);
		console.log(`  after:  ${JSON.stringify(result.difference.after)}`);
	}
	if (failed === 0) {
		console.log(`Checked ${files(list.length)}: formatting doesn't change what renders.`);
	} else {
		console.log(`\n${failed} of ${files(list.length)} would render differently after formatting.`);
		process.exitCode = 1;
	}
}

try {
	switch (command) {
		case 'migrate':
			await runMigrate();
			break;
		case 'check':
			await runCheck();
			break;
		case undefined:
		case '--help':
		case '-h':
			console.log(USAGE);
			break;
		default:
			console.error(`svelte-whitespace: unknown command '${command}'.\n\n${USAGE}`);
			process.exitCode = 1;
	}
} catch (error) {
	console.error((error as Error).message);
	process.exitCode = 1;
}
