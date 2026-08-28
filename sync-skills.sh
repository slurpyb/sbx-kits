#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$repo_root/.agents/skills"
dest_dir="$repo_root/.claude/skills"

if [[ ! -d "$source_dir" ]]; then
  echo "Source skills directory not found: $source_dir" >&2
  exit 1
fi

mkdir -p "$dest_dir"

shopt -s nullglob
for skill in "$source_dir"/*; do
  name="$(basename "$skill")"
  dest="$dest_dir/$name"
  target="../../.agents/skills/$name"

  if [[ -L "$dest" || -e "$dest" ]]; then
    rm -rf "$dest"
  fi

  ln -s "$target" "$dest"
done
