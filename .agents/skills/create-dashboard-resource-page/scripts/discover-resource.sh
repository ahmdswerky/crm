#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "${1// }" ]]; then
  echo "Usage: discover-resource.sh <resource-or-model>" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
generated_dir="$repo_root/dashboard/src/api/generated"
openapi_dir="$repo_root/docs/openapi"

if [[ ! -d "$generated_dir" || ! -d "$openapi_dir" ]]; then
  echo "Run this script from the CRM repository; dashboard generated APIs or docs/openapi are missing." >&2
  exit 1
fi

resource="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
case "$resource" in
  *ies) singular="${resource%ies}y" ;;
  *s) singular="${resource%s}" ;;
  *) singular="$resource" ;;
esac

mapfile -t generated_matches < <(rg -il -F -e "$resource" -e "$singular" "$generated_dir" || true)
mapfile -t openapi_matches < <(rg -il -F -e "$resource" -e "$singular" "$openapi_dir" || true)

echo "Resource discovery: $1"
echo "Generated API candidates:"
if [[ ${#generated_matches[@]} -eq 0 ]]; then
  echo "  none"
else
  printf '  %s\n' "${generated_matches[@]#"$repo_root/"}"
fi

echo "OpenAPI candidates:"
if [[ ${#openapi_matches[@]} -eq 0 ]]; then
  echo "  none"
  exit 0
fi

for document in "${openapi_matches[@]}"; do
  echo "  ${document#"$repo_root/"}"
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg query "$singular" '
      "    title: " + (.info.title // "unknown"),
      "    matching schemas: " + (
        [.components.schemas // {} | keys[] | select(ascii_downcase | contains($query))]
        | if length == 0 then "none" else join(", ") end
      ),
      "    operations:",
      (
        [.paths // {} | to_entries[] |
          .key as $path |
          .value | to_entries[] |
          select(.key == "get" or .key == "post" or .key == "put" or .key == "patch" or .key == "delete") |
          "      " + (.key | ascii_upcase) + " " + $path
        ] | if length == 0 then ["      none"] else . end
      )[]
    ' "$document"
  fi
done
