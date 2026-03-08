# App Privacy Inventory

Data collection inventory based on actual implementation audit. Source of truth for App Store Connect privacy declarations.

## Data Collection

| Data Type | Where Collected | Purpose | Linked to User | Used for Tracking | Source |
|-----------|----------------|---------|---------------|-------------------|--------|
| Email address | Registration, Google OAuth | Account identity, communication | Yes | No | First-party |
| Name | Registration, Google OAuth | Display name | Yes | No | First-party |
| Password hash | Registration | Authentication | Yes | No | First-party |
| Google OAuth subject ID | Google sign-in | Federated auth | Yes | No | Google |
| Session cookie | Every request | Session management | Yes | No | First-party |
| IP address | Every request | Abuse detection, geo analytics | Yes (sessions, analytics) | No (internal only) | First-party |
| User agent | Every request | Session tracking, analytics | Yes (sessions) | No | First-party |
| Uploaded photos | Mushroom identification | AI identification | Yes | No | First-party |
| Photo metadata (size, hash, MIME) | Upload | Integrity, dedup | Yes | No | First-party |
| Identification results | Kindwise API response | Display to user | Yes | No | Third-party (Kindwise) |
| Geolocation (country, city) | ip-api.com lookup | Analytics dashboard | Linked via event | No (internal only) | Third-party (ip-api.com) |
| Payment info | Stripe checkout | Subscription billing | Yes (via Stripe customer ID) | No | Third-party (Stripe) |
| Feedback messages | In-app form | Product improvement | Yes | No | First-party |
| Newsletter email | Subscription form | Newsletter delivery | Yes | No | First-party |
| Scan counts/quotas | Each scan | Rate limiting | Yes (by user ID or IP) | No | First-party |
| Audit log | Auth, payment events | Compliance, fraud | Yes | No | First-party, 3-year retention |

## Third-Party Services

| Service | Data Shared | Purpose |
|---------|------------|---------|
| Kindwise | Uploaded photos | Mushroom species identification |
| Stripe | Email, payment method (via Stripe.js) | Subscription billing |
| Google | OAuth token exchange | Authentication |
| Resend | Email address | Transactional email delivery (welcome, password reset) |
| ip-api.com | IP address | IP geolocation for analytics |
| Turso | All database contents | Database hosting (LibSQL) |

## What We Do NOT Collect

- No third-party analytics SDKs.
- No advertising identifiers.
- No tracking pixels.
- No IDFA/IDFV collection.
- No crash reporting SDK (no crash data currently collected).

## App Store Connect — App Privacy Label Categories

Based on the data above, declare the following in App Store Connect:

- **Contact Info**: Email address, name
- **Identifiers**: User ID
- **Usage Data**: Product interaction (scans, page views via analytics_events)
- **Photos or Videos**: Uploaded mushroom photos
- **Financial Info**: Purchase history (via Stripe customer ID linkage)
- **Diagnostics**: None currently collected

All data categories are used for **App Functionality** — none for **Tracking** or **Third-Party Advertising**.
