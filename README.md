# DeepSeek Harness for Umbrel

The container image behind the DeepSeek Harness app in
[Yakitori's Umbrel app store](https://github.com/Oni-giri/yakitoris-app-store).

It is the stock Node.js image plus the official
[`@deepseek-ai/dsh`](https://github.com/deepseek-ai/deepseek-harness) npm release
and `launcher.mjs`. The launcher runs `dsh web` on loopback inside the container
and serves a small reverse proxy for Umbrel's app proxy, handing over dsh's
per-process launch token so that Umbrel's login is the access control.

## What the agent can use

Besides dsh, the image has git, curl, ripgrep, jq, Python 3 with pip and venv,
a C/C++ toolchain, and corepack's pnpm and yarn. The agent runs as uid 1000
without root, so `npm install -g`, `pnpm add -g` and `pip install` go to
`~/.local` (on the app's data volume, so they survive updates), which is on
`PATH`. Other installers that need no root (rustup, nvm, bun, deno, sdkman,
pyenv, a Go tarball unpacked in the home folder, ...) work as well: they add a
PATH line to `~/.profile` or `~/.bashrc`, and `BASH_ENV` (`bash-env.sh`) makes
the agent's non-interactive `bash -c` read those files too. Anything that needs
apt has to be added to the image.

## Smoke test

Every build runs `test/smoke.mjs` against the container, posing as a browser
behind Umbrel's app proxy: the launch-token handover and `dsh-auth` cookie, the
page and its plugin bundles, an `/api` call and the `/api/remote.mux` WebSocket
(each refused without the cookie), then the same cookie again after a container
restart. These are the dsh details the launcher depends on, so a dsh release
that changes them fails here instead of on an Umbrel.

## Automatic updates

`update.yml` runs every day. When npm's `latest` dsh release is newer than
`package.json` and at least three days old, it bumps `package.json` and the
lockfile, tags `v<version>` and starts `docker.yml` on that tag. The build runs
the smoke test plus two release checks (dsh still reads `DSH_TELEMETRY_MODE`,
and `npm audit signatures`), publishes
`ghcr.io/oni-giri/deepseek-harness:<version>` for amd64 and arm64, and
`scripts/update-app-store.py` then points the app in the app store at the new
image, with its version and release notes, and pushes to `master`.

Pushing to the app store needs the `APP_STORE_TOKEN` secret: a fine-grained
token with access to `Oni-giri/yakitoris-app-store` only and the Contents
permission set to read and write.

Run "Update dsh" by hand from the Actions tab to release a specific version
(skipping the age gate) or to see what a run would do (`dry_run`).

## Releasing by hand

1. Set the new version in `package.json` and refresh the lockfile:
   `npm install --package-lock-only --omit=dev`.
2. Commit, then tag with the dsh version and push the tag:
   `git tag v0.2.1-rc.5 && git push origin v0.2.1-rc.5`.
3. `docker.yml` tests and publishes the image and updates the app store, as
   above.

To rebuild the same dsh version, for example after changing the launcher, tag
`v<dsh version>-<n>` (`v0.2.1-rc.5-1`, `-2`, ...); the app's version suffix goes
up by one. Use an annotated tag (`git tag -a -m "…"`) to give the app store
release its own release notes. A manually started build uses the workflow file as it is at the tag,
so always tag a commit that has the current workflows.
