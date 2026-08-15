/**
 * Serve the static web export (`dist/`) on a fixed localhost URL, no dependencies.
 *
 * Run with: npm run preview
 * (which builds `dist/` with EXPO_PUBLIC_DEMO=1 first, then runs this)
 *
 * Why not `expo start --web` for reviewers: that needs a live Metro dev server,
 * an auto-opened browser and a free port — any of which can fail silently on a
 * machine that isn't the dev's. This serves the already-built, already-working
 * `dist/` export instead, so there's nothing left to compile or bundle at
 * review time.
 *
 * expo web.output is "single" (see app.json), so there is exactly one
 * index.html and all routing happens client-side — any unmatched path falls
 * back to it rather than 404ing.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url).pathname;
// A dedicated env var, not `PORT` — some hosting/CI environments (this one
// included) already export `PORT` for their own listener, and picking that up
// silently would collide with it instead of the intended dev machine port.
const PORT = Number(process.env.PREVIEW_PORT) || 4300;
const HOST = '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

try {
  await stat(join(ROOT, 'index.html'));
} catch {
  console.error(
    `\nNo build found at dist/index.html.\nRun "npm run preview" (not this script directly) so the export happens first.\n`,
  );
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}`);
    // Strip query/hash and reject path traversal before touching the filesystem.
    let safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (safePath.endsWith('/')) safePath += 'index.html';

    let filePath = join(ROOT, safePath);
    let body;
    try {
      body = await readFile(filePath);
    } catch {
      // SPA fallback: any unmatched route (e.g. a deep link into a tab) still
      // gets the app shell, which then resolves the route client-side.
      filePath = join(ROOT, 'index.html');
      body = await readFile(filePath);
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error');
    console.error(err);
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`\nThe Stack — reviewer preview\n`);
  console.log(`  ${url}\n`);
  console.log('Open that URL in a browser. Ctrl+C to stop.\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use. Set PREVIEW_PORT to something else, e.g.:\n  PREVIEW_PORT=4301 npm run preview\n`,
    );
    process.exit(1);
  }
  throw err;
});
