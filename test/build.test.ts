import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { build } from '../src/build.js';
import { resolveConfig } from '../src/config.js';

const fixtures = path.resolve(import.meta.dirname, 'fixtures');
let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'quotebook-'));
  await fs.cp(path.join(fixtures, 'content'), path.join(root, 'content'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const read = (file: string) => fs.readFile(path.join(root, 'dist', file), 'utf8');

describe('build', () => {
  it('writes a home page, one page per book and assets', async () => {
    const result = await build({ root, title: 'My Quotes' });

    expect(result.books.map((b) => b.slug)).toEqual(['tao', 'meditations', 'on-writing']);
    expect(result.files.sort()).toEqual(
      [
        '.nojekyll',
        '404.html',
        'assets/slides.js',
        'assets/style.css',
        'index.html',
        'meditations/index.html',
        'on-writing/index.html',
        'tao/index.html',
      ].sort(),
    );

    const home = await read('index.html');
    expect(home).toContain('<title>My Quotes</title>');
    expect(home).toContain('href="/tao/"');
    expect(home).toContain('2 quotes');
    expect(home).toContain('5 quotes · 3 books');
    expect(home).not.toContain('Drafts starting');
  });

  it('renders list and slides layouts', async () => {
    await build({ root });

    const list = await read('meditations/index.html');
    expect(list).toContain('class="layout-list wrap"');
    expect(list).toContain('id="q-2"');
    expect(list).toContain('<cite><em>Meditations</em>, Book X</cite>');
    expect(list).toContain('virtue · action');
    expect(list).not.toContain('slides.js');

    const slides = await read('tao/index.html');
    expect(slides).toContain('class="layout-slides"');
    expect(slides).toMatch(/<script src="\/assets\/slides\.js\?v=[0-9a-f]{8}" defer>/);
    expect(slides).toContain('<cite>Chapter 64</cite>');

    const writing = await read('on-writing/index.html');
    expect(writing).toContain('<h1>On Writing &amp; Clarity</h1>');
    expect(writing).toContain('id="omit"');
  });

  it('links to neighbouring books', async () => {
    await build({ root });
    const middle = await read('meditations/index.html');
    expect(middle).toContain('<a class="prev" href="/tao/">');
    expect(middle).toContain('<a class="next" href="/on-writing/">');
  });

  it('prefixes every link with basePath and uses the site url', async () => {
    await fs.writeFile(
      path.join(root, 'quotebook.config.json'),
      JSON.stringify({ basePath: 'my-repo', url: 'https://me.github.io/' }),
    );
    await build({ root });

    const home = await read('index.html');
    expect(home).toMatch(/href="\/my-repo\/assets\/style\.css\?v=/);
    expect(home).toContain('href="/my-repo/tao/"');
    expect(home).toContain('<link rel="canonical" href="https://me.github.io/my-repo/">');
    expect(home).not.toMatch(/href="\/(?!my-repo)/);

    const book = await read('tao/index.html');
    expect(book).toContain('href="https://me.github.io/my-repo/tao/"');
  });

  it('includes custom CSS', async () => {
    await fs.writeFile(path.join(root, 'theme.css'), ':root { --accent: red; }');
    await build({ root, customCss: 'theme.css' });
    expect(await read('assets/custom.css')).toContain('--accent: red');
    expect(await read('index.html')).toMatch(/href="\/assets\/custom\.css\?v=/);
  });

  it('removes stale files from a previous build', async () => {
    await build({ root });
    await fs.rm(path.join(root, 'content', 'tao.md'));
    await build({ root });
    await expect(fs.access(path.join(root, 'dist', 'tao'))).rejects.toThrow();
  });

  it('rejects duplicate slugs', async () => {
    await fs.writeFile(path.join(root, 'content', 'other.md'), '---\nslug: tao\n---\n> x\n');
    await expect(build({ root })).rejects.toThrow(/Duplicate slug "tao"/);
  });

  it('reports a missing content folder', async () => {
    await expect(build({ root, contentDir: 'nope' })).rejects.toThrow(/Content folder not found/);
  });
});

describe('resolveConfig', () => {
  it('normalizes basePath', () => {
    expect(resolveConfig('/p', { basePath: '' }).basePath).toBe('/');
    expect(resolveConfig('/p', { basePath: 'repo' }).basePath).toBe('/repo/');
    expect(resolveConfig('/p', { basePath: '/a/b//' }).basePath).toBe('/a/b/');
  });

  it('refuses output folders that would wipe the project or content', () => {
    expect(() => resolveConfig('/p', { outDir: '.' })).toThrow(/must not be the project root/);
    expect(() => resolveConfig('/p', { outDir: '..' })).toThrow(/must not be the project root/);
    expect(() => resolveConfig('/p', { outDir: 'content' })).toThrow(/must not contain contentDir/);
  });

  it('reports invalid values', () => {
    expect(() => resolveConfig('/p', { layout: 'grid' as 'list' })).toThrow(/layout/);
  });
});
