import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { packageVersion, templatesDir } from './assets.js';
import { CONFIG_FILE, type UserConfig } from './config.js';

export type Host = 'github';

export interface InitOptions {
  root?: string;
  host?: Host;
  /** Overwrite files that already exist. */
  force?: boolean;
  title?: string;
}

export interface InitResult {
  created: string[];
  skipped: string[];
  config: UserConfig;
}

interface GitHubRepo {
  owner: string;
  repo: string;
}

/** Parses `git@github.com:owner/repo.git` and `https://github.com/owner/repo(.git)`. */
export function parseGitHubRemote(remote: string): GitHubRepo | undefined {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return match ? { owner: match[1]!, repo: match[2]! } : undefined;
}

/** GitHub Pages serves `<owner>.github.io` repos at `/` and all other repos at `/<repo>/`. */
export function githubPagesLocation({ owner, repo }: GitHubRepo): { basePath: string; url: string } {
  const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
  const basePath = isUserSite ? '/' : `/${repo}/`;
  return { basePath, url: `https://${owner.toLowerCase()}.github.io` };
}

function readGitRemote(root: string): string | undefined {
  try {
    return execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    return undefined;
  }
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

/** Scaffolds a quotebook project: config, an example book and a deploy workflow. */
export async function init(options: InitOptions = {}): Promise<InitResult> {
  const root = path.resolve(options.root ?? process.cwd());
  const created: string[] = [];
  const skipped: string[] = [];

  const write = async (relative: string, content: string) => {
    const target = path.join(root, relative);
    if (!options.force && (await exists(target))) {
      skipped.push(relative);
      return;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    created.push(relative);
  };

  const config: UserConfig = {
    title: options.title ?? 'Quotes',
    description: 'Passages worth keeping.',
    contentDir: 'content',
    outDir: 'dist',
    basePath: '/',
    layout: 'list',
  };

  const remote = readGitRemote(root);
  const repo = remote ? parseGitHubRemote(remote) : undefined;
  if (repo) Object.assign(config, githubPagesLocation(repo));

  await write(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);

  const contentDir = path.join(root, config.contentDir!);
  const hasContent = (await exists(contentDir)) && (await fs.readdir(contentDir)).some((f) => f.endsWith('.md'));
  if (!hasContent) {
    await write(path.join(config.contentDir!, 'meditations.md'), await fs.readFile(path.join(templatesDir, 'example.md'), 'utf8'));
  }

  if ((options.host ?? 'github') === 'github') {
    const version = packageVersion();
    const workflow = (await fs.readFile(path.join(templatesDir, 'github-pages.yml'), 'utf8'))
      .replace('__VERSION__', `^${version}`)
      .replace('__OUT_DIR__', config.outDir!);
    await write('.github/workflows/deploy-quotes.yml', workflow);
  }

  const gitignore = path.join(root, '.gitignore');
  const ignored = (await exists(gitignore)) ? await fs.readFile(gitignore, 'utf8') : '';
  if (!ignored.split(/\r?\n/).some((line) => line.trim().replace(/^\/|\/$/g, '') === config.outDir)) {
    await fs.writeFile(gitignore, `${ignored}${ignored && !ignored.endsWith('\n') ? '\n' : ''}${config.outDir}\n`);
    created.push('.gitignore');
  }

  return { created, skipped, config };
}
