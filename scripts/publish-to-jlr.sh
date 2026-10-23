#!/usr/bin/env bash
# Copy the Guitar Tab build into the jeremylegalrecords.com site repo as guitar-tab/.
#
#   scripts/publish-to-jlr.sh [path-to-site-repo]     (default: ../jlr-site)
#
# This only writes inside <site>/guitar-tab/. It does not commit or push: review
# `git status` in the site repo, then commit and push guitar-tab/ yourself.
# Served at https://jeremylegalrecords.com/guitar-tab/ (landing) and /guitar-tab/app/ (app).
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$(cd "${1:-$SRC/../jlr-site}" && pwd)"
DEST="$SITE/guitar-tab"

grep -qx 'jeremylegalrecords.com' "$SITE/CNAME" 2>/dev/null || { echo "error: $SITE has no CNAME for jeremylegalrecords.com" >&2; exit 1; }
[ -d "$SITE/royalty-dashboard" ] || { echo "error: $SITE doesn't look like the site repo" >&2; exit 1; }

# Fresh copy of the deployable files only. Skipped on purpose: robots.txt, the root
# sw.js (github.io-only v3 cache cleaner), .nojekyll, README, docs/, tests/, scripts/.
rm -rf "$DEST"
mkdir -p "$DEST"
cd "$SRC"
cp index.html og.png LICENSE "$DEST/"
cp -R css assets icons app "$DEST/"

# 1) Landing: drop the "Now at jeremylegalrecords.com" banner (only for the old address).
perl -0pi -e 's/<!-- old-address:.*?<!-- \/old-address -->\n//s' "$DEST/index.html"

# 2) App: replace the "Now at" note with one for people arriving from the old address.
perl -0pi -e 's/<!-- origin-note:.*?<!-- \/origin-note -->/<p class="note">Used the old address (maximini22.github.io\/github-tab)? Saved work doesn\x27t carry over between web addresses: Export there, then Import here.<\/p>/s' "$DEST/app/index.html"

# 3) Offline cache: own name on this origin (scope stays ./ = /guitar-tab/app/).
perl -pi -e "s/'guitar-tab-/'jlr-guitar-tab-/g" "$DEST/app/sw.js"

# Checks
fail=0
grep -q 'old-address' "$DEST/index.html" && { echo "check: banner still present" >&2; fail=1; }
grep -q 'origin-note' "$DEST/app/index.html" && { echo "check: origin note not swapped" >&2; fail=1; }
grep -q "var VERSION = 'jlr-guitar-tab-" "$DEST/app/sw.js" || { echo "check: sw cache not renamed" >&2; fail=1; }
grep -rlE 'src="/|href="/[^/]' "$DEST" --include=*.html && { echo "check: root-absolute path found" >&2; fail=1; }
[ "$fail" = 0 ] || exit 1

echo "Published to $DEST:"
( cd "$DEST" && find . -type f | sort )
echo "Next: cd \"$SITE\" && git status   (commit guitar-tab/ only)"
