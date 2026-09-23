import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { build, type BuildOptions } from './build.js';
import { CONFIG_FILE } from './config.js';

export interface DevOptions extends BuildOptions {
  port?: number;
  host?: string;
  onRebuild?: (error?: Error) => void;
}

export interface DevServer {
  url: string;
  close: () => Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const RELOAD_PATH = '/__quotebook/reload';
const RELOAD_SCRIPT = `<script>new EventSource('${RELOAD_PATH}').onmessage = () => location.reload();</script>`;

/** Builds the site, serves it locally, and rebuilds + live-reloads when content or config changes. */
export async function dev(options: DevOptions = {}): Promise<DevServer> {
  const { port = 4321, host = 'localhost', onRebuild, ...buildOptions } = options;
  const root = path.resolve(buildOptions.root ?? process.cwd());
  let result = await build({ ...buildOptions, root });
  const clients = new Set<http.ServerResponse>();

  const server = http.createServer((req, res) => {
    const { basePath, outPath } = result.config;
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);

    if (pathname === RELOAD_PATH) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (!pathname.startsWith(basePath)) {
      if (pathname === '/' || `${pathname}/` === basePath) {
        res.writeHead(302, { Location: basePath }).end();
        return;
      }
      return sendNotFound(res, outPath);
    }

    let file = path.join(outPath, pathname.slice(basePath.length));
    if (file !== outPath && !file.startsWith(outPath + path.sep)) return sendNotFound(res, outPath);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${pathname}/` }).end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) return sendNotFound(res, outPath);
    send(res, 200, file);
  });

  const send = (res: http.ServerResponse, status: number, file: string) => {
    const ext = path.extname(file);
    let body: string | Buffer = fs.readFileSync(file);
    if (ext === '.html') body = body.toString('utf8').replace('</body>', `${RELOAD_SCRIPT}\n</body>`);
    res.writeHead(status, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  };

  const sendNotFound = (res: http.ServerResponse, outPath: string) => {
    const file = path.join(outPath, '404.html');
    if (fs.existsSync(file)) send(res, 404, file);
    else res.writeHead(404).end('Not found');
  };

  let timer: NodeJS.Timeout | undefined;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        result = await build({ ...buildOptions, root });
        for (const client of clients) client.write('data: reload\n\n');
        onRebuild?.();
      } catch (err) {
        onRebuild?.(err as Error);
      }
    }, 80);
  };

  const watchers = [
    fs.watch(result.config.contentPath, { recursive: true }, rebuild),
    fs.watch(root, (_event, filename) => {
      if (filename === CONFIG_FILE || filename === result.config.customCss) rebuild();
    }),
  ];

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  return {
    url: `http://${host}:${port}${result.config.basePath}`,
    close: async () => {
      clearTimeout(timer);
      watchers.forEach((w) => w.close());
      for (const client of clients) client.end();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
