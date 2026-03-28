#!/bin/bash
# ============================================
# Cleya AI — Replit Setup Script
# Run this once after importing the project
# ============================================

set -e

echo "🚀 Setting up Cleya AI on Replit..."
echo ""

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Copy env file
if [ ! -f .env ]; then
  echo "📋 Creating .env from .env.example..."
  cp .env.example .env
  echo "⚠️  IMPORTANT: Edit .env with your actual API keys!"
else
  echo "✅ .env already exists"
fi

# 3. Generate Prisma client
echo "🗃️  Generating Prisma client..."
cd packages/db
npx prisma generate
cd ../..

echo ""
echo "============================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Add your DATABASE_URL to Replit Secrets"
echo "  2. Add OPENAI_API_KEY or ANTHROPIC_API_KEY"
echo "  3. Add JWT_SECRET (any 32+ char string)"
echo "  4. Run: npx prisma migrate dev --name init"
echo "     (from packages/db directory)"
echo "  5. Run: npm run db:seed (optional, adds sample users)"
echo "  6. Click 'Run' to start the app!"
echo "============================================"
