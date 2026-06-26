#!/bin/bash
# Set required secrets in Supabase for the telegram-webhook edge function
# Usage: BOT_TOKEN=<token> bash scripts/set-supabase-secrets.sh

BOT_TOKEN="${BOT_TOKEN:-$1}"
PROJECT_ID="fjsogozwseqoxgddjeig"

if [ -z "$BOT_TOKEN" ]; then
  echo "Error: BOT_TOKEN is required"
  exit 1
fi

npx supabase secrets set TELEGRAM_BOT_TOKEN="$BOT_TOKEN" --project-ref "$PROJECT_ID"
echo "Secrets set. Now register the webhook:"
echo "  BOT_TOKEN=$BOT_TOKEN bash scripts/register-webhook.sh"
