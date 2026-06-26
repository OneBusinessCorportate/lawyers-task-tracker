#!/bin/bash
# Register Telegram webhook for @onebusiness_agent_bot
# Usage: BOT_TOKEN=<your_token> bash scripts/register-webhook.sh

BOT_TOKEN="${BOT_TOKEN:-$1}"
WEBHOOK_URL="https://fjsogozwseqoxgddjeig.supabase.co/functions/v1/telegram-webhook"

if [ -z "$BOT_TOKEN" ]; then
  echo "Error: BOT_TOKEN is required"
  echo "Usage: BOT_TOKEN=<your_token> bash scripts/register-webhook.sh"
  exit 1
fi

echo "Registering webhook..."
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\", \"channel_post\"]}" | jq .

echo ""
echo "Checking webhook info..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .
