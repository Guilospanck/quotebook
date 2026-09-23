import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const CONFIG_FILE = 'quotebook.config.json';

const configSchema = z.object({
  /** Site title, shown on the home page and in the browser tab. */
  title: z.string().default('Quotes'),
  description: z.string().default(''),
  /** Folder of markdown files, relative to the project root. */
  contentDir: z.string().default('content'),
  /** Build output folder, relative to the project root. */
  outDir: z.string().default('dist'),
  /** Path the site is served from, e.g. `/my-repo/` for GitHub project pages. */
  basePath: z.string().default('/'),
  /** Site origin (optional), e.g. `https://you.github.io`. Used for canonical and Open Graph URLs. */
  url: z.string().url().optional(),
  /** Default layout for book pages; books can override it in frontmatter. */
  layout: z.enum(['list', 'slides']).default('list'),
  lang: z.string().default('en'),
  /** Path to a CSS file appended after the default styles. */
  customCss: z.string().optional(),
});

export type UserConfig = z.input<typeof configSchema>;

export interface ResolvedConfig extends z.output<typeof configSchema> {
  /** Absolute project root. */
  root: string;
  /** Absolute content directory. */
  contentPath: string;
  /** Absolute output directory. */
  outPath: string;
}

export function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

/** True when `target` is `dir` itself or somewhere inside it. */
function isWithin(dir: string, target: string): boolean {
  const rel = path.relative(dir, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

export function resolveConfig(root: string, input: UserConfig = {}): ResolvedConfig {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid quotebook config:\n${issues.join('\n')}`);
  }
  const config = parsed.data;
  const absRoot = path.resolve(root);
  const outPath = path.resolve(absRoot, config.outDir);
  if (isWithin(outPath, absRoot)) {
    throw new Error(`outDir "${config.outDir}" must not be the project root or one of its parents.`);
  }
  const contentPath = path.resolve(absRoot, config.contentDir);
  if (isWithin(outPath, contentPath)) {
    throw new Error(`outDir "${config.outDir}" must not contain contentDir "${config.contentDir}"; it is wiped on every build.`);
  }
  return {
    ...config,
    basePath: normalizeBasePath(config.basePath),
    url: config.url?.replace(/\/+$/, ''),
    root: absRoot,
    contentPath,
    outPath,
  };
}

/** Reads `quotebook.config.json` from `root` (if present) and merges `overrides` on top. */
export async function loadConfig(root = process.cwd(), overrides: UserConfig = {}): Promise<ResolvedConfig> {
  let fileConfig: UserConfig = {};
  const file = path.join(root, CONFIG_FILE);
  try {
    fileConfig = JSON.parse(await fs.readFile(file, 'utf8')) as UserConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Could not read ${file}: ${(err as Error).message}`);
    }
  }
  const defined = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined));
  return resolveConfig(root, { ...fileConfig, ...defined });
}
