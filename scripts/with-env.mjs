/**
 * Cross-platform env-var launcher, no dependencies.
 *
 * Usage:  node scripts/with-env.mjs NAME=value [NAME2=value2 ...] <command> [args...]
 *
 * Why this exists (THEA-46): the demo/onboarding/preview scripts used the
 * shell-inline form `EXPO_PUBLIC_DEMO=1 expo start --web`. That is Bourne-shell
 * syntax. On Windows, npm runs each script string through cmd.exe, which has no
 * concept of an inline `NAME=value` prefix, so it reports:
 *   'EXPO_PUBLIC_ONBOARDING' is not recognized as an internal or external command
 * and the script never starts. macOS/Linux devs never saw it because their
 * script-shell is /bin/sh.
 *
 * This wrapper reads the leading NAME=value pairs off argv, sets them in the
 * child's environment, and spawns the remaining argv as the command — so the
 * exact same package.json script works from PowerShell, cmd.exe and POSIX
 * shells alike. It matches the repo's existing pattern of small, dependency-free
 * scripts/*.mjs helpers (rather than adding a `cross-env` dependency).
 *
 * Dev/demo tooling only: it sets EXPO_PUBLIC_* toggles and launches expo. It
 * never touches app code, build output or anything shipped in production.
 */
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);

// Peel off leading NAME=value assignments. A valid env name is
// [A-Za-z_][A-Za-z0-9_]*; the first token that doesn't match is the command.
const env = { ...process.env };
let i = 0;
for (; i < argv.length; i++) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(argv[i]);
  if (!match) break;
  env[match[1]] = match[2];
}

const [command, ...args] = argv.slice(i);

if (!command) {
  console.error(
    'with-env: no command given.\n' +
      'Usage: node scripts/with-env.mjs NAME=value [...] <command> [args...]',
  );
  process.exit(1);
}

// shell:true on Windows so the child resolves the .cmd/.ps1 shims that npm puts
// on PATH for binaries like `expo` (spawn can't exec a .cmd directly otherwise).
// On POSIX we spawn without a shell to avoid re-quoting surprises.
const isWindows = process.platform === 'win32';
const child = spawn(command, args, {
  stdio: 'inherit',
  env,
  shell: isWindows,
});

// Forward Ctrl+C / terminate so the expo dev server shuts down cleanly instead
// of being orphaned.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('error', (err) => {
  console.error(`with-env: failed to start "${command}": ${err.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    // Re-raise the signal so the parent's exit reflects how the child died.
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
