#!/bin/bash

# Regenerate the TypeScript clients from the live OpenAPI docs (custapi,
# experiment-manager, ticketing-service).
# Skips generation when a server is unreachable so local installs don't fail.

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
EXPERIMENT_MANAGER_DOC="${EXPERIMENT_MANAGER_DOC_URL:-http://experiment-manager.mapfox.hoshina.san/openapi.json}"
TICKETING_DOC="${TICKETING_DOC_URL:-http://ticketing-service.mapfox.hoshina.san/docs/doc.json}"

rm -rf src/custapi src/ticketing src/experiment-manager.d.ts

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

# Experiment Manager: types only (the runtime client is a hand-written fetch
# wrapper in the consuming app, mirroring form-poc).
echo "Checking Experiment Manager server..."
if check_server "$EXPERIMENT_MANAGER_DOC" "Experiment Manager"; then
  echo "Generating types for Experiment Manager..."
  pnpm dlx openapi-typescript "$EXPERIMENT_MANAGER_DOC" -o src/experiment-manager.d.ts
fi

echo "Checking Ticketing Service server..."
if check_server "$TICKETING_DOC" "Ticketing Service"; then
  echo "Generating client for Ticketing Service..."
  pnpm dlx @openapitools/openapi-generator-cli generate \
    -g typescript-fetch \
    -i "$TICKETING_DOC" \
    -o src/ticketing \
    --additional-properties=disallowAdditionalPropertiesIfNotPresent=false,supportsES6=true,useSingleRequestParameter=false \
    --enable-post-process-file \
    --remove-operation-id-prefix
fi

echo "✓ Code generation completed"
