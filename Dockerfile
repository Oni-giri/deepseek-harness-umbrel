# DeepSeek Harness (dsh) for Umbrel: the official npm release, installed at build
# time from package-lock.json, plus the launcher that bridges Umbrel's login to
# dsh's launch token. Built and published by .github/workflows/docker.yml.
FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c

WORKDIR /opt/dsh

# package.json pins the dsh version and allows the install scripts that build or
# fetch its native pieces (terminal PTY, FFI binding, subprocess spawn helper);
# recent npm skips dependency install scripts unless package.json allows them.
# package-lock.json pins every transitive dependency, so each build is the same.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force

COPY launcher.mjs ./

USER 1000:1000
CMD ["node", "/opt/dsh/launcher.mjs"]
