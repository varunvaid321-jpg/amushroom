# SaaS Billing Implementation — COMPLETED

**Reference**: `/docs/orangutany-payment-spec.md` (v2.0)

## All Tasks Complete (March 7 2026)

| Task | PR | Status |
|------|----|--------|
| Membership badge in header | #77 | Done |
| `/upgrade` dedicated page | #77 | Done |
| `/account/billing` dashboard | #77 | Done |
| Admin alert on Pro cap hit | #77 | Done |
| Logout refresh to homepage | #77 | Done |
| Immutable audit log | #78 | Done |
| Webhook returns 500 on errors | #79 | Done |
| PII removed from URL params | #79 | Done |
| Portal return → /account/billing | #79 | Done |
| Currency default fixed (usd) | #79 | Done |
| Monthly sub cancelled on lifetime upgrade | #80 | Done |
| Pending plan survives OAuth redirect | #80 | Done |
| Remove scan limit numbers from UI | #81 | Done |
| `membership_expires_at` column | #82 | Done |
| Payment spec updated to v2.0 | #82 | Done |

## Remaining (Non-Critical)

- **Payment reconciliation**: No automated mechanism to detect paid-but-not-upgraded users. Stripe retries for 3 days. Manual Stripe dashboard check if user reports issue.
- **Cross-site Pro badge**: guide.orangutany.com is fully static — showing Pro badge there would require cross-domain session (not implemented, low priority).
