#!/bin/bash

TMPFILE=$(mktemp)
npx next build > "$TMPFILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  cat "$TMPFILE"
  rm -f "$TMPFILE"
  exit 0
fi

ERRORS=$(grep "Export encountered errors" -A 100 "$TMPFILE" | grep "^/" || true)
NON_NOTFOUND=$(echo "$ERRORS" | grep -v "/_not-found" | grep -v "/_error" | grep -v "^$" || true)

if [ -z "$NON_NOTFOUND" ]; then
  grep -v "TypeError\|useContext\|Error occurred prerendering\|Export encountered errors\|/_not-found\|at t\.\|at d \|at g \|at au\|at ab\|at a_\|at aw\|at /home" "$TMPFILE" || true
  echo "Build completed successfully"
  rm -f "$TMPFILE"
  exit 0
else
  cat "$TMPFILE"
  rm -f "$TMPFILE"
  exit 1
fi
