# DeepSeek Harness (dsh) for Umbrel: the official npm release, installed at build
# time from package-lock.json, plus the launcher that bridges Umbrel's login to
# dsh's launch token. Built and published by .github/workflows/docker.yml.
FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c

# The agent's everyday toolset. It runs as uid 1000 without root, so anything
# apt would install has to be in the image already.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    build-essential ca-certificates curl git jq less openssh-client procps \
    python3 python3-pip python3-venv ripgrep unzip \
 && rm -rf /var/lib/apt/lists/*

# pnpm and yarn shims; corepack fetches the version a project asks for. Login
# shells reset PATH in /etc/profile, so put ~/.local/bin (see ENV below) back.
RUN corepack enable \
 && printf '%s\n' 'PATH="$HOME/.local/bin:$HOME/.local/share/pnpm/bin:$PATH"' > /etc/profile.d/home-local-bin.sh

WORKDIR /opt/dsh

# package.json pins the dsh version and allows the install scripts that build or
# fetch its native pieces (terminal PTY, FFI binding, subprocess spawn helper);
# recent npm skips dependency install scripts unless package.json allows them.
# package-lock.json pins every transitive dependency, so each build is the same.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force

COPY launcher.mjs ./

# "Global" installs by the agent (npm -g, pnpm add -g, pip install) go to
# ~/.local instead of the root-owned /usr/local, so they work without root and,
# with HOME on the app's data volume (/data/home), survive updates. Corepack
# must not wait for a yes/no prompt nobody can answer.
ENV NPM_CONFIG_PREFIX=/data/home/.local \
    PNPM_HOME=/data/home/.local/share/pnpm \
    PYTHONUSERBASE=/data/home/.local \
    PIP_USER=1 \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PATH=/data/home/.local/bin:/data/home/.local/share/pnpm/bin:$PATH

USER 1000:1000
CMD ["node", "/opt/dsh/launcher.mjs"]
