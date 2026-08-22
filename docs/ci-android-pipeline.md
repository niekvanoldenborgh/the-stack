# Android build pipeline → n8n

`.github/workflows/android-preview.yml` builds a sideloadable APK on EAS and
POSTs the download link to an n8n webhook.

## One-time setup

### 1. Expo access token

An `eas login` session does not work in CI — it needs a token.

1. https://expo.dev/settings/access-tokens → **Create token**
2. Copy it (shown once)

### 2. GitHub secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Value |
|---|---|
| `EXPO_TOKEN` | the token from step 1 |
| `N8N_WEBHOOK_URL` | your n8n **Production** webhook URL |

Or, to keep the dotenv workflow, copy `.env.ci.example` to `.env.ci` (gitignored),
fill it in, and push both secrets at once:

```bash
brew install gh && gh auth login
gh secret set -f .env.ci
```

Either way they end up in GitHub Secrets. A `.env` file committed to the repo
cannot work: it is gitignored so CI never sees it, and un-ignoring it would put
live credentials in a **public** repository, permanently in git history. Don't paste either into a chat, a commit, or
`eas.json` — a webhook URL is a capability: anyone holding it can trigger your
flow.

Optional — **Variables** tab, `EXPO_ACCOUNT`, if the Expo account is ever
renamed from `nfpassistance-viniek` (only affects the build-page link).

## When it runs

- push to `main`
- push of a `v*` tag
- **Actions → Android preview build → Run workflow** (choose `preview` or `production`)

Not on every push to every branch: each run spends an EAS build, and Android
builds take ~15–25 minutes. Pushes touching only `**/*.md`, `design-lab/**` or
`docs/**` are skipped.

A newer push to the same ref cancels an in-flight build for that ref.

## What it does

1. **verify** — `npm ci`, typecheck, 191 app tests, `npm run contrast`, 59 server tests.
   Nothing builds unless these pass. An APK that fails typecheck is worse than no
   APK, because it gets installed and trusted.
2. **build** — `eas build --platform android --profile preview --wait --json`,
   then reads the artifact URL out of the JSON rather than scraping console output.
3. **notify** — POSTs to the webhook. Runs with `if: always()`, so a *failure*
   reaches you too. Silence should never be the only signal.

## Webhook payload

```json
{
  "status": "success",
  "message": "New Android build ready to install.",
  "apkUrl": "https://expo.dev/artifacts/eas/….apk",
  "buildPage": "https://expo.dev/accounts/…/builds/…",
  "repo": "niekvanoldenborgh/the-stack",
  "branch": "main",
  "sha": "94fcdfa1…",
  "shortSha": "94fcdfa",
  "actor": "niekvanoldenborgh",
  "commitMessage": "…",
  "runUrl": "https://github.com/…/actions/runs/…"
}
```

`status` is one of:

| value | meaning |
|---|---|
| `success` | APK ready, `apkUrl` populated |
| `verify_failed` | checks failed, no build was started |
| `build_failed` | EAS build failed; see `runUrl` / `buildPage` |

`apkUrl` is empty unless `status` is `success` — branch on `status` in n8n, not
on the presence of the URL.

The payload is assembled with `jq`, so a commit message containing quotes or
newlines can't produce malformed JSON.

## Notes

- **EAS free tier limits Android builds per month.** If you hit the cap, builds
  queue or fail; the workflow reports that as `build_failed`.
- **`apkUrl` is baked with `EXPO_PUBLIC_API_BASE_URL` from `eas.json`.** That is
  currently a LAN address, so account creation in CI-built APKs only works on
  that network. Change it to the deployed API URL before sharing builds.
- **`expo-updates` is not installed**, so the `channel` in `eas.json` is inert.
  Only matters if you later want OTA updates without a rebuild.
