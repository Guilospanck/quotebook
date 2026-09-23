import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Both `src/*.ts` and bundled `dist/*.js` sit one level below the package root.
const packageRoot = new URL('../', import.meta.url);

export const assetsDir = fileURLToPath(new URL('assets/', packageRoot));
export const templatesDir = fileURLToPath(new URL('templates/', packageRoot));

export function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8')) as { version: string };
  return pkg.version;
}
