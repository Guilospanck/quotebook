import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { build } from '../src/build.js';
import { githubPagesLocation, init, parseGitHubRemote } from '../src/init.js';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'quotebook-init-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('parseGitHubRemote', () => {
  it.each([
    ['git@github.com:alice/quotes.git', { owner: 'alice', repo: 'quotes' }],
    ['https://github.com/alice/quotes', { owner: 'alice', repo: 'quotes' }],
    ['https://github.com/alice/alice.github.io.git\n', { owner: 'alice', repo: 'alice.github.io' }],
    ['https://gitlab.com/alice/quotes.git', undefined],
  ])('%s', (remote, expected) => {
    expect(parseGitHubRemote(remote)).toEqual(expected);
  });
});

describe('githubPagesLocation', () => {
  it('serves user sites at the root and project sites under the repo name', () => {
    expect(githubPagesLocation({ owner: 'Alice', repo: 'alice.github.io' })).toEqual({ basePath: '/', url: 'https://alice.github.io' });
    expect(githubPagesLocation({ owner: 'Alice', repo: 'quotes' })).toEqual({ basePath: '/quotes/', url: 'https://alice.github.io' });
  });
});

describe('init', () => {
  it('scaffolds a project that builds', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:alice/quotes.git'], { cwd: root });

    const result = await init({ root, title: 'Alice' });
    expect(result.created.sort()).toEqual(
      ['.github/workflows/deploy-quotes.yml', '.gitignore', 'content/meditations.md', 'quotebook.config.json'].sort(),
    );

    const config = JSON.parse(await fs.readFile(path.join(root, 'quotebook.config.json'), 'utf8'));
    expect(config).toMatchObject({ title: 'Alice', basePath: '/quotes/', url: 'https://alice.github.io' });

    const workflow = await fs.readFile(path.join(root, '.github/workflows/deploy-quotes.yml'), 'utf8');
    expect(workflow).toMatch(/npx --yes quotebook@\^\d+\.\d+\.\d+ build/);
    expect(workflow).toContain('path: dist');
    expect(workflow).not.toContain('__');

    const { books } = await build({ root });
    expect(books[0]!.quotes).toHaveLength(3);
  });

  it('does not overwrite existing files unless forced', async () => {
    await fs.writeFile(path.join(root, 'quotebook.config.json'), '{"title":"Mine"}');
    await fs.writeFile(path.join(root, '.gitignore'), 'node_modules\ndist/\n');

    const result = await init({ root });
    expect(result.skipped).toEqual(['quotebook.config.json']);
    expect(result.created).not.toContain('.gitignore');
    expect(await fs.readFile(path.join(root, 'quotebook.config.json'), 'utf8')).toBe('{"title":"Mine"}');

    const forced = await init({ root, force: true });
    expect(forced.created).toContain('quotebook.config.json');
  });

  it('skips the example book when content already exists', async () => {
    await fs.mkdir(path.join(root, 'content'));
    await fs.writeFile(path.join(root, 'content', 'mine.md'), '> Mine');
    const result = await init({ root });
    expect(result.created).not.toContain('content/meditations.md');
  });
});
