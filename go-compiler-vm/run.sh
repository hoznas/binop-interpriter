#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ -z "$1" ]; then
    echo "Usage: ./run.sh <source.bo>" >&2
    exit 1
fi

./bin/binop-compiler "$1" | ./bin/binop-vm
