# Contributing

## Branching
- Never commit directly to `main` after baseline.
- Create branches per item:
  - `feature/<backlog-id>-<short-name>`
  - `fix/<backlog-id>-<short-name>`

## Pull Requests
1. Open PR into `main`.
2. Reference backlog item (example: `BG-004`).
3. Complete PR template sections.
4. Ensure CI passes (`npm run check`, `npm test`).
5. Require review approval before merge.

## Merge Strategy
- Use squash merge with clear title:
  - `feat(BG-004): add user registration scaffold`
