#!/usr/bin/env bash
# Release guard (runs on every pushed v* tag): the tag must be an annotated vX.Y.Z tag that matches the version file
# at the tagged commit, be newer than every earlier release, and point at a commit on which every check in
# .github/release-checks.txt succeeded. Exit 1 = the workflow removes the tag.
# Identical copy in every Lumio repo; lumio/bin/test.sh checks that the copies match.
set -euo pipefail

tag="${TAG:?TAG is required}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

fail() {
  echo "::error::release tag $tag rejected: $*"
  exit 1
}

[[ "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || fail "name must be vX.Y.Z"
version="${tag#v}"
[ "$(git cat-file -t "refs/tags/$tag")" = tag ] || fail "lightweight tag; release tags must be annotated"
sha="$(git rev-parse "$tag^{commit}")"

if git cat-file -e "$sha:VERSION" 2>/dev/null; then
  file_version="$(git show "$sha:VERSION" | tr -d '[:space:]')"
else
  file_version="$(git show "$sha:package.json" | node -p 'JSON.parse(require("fs").readFileSync(0)).version')"
fi
[ "$file_version" = "$version" ] || fail "version file at ${sha:0:7} says $file_version"

previous="$(git tag -l 'v*' | grep -vx "$tag" | sed 's/^v//' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)"
if [ -n "$previous" ] && [ "$(printf '%s\n%s\n' "$version" "$previous" | sort -V | tail -1)" != "$version" ]; then
  fail "$version is not newer than v$previous"
fi

missing=0
while IFS= read -r ctx; do
  run="$(gh api "repos/$repo/commits/$sha/check-runs?per_page=100" \
    --jq "[.check_runs[] | select(.name == \"$ctx\")] | sort_by(.started_at) | last | .conclusion // \"missing\"")"
  if [ "$run" = missing ]; then
    run="$(gh api "repos/$repo/commits/$sha/statuses?per_page=100" --jq "[.[] | select(.context == \"$ctx\")] | first | .state // \"missing\"")"
  fi
  if [ "$run" = success ]; then
    echo "ok       $ctx"
  else
    echo "::error::required check '$ctx' is $run on ${sha:0:7}"
    missing=1
  fi
done < <(grep -vE '^[[:space:]]*(#|$)' .github/release-checks.txt)
[ "$missing" -eq 0 ] || fail "not every required check passed on ${sha:0:7}"

echo "release tag $tag verified (${sha:0:7})"
