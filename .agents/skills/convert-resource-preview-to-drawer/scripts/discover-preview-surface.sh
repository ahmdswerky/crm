#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <resource>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../../.." && pwd)"
resource="${1,,}"
if [[ "$resource" == *ies ]]; then
  singular="${resource%ies}y"
  plural="$resource"
elif [[ "$resource" == *s ]]; then
  singular="${resource%s}"
  plural="$resource"
elif [[ "$resource" == *y ]]; then
  singular="$resource"
  plural="${resource%y}ies"
else
  singular="$resource"
  plural="${resource}s"
fi

cd "$repo_root"

printf 'Resource\ninput: %s\nsingular: %s\nplural: %s\n\n' "$resource" "$singular" "$plural"

printf 'Candidate page and test files\n'
rg --files dashboard/src/pages | rg "/(${plural}|${singular})-page(\.test)?\.tsx$" || true
printf '\n'

printf 'Preview, editor, delete, and details signals\n'
page_files="$(rg --files dashboard/src/pages | rg "/(${plural}|${singular})-page\.tsx$" || true)"
if [[ -n "$page_files" ]]; then
  while IFS= read -r page_file; do
    rg -n -i "useSearchParams|searchParams\.get\(\"record\"|searchParams\.get\(\"mode\"|showPanel|Inspector|preview|pendingDelete|deleteOpen|confirmDelete|AlertDialog|Sheet|DetailsPage|mode=edit|returnSearch|return=|searchParams\.get\(\"return\"" "$page_file" || true
  done <<< "$page_files"
else
  printf 'No dedicated page file found.\n'
fi
printf '\n'

printf 'Route declarations\n'
rg -n -i "${plural}|${singular}" dashboard/src/App.tsx || true
printf '\n'

printf 'Shared drawer and delete primitives\n'
rg --files dashboard/src/components | rg "resource-preview-drawer|resource-delete-dialog|ui/(sheet|alert-dialog)\.tsx" || true
printf '\n'

printf 'OpenAPI and generated contract candidates\n'
rg -l -i "\"/(api/)?(v1/)?${plural}([/?{\"]|$)" docs/openapi/*.openapi.json dashboard/src/api/generated/*.ts || true
printf '\n'

printf 'Focused test expectations\n'
test_files="$(rg --files dashboard/src/pages | rg "/(${plural}|${singular})-page\.test\.tsx$" || true)"
if [[ -n "$test_files" ]]; then
  while IFS= read -r test_file; do
    rg -n -i "preview|drawer|sheet|dialog|record|mode=edit|edit|delete|details|permission" "$test_file" || true
  done <<< "$test_files"
else
  printf 'No focused page test found.\n'
fi
