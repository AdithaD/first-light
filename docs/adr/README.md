# Decision Records

Every locked decision gets an ADR here. Format: context → decision →
alternatives → consequences. Decisions change only with owner approval,
recorded as a new/amended ADR **before** code changes.

| ADR | Title | Status |
|---|---|---|
| [ADR-0001](ADR-0001-cloudflare-hosting.md) | Cloudflare hosting + portability charter | Accepted |
| [ADR-0002](ADR-0002-d1-database.md) | Cloudflare D1 database | Accepted |
| [ADR-0003](ADR-0003-ai-provider.md) | AI provider: Summariser interface over Workers AI | Accepted |
| [ADR-0004](ADR-0004-email-delivery.md) | Email delivery via Resend | Accepted |
| [ADR-0005](ADR-0005-authentication.md) | Auth: Lucia-style sessions; email+password & Google OAuth equal | Accepted |

## Template

```markdown
# ADR-NNNN — Title
Date / Status / Deciders
## Context
## Decision
## Alternatives considered
## Consequences & triggers to revisit
```
