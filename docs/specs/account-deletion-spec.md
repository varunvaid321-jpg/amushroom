# Account Deletion Spec

## Status

**NOT IMPLEMENTED** in-app. Currently email-only via support@orangutany.com.

**BLOCKING** for App Store submission (Apple Guideline 5.1.1(v)).

## Requirement

Users who create accounts in the app must be able to initiate account deletion from within the app.

## Frontend

### Location
Add "Delete Account" button in `/account/billing` page, below existing account management options.

### Flow
1. User taps "Delete Account".
2. Confirmation dialog appears: **"This will permanently delete your account and all data. This cannot be undone."**
3. User confirms.
4. Frontend calls `POST /api/account/delete`.
5. On success: clear session, redirect to `/`.
6. On error: show error message, no redirect.

## Backend

### Endpoint
`POST /api/account/delete`

### Auth
Requires authenticated session (`getAuthContext()` returns 401 if not authenticated).

### Data Deletion

Delete the following for the authenticated user:

| Table | Action |
|-------|--------|
| `uploads` | DELETE all rows for user_id |
| `sessions` | DELETE all rows for user_id |
| `scan_quotas` | DELETE all rows for user_id |
| `analytics_events` | DELETE all rows for user_id |
| `feedback` | DELETE all rows for user_id |
| `newsletter_subscribers` | DELETE row matching user email |
| `users` | DELETE the user row |

### Audit Log
Do not delete audit log entries (immutable, 3-year retention per spec). Instead:
- Keep the event rows.
- Clear `email` and `user_id` fields (set to NULL or anonymized placeholder).
- This preserves the audit trail for compliance while removing PII.

### Stripe
If the user has an active Stripe subscription:
- Cancel the subscription via Stripe API before deleting user data.
- Do not issue refunds automatically — that's a separate process.

### Response
- Success: `200 { "deleted": true }`
- Auth failure: `401`
- Server error: `500`
