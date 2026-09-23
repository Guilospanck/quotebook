#!/usr/bin/env node
import path from 'node:path';
import { cac } from 'cac';
import { packageVersion } from './assets.js';
import { build } from './build.js';
import { dev } from './dev.js';
import { init } from './init.js';

const cli = cac('quotebook');

const bold = (s: string) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s);
const dim = (s: string) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s);

cli
  .command('init [dir]', 'Create a config, an example book and a GitHub Pages workflow')
  .option('--host <host>', 'Hosting target (github)', { default: 'github' })
  .option('--title <title>', 'Site title')
  .option('--force', 'Overwrite existing files')
  .action(async (dir: string | undefined, opts: { host: string; title?: string; force?: boolean }) => {
    if (opts.host !== 'github') throw new Error(`Unsupported host "${opts.host}". Supported: github`);
    const result = await init({ root: dir, host: 'github', title: opts.title, force: opts.force });
    for (const file of result.created) console.log(`  created  ${file}`);
    for (const file of result.skipped) console.log(dim(`  exists   ${file} (use --force to overwrite)`));
    console.log(`
${bold('Next steps')}
  1. Add books as markdown files in ${result.config.contentDir}/
  2. Preview:  npx quotebook dev
  3. Before your first push, on GitHub: Settings → Pages → Source: "GitHub Actions".
     (Otherwise the first deploy fails with "Get Pages site failed"; enable it and re-run.)
  4. Push to main. Every push redeploys the site.
`);
  });

cli
  .command('build [dir]', 'Build the site')
  .option('--out-dir <dir>', 'Output folder (overrides config)')
  .option('--base-path <path>', 'Base path, e.g. /my-repo/ (overrides config)')
  .action(async (dir: string | undefined, opts: { outDir?: string; basePath?: string }) => {
    const start = performance.now();
    const result = await build({ root: dir, outDir: opts.outDir, basePath: opts.basePath });
    const quotes = result.books.reduce((n, b) => n + b.quotes.length, 0);
    const ms = Math.round(performance.now() - start);
    const out = path.relative(process.cwd(), result.config.outPath) || '.';
    const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    console.log(`Built ${count(result.books.length, 'book')}, ${count(quotes, 'quote')} → ${out}/ ${dim(`(${ms}ms)`)}`);
  });

cli
  .command('dev [dir]', 'Serve the site locally and rebuild on changes')
  .option('--port <port>', 'Port', { default: 4321 })
  .option('--host <host>', 'Host', { default: 'localhost' })
  .action(async (dir: string | undefined, opts: { port: number; host: string }) => {
    const server = await dev({
      root: dir,
      port: Number(opts.port),
      host: opts.host,
      onRebuild: (err) =>
        err ? console.error(`\x1b[31m${err.message}\x1b[39m`) : console.log(dim(`rebuilt ${new Date().toLocaleTimeString()}`)),
    });
    console.log(`${bold('quotebook')} running at ${server.url}`);
  });

cli.help();
cli.version(packageVersion());

try {
  cli.parse(process.argv, { run: false });
  if (!cli.matchedCommand) {
    if (cli.options.help || cli.options.version) process.exit(0);
    cli.outputHelp();
  } else {
    await cli.runMatchedCommand();
  }
} catch (err) {
  console.error(`\x1b[31merror\x1b[39m ${(err as Error).message}`);
  process.exit(1);
}
