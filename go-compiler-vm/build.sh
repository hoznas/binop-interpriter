#!/bin/bash
set -e
cd "$(dirname "$0")"

mkdir -p bin

echo "Building binop-compiler..."
(cd go-compiler && go build -o ../bin/binop-compiler .)

echo "Building binop-vm..."
(cd go-vm && go build -o ../bin/binop-vm .)

echo "Done. Binaries in bin/"
