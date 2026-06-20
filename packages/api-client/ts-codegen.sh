#!/bin/bash

# Regenerate the custapi TypeScript client from the live CustAPI OpenAPI doc.
# Skips generation when the server is unreachable so local installs don't fail.

check_server() {
  local url=$1
  local name=$2

  if curl -s -f --max-time 5 "$url" > /dev/null 2>&1; then
    return 0
  else
    echo "⚠️ SKIPPED: $name server is not running at $url"
    return 1
  fi
}

CUSTAPI_DOC="${CUSTAPI_DOC_URL:-http://custapi.mapfox.hoshina.san/swagger/doc.json}"

rm -rf src/custapi

echo "Checking CustAPI server..."
if check_server "$CUSTAPI_DOC" "CustAPI"; then
  echo "Generating client for CustAPI..."
  pnpm dlx @openapitools/openapi-generator-cli generate \
    -g typescript-fetch \
    -i "$CUSTAPI_DOC" \
    -o src/custapi \
    --additional-properties=disallowAdditionalPropertiesIfNotPresent=false,supportsES6=true,useSingleRequestParameter=false \
    --enable-post-process-file \
    --remove-operation-id-prefix
fi

echo "✓ Code generation completed"
