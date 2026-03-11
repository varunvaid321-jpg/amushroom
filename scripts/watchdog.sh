#!/usr/bin/env bash
# Cron entry (every 15 minutes):
# */15 * * * * RESEND_API_KEY="re_xxx" /path/to/watchdog.sh

set -euo pipefail

URL="https://orangutany.com/healthz"
FLAG_FILE="/tmp/orangutany-watchdog-alerted"
FROM="noreply@orangutany.com"
TO_1="varun.vaid@aol.com"
TO_2="varun.vaid321@gmail.com"
TODAY=$(date +%Y-%m-%d)

send_email() {
  local subject="$1"
  local body="$2"
  for to in "$TO_1" "$TO_2"; do
    curl -s -X POST https://api.resend.com/emails \
      -H "Authorization: Bearer ${RESEND_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"from\":\"$FROM\",\"to\":\"$to\",\"subject\":\"$subject\",\"text\":\"$body\"}" \
      > /dev/null
  done
}

# Health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" || echo "000")
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) healthz=$HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  # Site is up — check if we need to send recovery
  if [ -f "$FLAG_FILE" ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) RECOVERY — site is back up"
    send_email "[RECOVERED] orangutany.com is back up" "orangutany.com/healthz returned 200 at $(date -u). Site has recovered."
    rm -f "$FLAG_FILE"
  fi
else
  # Site is down — send alert if we haven't today
  if [ -f "$FLAG_FILE" ] && [ "$(cat "$FLAG_FILE")" = "$TODAY" ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) DOWN — alert already sent today"
  else
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) DOWN — sending alert"
    send_email "[DOWN] orangutany.com is unreachable" "orangutany.com/healthz returned $HTTP_CODE at $(date -u). Investigate immediately."
    echo "$TODAY" > "$FLAG_FILE"
  fi
fi
