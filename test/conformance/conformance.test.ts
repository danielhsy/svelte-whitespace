import { describe, it } from 'vitest';
import { examples } from './examples.js';

// Pending until the preprocessor and the markup printer exist.
describe('conformance (SPEC §10)', () => {
	for (const example of examples) {
		for (const preset of Object.keys(example.expected)) {
			it.todo(`example ${example.id} renders as specified under ${preset}`);
			it.todo(`example ${example.id} keeps its rendering when formatted under ${preset}`);
		}
	}
});
