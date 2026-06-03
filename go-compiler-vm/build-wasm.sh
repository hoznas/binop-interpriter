#!/bin/bash
set -e
cd "$(dirname "$0")"

DOCS="$(pwd)/../docs/go"
mkdir -p "$DOCS"

echo "Building binop.wasm..."
(cd go-vm && GOOS=js GOARCH=wasm go build -o "$DOCS/binop.wasm" .)

echo "Copying wasm_exec.js..."
WASM_EXEC=$(go env GOROOT | tr '\\' '/')
# Go 1.21+ は lib/wasm、旧版は misc/wasm
if [ -f "$WASM_EXEC/lib/wasm/wasm_exec.js" ]; then
  cp "$WASM_EXEC/lib/wasm/wasm_exec.js" "$DOCS/"
else
  cp "$WASM_EXEC/misc/wasm/wasm_exec.js" "$DOCS/"
fi

echo "Done. Output: docs/go/"
