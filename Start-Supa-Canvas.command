#!/bin/zsh
cd "${0:A:h}" || exit 1
PYTHON="/Users/emilyward/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [[ ! -x "$PYTHON" ]]; then PYTHON="python3"; fi
print 'Supa Canvas → http://localhost:8765'
print 'Open this address in Chrome. Keep this window open; press Control-C to stop.'
"$PYTHON" -m http.server 8765 --bind 127.0.0.1 --directory dist
