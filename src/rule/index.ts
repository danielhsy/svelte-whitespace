// The shared rule: the single source of truth for both the preprocessor and the Prettier plugin.

export * from './options.js';
export { analyse, type Gap, type Side } from './gaps.js';
export { parseDirective, type Directive } from './directives.js';
export { defaultClassification } from './display.js';
