// `beam project generate web-client` (CLI 7.2.3) emits the same `export type X = {...}` once per
// endpoint that uses it, which TypeScript rejects as duplicate identifiers. Keep the first of each.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/beamable/clients/types/index.ts', import.meta.url);
const source = readFileSync(file, 'utf8');
const seen = new Set();
const result = source.replace(/export type (\w+) = \{[\s\S]*?\n\};\n*/g, (block, name) => {
  if (seen.has(name)) return '';
  seen.add(name);
  return block.trimEnd() + '\n\n';
});
writeFileSync(file, result.trimEnd() + '\n');
