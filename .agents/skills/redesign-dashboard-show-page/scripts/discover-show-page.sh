#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "${1// }" ]]; then
  echo "Usage: discover-show-page.sh <resource-or-model>" >&2
  exit 2
fi

for required in rg jq; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "Required command is unavailable: $required" >&2
    exit 1
  fi
done

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
dashboard_dir="$repo_root/dashboard"
pages_dir="$dashboard_dir/src/pages"
generated_dir="$dashboard_dir/src/api/generated"
openapi_dir="$repo_root/docs/openapi"
app_file="$dashboard_dir/src/App.tsx"

if [[ ! -d "$pages_dir" || ! -d "$generated_dir" || ! -d "$openapi_dir" ]]; then
  echo "Run this script from the CRM repository; dashboard sources, generated APIs, or docs/openapi are missing." >&2
  exit 1
fi

resource="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
case "$resource" in
  *ies) singular="${resource%ies}y"; plural="$resource" ;;
  *s) singular="${resource%s}"; plural="$resource" ;;
  *y) singular="$resource"; plural="${resource%y}ies" ;;
  *) singular="$resource"; plural="${resource}s" ;;
esac
model_name="${singular^}"

mapfile -t page_matches < <(rg -il -F -e "$resource" -e "$singular" -e "$plural" "$pages_dir" "$app_file" 2>/dev/null || true)
mapfile -t generated_matches < <(rg -il -F -e "$resource" -e "$singular" -e "$plural" "$generated_dir" 2>/dev/null || true)
mapfile -t openapi_matches < <(rg -il -F -e "$resource" -e "$singular" -e "$plural" "$openapi_dir" 2>/dev/null || true)

echo "Show-page discovery: $1"
echo "Normalized names: singular=$singular plural=$plural"
echo

echo "Route and page candidates:"
if [[ ${#page_matches[@]} -eq 0 ]]; then
  echo "  none"
else
  printf '  %s\n' "${page_matches[@]#"$repo_root/"}"
  echo "Matching route/detail declarations:"
  rg -n -i -o \
    -e "<Route path=\"[^\"]*${plural}[^\"]*\"" \
    -e "(export )?function ${model_name}(Details|Show)Page" \
    -e "${singular}Id" \
    "${page_matches[@]}" 2>/dev/null | head -80 || true
fi
echo

echo "Generated API candidates:"
if [[ ${#generated_matches[@]} -eq 0 ]]; then
  echo "  none"
else
  printf '  %s\n' "${generated_matches[@]#"$repo_root/"}"
fi
echo

echo "OpenAPI candidates and direct relationships:"
if [[ ${#openapi_matches[@]} -eq 0 ]]; then
  echo "  none"
else
  for document in "${openapi_matches[@]}"; do
    echo "  ${document#"$repo_root/"}"
    jq -r --arg query "$singular" '
      "    title: " + (.info.title // "unknown"),
      "    servers: " + ((.servers // [] | map(.url) | join(", ")) | if . == "" then "UNDOCUMENTED" else . end),
      "    operations:",
      (
        [.paths // {} | to_entries[] |
          .key as $path |
          .value | to_entries[] |
          select(.key == "get" or .key == "post" or .key == "put" or .key == "patch" or .key == "delete") |
          "      " + (.key | ascii_upcase) + " " + $path + " :: " + (.value.summary // "")
        ] | if length == 0 then ["      none"] else . end
      )[],
      "    matching schemas:",
      (
        [.components.schemas // {} | to_entries[] |
          select((.key | ascii_downcase) == $query or (.key | ascii_downcase | contains($query))) |
          .key as $schema |
          "      " + $schema,
          (
            .value.properties // {} | to_entries[] |
            "        " + .key + ": " +
            (if .value["$ref"] then (.value["$ref"] | split("/") | last)
             elif .value.items["$ref"] then "array<" + (.value.items["$ref"] | split("/") | last) + ">"
             elif .value.enum then (.value.type // "value") + " enum[" + (.value.enum | map(tostring) | join(", ")) + "]"
             else (.value.type // "object") end)
          )
        ] | if length == 0 then ["      none"] else . end
      )[]
    ' "$document"
  done
fi
echo

echo "Referenced schema locations:"
mapfile -t related_schemas < <(
  for document in "${openapi_matches[@]}"; do
    jq -r --arg query "$singular" '
      .components.schemas // {} | to_entries[] |
      select((.key | ascii_downcase) == $query or (.key | ascii_downcase | contains($query))) |
      .value | .. | objects | .["$ref"]? // empty | split("/") | last
    ' "$document"
  done | sort -u
)

if [[ ${#related_schemas[@]} -eq 0 ]]; then
  echo "  none"
else
  for schema in "${related_schemas[@]}"; do
    echo "  $schema"
    for document in "$openapi_dir"/*.openapi.json; do
      if jq -e --arg schema "$schema" '.components.schemas[$schema] != null' "$document" >/dev/null; then
        jq -r --arg file "${document#"$repo_root/"}" '
          "    " + $file + " :: " + (.info.title // "unknown"),
          (
            [.paths // {} | to_entries[] |
              .key as $path |
              .value.get? |
              select(. != null and ($path | contains("{id}"))) |
              "      GET " + $path + " :: " + (.summary // "")
            ] | if length == 0 then ["      no documented member GET in this export"] else . end
          )[]
        ' "$document"
      fi
    done
  done
fi
echo

echo "Cross-contract capabilities:"
activity_document="$openapi_dir/ActivityLog.openapi.json"
if [[ -f "$activity_document" ]]; then
  jq -r '
    [.paths // {} | to_entries[] | .value.get.parameters // [] | .[] | select(.name == "subjects[]")][0] as $subject |
    "  activity server: " + ((.servers // [] | map(.url) | join(", ")) | if . == "" then "UNDOCUMENTED" else . end),
    "  activity subjects: " + ($subject.description // "not documented"),
    "  activity pattern: " + ($subject.schema.items.pattern // "not documented")
  ' "$activity_document"
else
  echo "  activity contract: none"
fi

media_document="$openapi_dir/Media.openapi.json"
if [[ -f "$media_document" ]]; then
  jq -r '
    "  media server: " + ((.servers // [] | map(.url) | join(", ")) | if . == "" then "UNDOCUMENTED" else . end),
    "  media owner types: " + ((.components.schemas.OwnerType.enum // []) | map(tostring) | join(", "))
  ' "$media_document"
else
  echo "  media contract: none"
fi
echo

echo "Required next checks:"
echo "  1. Read dashboard/AGENTS.md and its required documents."
echo "  2. Read the exact matching schemas and operations completely."
echo "  3. Trace every proposed related route and its view permission."
echo "  4. Run npm run api:check from dashboard/."
