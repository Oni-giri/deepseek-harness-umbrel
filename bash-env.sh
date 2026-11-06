# Installed as /etc/bash-env.sh and named by BASH_ENV, so every non-interactive
# bash reads it, including the agent's `bash -c` commands. Interactive shells
# (dsh's terminal) read ~/.bashrc and ~/.profile themselves; this gives the
# agent the same setup.
#
# Installers that need no root (rustup, nvm, bun, deno, sdkman, pyenv, ...) put
# their tools in the home folder and add a PATH line to ~/.profile or ~/.bashrc.
# Reading both here makes whatever they set up available to the agent too.
#
# Once per process tree: children inherit the exported PATH, which also keeps a
# script started from ~/.bashrc from reading it again. The name avoids DSH_*,
# which dsh strips from its children's environment.
if [ -z "${UMBREL_BASH_ENV_LOADED-}" ]; then
  export UMBREL_BASH_ENV_LOADED=1
  # The caller's -e/-u must not abort on someone else's profile lines.
  __umbrel_opts=$-
  set +eu
  [ -r "$HOME/.profile" ] && . "$HOME/.profile"
  [ -r "$HOME/.bashrc" ] && . "$HOME/.bashrc"
  case $__umbrel_opts in *e*) set -e ;; esac
  case $__umbrel_opts in *u*) set -u ;; esac
  unset __umbrel_opts
fi
