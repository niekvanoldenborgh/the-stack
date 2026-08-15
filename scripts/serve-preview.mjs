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
 *
 * The root path ("/") serves a phone-bezel wrapper, not the app directly: a
 * non-technical reviewer opens the URL and sees a phone-shaped mobile POV
 * with no DevTools required to simulate one. The app itself is unchanged —
 * `dist/` is served byte-for-byte at APP_PATH, and the wrapper just embeds it
 * in a fixed-width iframe. This script is dev/demo-only tooling; it never
 * touches `dist/` output or anything shipped in production.
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

// Marker path the phone-frame wrapper points its iframe at. Asset URLs in
// `dist/index.html` are root-absolute (e.g. "/_expo/static/..."), so serving
// the same index.html under this path instead of "/" doesn't break anything.
const APP_PATH = '/__preview-app__/';
// iPhone 14/15-ish CSS viewport — a stand-in mobile width, not a claim about
// any specific device.
const DEVICE_WIDTH = 393;
const DEVICE_HEIGHT = 852;

function phoneFrameHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Stack — reviewer preview</title>
    <style>
      html, body {
        height: 100%;
        margin: 0;
        background: #0A0A0C;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .label {
        color: #8A8A93;
        font-size: 13px;
        letter-spacing: 0.02em;
      }
      .frame {
        width: ${DEVICE_WIDTH + 24}px;
        height: ${DEVICE_HEIGHT + 24}px;
        padding: 12px;
        box-sizing: border-box;
        background: #1C1C1F;
        border-radius: 48px;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
        position: relative;
      }
      .notch {
        position: absolute;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        width: 120px;
        height: 24px;
        background: #1C1C1F;
        border-radius: 0 0 16px 16px;
        z-index: 1;
      }
      iframe {
        width: ${DEVICE_WIDTH}px;
        height: ${DEVICE_HEIGHT}px;
        border: 0;
        border-radius: 36px;
        background: #0A0A0C;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="label">The Stack — reviewer preview (${DEVICE_WIDTH}×${DEVICE_HEIGHT})</div>
    <div class="frame">
      <div class="notch"></div>
      <iframe src="${APP_PATH}" title="The Stack app preview"></iframe>
    </div>
  </body>
</html>`;
}

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

    // Root serves the phone-frame wrapper, not the app — the app itself
    // lives at APP_PATH, embedded in the wrapper's iframe.
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(phoneFrameHtml());
      return;
    }

    // Strip query/hash and reject path traversal before touching the filesystem.
    let safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (safePath === normalize(APP_PATH) || safePath === normalize(APP_PATH).slice(0, -1)) {
      safePath = 'index.html';
    } else if (safePath.endsWith('/')) {
      safePath += 'index.html';
    }

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
  console.log(`Opens straight into a ${DEVICE_WIDTH}×${DEVICE_HEIGHT} phone frame — no DevTools needed.`);
  console.log('Ctrl+C to stop.\n');
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
