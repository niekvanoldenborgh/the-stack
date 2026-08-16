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
 * with no DevTools required to simulate one.
 *
 * THEA-44: the app used to be nested under a subpath ("/__preview-app__/")
 * on this same server and origin, embedded via iframe. That broke expo-router:
 * its web route matcher compares `window.location.pathname` straight against
 * the route table with no base-path awareness, so every route — including
 * the subpath's own root — hit the `Unmatched Route` fallback instead of the
 * real screen. Fix: `dist/` is served byte-for-byte at the *root* of its own
 * origin (a second listener, APP_PORT), so expo-router sees exactly the
 * pathnames it expects. The wrapper's iframe points at that origin instead of
 * nesting a path on its own. This script is dev/demo-only tooling; it never
 * touches `dist/` output or anything shipped in production.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not `.pathname` (THEA-46): on Windows the URL pathname is
// `/C:/Users/.../dist/` — a leading slash before the drive letter, which is not
// a valid filesystem path, so every `stat`/`readFile` below fails and the
// script wrongly reports "No build found" even after a successful export.
// fileURLToPath returns the real platform path (`C:\Users\...\dist\` on
// Windows, `/home/.../dist/` on POSIX).
const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
// A dedicated env var, not `PORT` — some hosting/CI environments (this one
// included) already export `PORT` for their own listener, and picking that up
// silently would collide with it instead of the intended dev machine port.
const PORT = Number(process.env.PREVIEW_PORT) || 4300;
// The app itself gets its own port/origin so expo-router sees it mounted at
// true root (see THEA-44 note above) — defaults to PORT + 1, overridable in
// case that also collides with something on the reviewer's machine.
const APP_PORT = Number(process.env.PREVIEW_APP_PORT) || PORT + 1;
// Defaults to loopback so nothing is exposed by accident. Reviewers running
// inside a container who reach the app via a *mapped/published* port must set
// PREVIEW_HOST=0.0.0.0 — a 127.0.0.1 listener is invisible to Docker's port
// publish. Leave it unset when forwarding the port (ssh -L / kubectl
// port-forward / VS Code remote), which tunnels to loopback and works as-is.
const HOST = process.env.PREVIEW_HOST || '127.0.0.1';

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
      <iframe id="app-frame" title="The Stack app preview"></iframe>
    </div>
    <script>
      // Reuse whatever hostname got the reviewer here (localhost, a
      // forwarded/tunnelled name, a published container IP — see PREVIEW_HOST
      // in serve-preview.mjs) and just swap the port, so the app's origin is
      // its own true root rather than a subpath of this page's origin.
      document.getElementById('app-frame').src =
        window.location.protocol + '//' + window.location.hostname + ':${APP_PORT}/';
    </script>
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

// Serves `dist/` byte-for-byte at the root of its own origin (APP_PORT).
// Deliberately the *only* place that touches ROOT — the wrapper server never
// reads from `dist/`, so there's exactly one code path that can nest the app
// under a subpath by accident.
async function serveDist(req, res) {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}`);

    // Strip query/hash and reject path traversal before touching the filesystem.
    let safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (safePath.endsWith('/')) {
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
}

const wrapperServer = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}`);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(phoneFrameHtml());
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const appServer = createServer(serveDist);

function reportListenError(name, port, err) {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${port} is already in use (${name}). Set PREVIEW_PORT (and/or PREVIEW_APP_PORT) to something else, e.g.:\n  PREVIEW_PORT=4301 npm run preview\n`,
    );
    process.exit(1);
  }
  throw err;
}

wrapperServer.on('error', (err) => reportListenError('wrapper', PORT, err));
appServer.on('error', (err) => reportListenError('app', APP_PORT, err));

appServer.listen(APP_PORT, HOST, () => {
  wrapperServer.listen(PORT, HOST, () => {
    // When bound to 0.0.0.0 the wildcard address isn't directly openable; point
    // the reviewer at a real hostname they can click instead.
    const url = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
    console.log(`\nThe Stack — reviewer preview\n`);
    console.log(`  ${url}\n`);
    console.log(`Opens straight into a ${DEVICE_WIDTH}×${DEVICE_HEIGHT} phone frame — no DevTools needed.`);
    console.log(`(App itself serves at true root on port ${APP_PORT}, so expo-router's client-side routing works.)`);
    console.log('Ctrl+C to stop.\n');
  });
});
