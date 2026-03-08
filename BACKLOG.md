# Orangutany Backlog

## Future Ideas

### User Contact & Communication
- Store user email for contact/outreach from admin panel
- Send automated emails for misuse detection (account compromised, bot activity)
- Add "contact user" button in admin Users tab

### Security & Abuse
- Detect if someone hacked an account (unusual login location, device change)
- Detect bot-driven scan activity (headless browser patterns, timing analysis)
- Auto-suspend + notify user if account appears compromised
- Rate limit by device fingerprint in addition to IP

### Newsletter
- Build unsubscribe flow: per-subscriber token, GET /api/newsletter/unsubscribe?token=..., marks unsubscribed_at
- Add unsubscribe link to email footer (required by CAN-SPAM / GDPR)
- Build newsletter sending logic (compose in admin, send via Resend to all active subscribers)
- Add rate limiting to POST /api/newsletter (prevent spam signups)

### Instagram
- Redirect old handles (@orangutany.id, @orangutany_app) to @orangutany.ai
- Connect @orangutany.ai to Orangutany Facebook Page
- Set up auto-posting from admin dashboard
