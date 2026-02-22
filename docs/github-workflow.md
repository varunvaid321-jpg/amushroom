# GitHub Workflow

## Branch Strategy
- `main`: protected production branch
- feature branches: `feature/<ticket-or-topic>`
- fix branches: `fix/<ticket-or-topic>`

## PR Standards
1. Open PR against `main`.
2. Use PR template.
3. CI must pass (`npm run check`, `npm test`).
4. At least 1 review approval before merge.
5. Squash merge with clear commit message.

## Required Repository Settings
- Enable branch protection on `main`:
  - Require pull request before merging
  - Require approvals: 1+
  - Require status checks: `CI / validate`
  - Dismiss stale approvals on new commits
- Enable secret scanning and Dependabot alerts.

## Local Commands
```bash
npm run check
npm test
```
