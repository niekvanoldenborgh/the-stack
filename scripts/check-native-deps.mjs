/**
 * Preflight check for native dependencies, no dependencies (THEA-99).
 *
 * node_modules/ is git-tracked in this repo (see AGENTS.md), but the
 * committed tree only carries the platform-native binaries the team
 * actually develops on — currently `lightningcss-darwin-arm64` and
 * `lightningcss-linux-x64-gnu`. `package-lock.json` lists all of
 * lightningcss's platform packages as optionalDependencies, so `npm install`
 * on any platform fetches the right one — but node_modules/ being
 * committed makes a fresh clone *look* installed, so it's easy to skip that
 * step. Metro then throws a cryptic require-stack error ~30s into the first
 * bundle, naming an internal path and never mentioning `npm install`:
 *
 *   Cannot find module '../lightningcss.win32-x64-msvc.node'
 *
 * This checks that the current platform's lightningcss native binary
 * actually resolves and fails fast with a plain-language fix if it
 * doesn't, before the demo/onboarding/preview scripts spawn Metro.
 *
 * Requiring `lightningcss` is enough to surface this: its own loader
 * (node_modules/lightningcss/node/index.js) resolves the platform package
 * at module-load time, not lazily on first transform call, so a missing
 * binary throws immediately here rather than deep into a bundle.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function checkNativeDeps() {
  try {
    require('lightningcss');
    return true;
  } catch {
    const platform = `${process.platform}-${process.arch}`;
    console.error(
      `\nNative dependencies for ${platform} are missing.\n` +
        'node_modules/ is committed to this repo, but the committed tree only\n' +
        'carries native binaries for the platforms the team develops on — not\n' +
        'every platform.\n\n' +
        'Run `npm install` first to fetch the binary for your platform, then\n' +
        're-run this command.\n',
    );
    return false;
  }
}
