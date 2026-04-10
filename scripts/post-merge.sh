#!/bin/bash
set -e

npm install --prefer-offline --no-audit --no-fund 2>/dev/null || true
npx prisma generate --schema=packages/db/prisma/schema.prisma 2>/dev/null || true
npm run build --workspace=packages/ai 2>/dev/null || true
