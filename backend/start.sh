#!/bin/sh
set -e
echo "=== Running Prisma Migrations ==="
node node_modules/.bin/prisma migrate deploy
echo "=== Starting Server ==="
exec node dist/index.js
