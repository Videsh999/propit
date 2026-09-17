#!/usr/bin/env bash
# Removes iCloud conflict copies from build output — "routes.d 2.ts",
# "cache-life.d 3.ts", even whole directories like "sell 2.segments" — which
# break typecheck. This project sits on an iCloud-synced Desktop, so they keep
# reappearing; see README > Development notes.
#
# Deliberately limited to .next: that directory is fully regenerable, whereas
# a pattern-matched delete across source files could remove real work.
set -uo pipefail
cd "$(dirname "$0")/.."
[ -d .next ] || { echo "removed 0 iCloud conflict copies"; exit 0; }

count=0
# -depth visits children before parents, so a duplicated directory is removed
# after anything inside it rather than failing mid-walk.
while IFS= read -r -d '' f; do
  rm -rf -- "$f" && count=$((count + 1))
done < <(find .next -depth -name "* [0-9]*" -print0 2>/dev/null)
echo "removed ${count} iCloud conflict copies"

stray=$(find . -path ./node_modules -prune -o -path ./.next -prune -o -name "* [0-9].*" -print 2>/dev/null | head -1)
if [ -n "$stray" ]; then
  echo "note: conflict copies exist outside .next (e.g. $stray) — not removed automatically"
fi
exit 0
