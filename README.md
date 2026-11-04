# DeepSeek Harness for Umbrel

The container image behind the DeepSeek Harness app in
[Yakitori's Umbrel app store](https://github.com/Oni-giri/yakitoris-app-store).

It is the stock Node.js image plus the official
[`@deepseek-ai/dsh`](https://github.com/deepseek-ai/deepseek-harness) npm release
and `launcher.mjs`. The launcher runs `dsh web` on loopback inside the container
and serves a small reverse proxy for Umbrel's app proxy, handing over dsh's
per-process launch token so that Umbrel's login is the access control.

## Releasing a new dsh version

1. Set the new version in `package.json` and refresh the lockfile:
   `npm install --package-lock-only --omit=dev`.
2. Commit, then tag with the dsh version and push the tag:
   `git tag v0.2.1-rc.5 && git push origin v0.2.1-rc.5`.
3. The workflow smoke-tests the image and publishes
   `ghcr.io/oni-giri/deepseek-harness:<version>` for amd64 and arm64. The run
   summary lists the digest to pin in the app's `docker-compose.yml`.
