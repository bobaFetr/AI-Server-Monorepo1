# Source from ~/.bashrc to share Bash history across terminal sessions of one user.
# Existing history is retained; no command is executed from the history file.
[[ $- == *i* && -n ${BASH_VERSION:-} ]] || return 0

HISTFILE=${HISTFILE:-"$HOME/.bash_history"}
HISTSIZE=-1
HISTFILESIZE=-1
HISTCONTROL=
HISTIGNORE=
shopt -s histappend cmdhist

_northstar_history_sync() {
  local northstar_status=$?
  # Append our pending commands before reloading the complete shared history.
  # If append fails, preserve the session's in-memory commands.
  if [[ -n ${HISTFILE:-} ]] && builtin history -a; then
    builtin history -c
    builtin history -r
  fi
  return "$northstar_status"
}

if [[ $(declare -p PROMPT_COMMAND 2>/dev/null) == 'declare -a '* ]]; then
  northstar_has_history_hook=false
  for northstar_prompt_hook in "${PROMPT_COMMAND[@]}"; do
    [[ $northstar_prompt_hook == _northstar_history_sync ]] && northstar_has_history_hook=true
  done
  if [[ $northstar_has_history_hook == false ]]; then
    PROMPT_COMMAND=(_northstar_history_sync "${PROMPT_COMMAND[@]}")
  fi
  unset northstar_has_history_hook northstar_prompt_hook
else
  case ${PROMPT_COMMAND:-} in
    *_northstar_history_sync*) ;;
    *) PROMPT_COMMAND="_northstar_history_sync${PROMPT_COMMAND:+; $PROMPT_COMMAND}" ;;
  esac
fi
