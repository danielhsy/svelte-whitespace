#!/usr/bin/env node
// The command-line tools (SPEC §7). Not implemented yet.

const USAGE = `Usage: svelte-whitespace <command> [files…]

Commands:
  migrate [--dry-run]  rewrite files so they render the same under the configured rule
  check                check that formatting doesn't change what the rule renders`;

const [command] = process.argv.slice(2);

switch (command) {
	case 'migrate':
	case 'check':
		console.error(`svelte-whitespace: '${command}' is not implemented yet.`);
		process.exit(1);
		break;
	case undefined:
	case '--help':
	case '-h':
		console.log(USAGE);
		break;
	default:
		console.error(`svelte-whitespace: unknown command '${command}'.\n\n${USAGE}`);
		process.exit(1);
}
