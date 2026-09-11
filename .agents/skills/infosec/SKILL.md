---
name: infosec
description: |
  Security engineering and product infosec guardrail for sensitive application changes.
  ALWAYS use this skill whenever the task touches authentication, authorization,
  identification, identity, account lifecycle, user creation, roles, permissions,
  admin panels, release/deployment safety, secrets, sessions, tokens, password reset,
  MFA, SSO/OAuth/OIDC/SAML, API keys, audit logs, privacy-sensitive data, tenancy,
  billing access, or any feature where a mistake could expose data, grant privileges,
  bypass policy, weaken traceability, or create an abuse path. Trigger even if the user
  frames the task as ordinary backend/frontend work, a small UI change, a release task,
  a user-management feature, or "just add an admin action".
  DO NOT TRIGGER for unrelated visual-only changes, static marketing copy, or purely
  local developer tooling with no security, identity, data, release, or access boundary.
license: MIT
metadata:
  category: security
  version: "1.0.0"
---

# Infosec Guardrail

Use this skill as a security lens before and during work on sensitive product surfaces.
Its job is to prevent routine engineering changes from accidentally changing who can do
what, what data is exposed, how identity is trusted, or how risky code reaches users.

This is not a penetration-testing playbook. For authorized web/API security testing,
bug bounty routing, exploit validation, or vulnerability triage, use the relevant
security testing skill as well. For implementation, pair this skill with backend,
frontend, or design skills when those domains are also involved.

## Mandatory Workflow

When this skill triggers, follow these steps before editing code or changing config.

### Step 0: Classify the Security Surface

State which surfaces are involved:

- Authentication: login, signup, sessions, password reset, MFA, SSO, OAuth/OIDC/SAML.
- Authorization: RBAC/ABAC, ownership checks, tenancy, admin actions, feature flags.
- Identification: user IDs, emails, phone numbers, external identities, account linking.
- Account lifecycle: invites, user creation, role changes, deactivation, deletion.
- Admin and operations: admin panels, support impersonation, bulk actions, moderation.
- Secrets and credentials: API keys, tokens, cookies, env vars, webhooks, signing keys.
- Release safety: migrations, config changes, deployments, rollbacks, kill switches.
- Data protection: PII, private content, logs, exports, backups, retention, analytics.
- Abuse and fraud: rate limits, enumeration, brute force, replay, spam, privilege abuse.

If none apply, say why the skill is not materially involved and continue normally.

### Step 1: Define the Trust Boundary

Before implementation, identify:

- Actors: anonymous user, authenticated user, owner, admin, support, service account.
- Assets: accounts, tenant data, private records, billing controls, secrets, audit trail.
- Entry points: UI, API, background jobs, webhooks, CLI/admin scripts, migrations.
- Enforcement point: where the final server-side decision is made.
- Failure mode: what happens if the check is missing, stale, bypassed, or partially fails.

Prefer server-side enforcement over client-side hiding. Client UI may improve UX, but it
must not be the authority for access decisions.

### Step 2: Choose the Safe Design

Use these defaults unless the project clearly uses another established pattern:

- Deny by default; explicitly allow the smallest required action.
- Check permissions at the object/resource level, not only at route or page level.
- Keep authentication separate from authorization: "who are you" is not "may you do this".
- Make identity stable and unambiguous; avoid trusting mutable display names or emails
  when a durable user ID or provider subject is available.
- Avoid privilege changes hidden inside broad update endpoints.
- Require explicit confirmation and audit logging for sensitive admin actions.
- Store tokens and session secrets in httpOnly secure cookies or server-side stores when
  appropriate; do not leak secrets to localStorage, URLs, logs, analytics, or client config.
- Validate all inputs at the boundary, including IDs, role names, redirect URLs, callback
  state, file names, imported rows, webhook payloads, and admin form fields.
- Treat feature flags and admin UI visibility as convenience controls, not authorization.
- Plan rollback for release changes that affect auth, users, data access, or migrations.

### Step 3: Implementation Checklist

Before calling the work complete, verify the relevant items:

- [ ] Authenticated and unauthenticated paths behave intentionally.
- [ ] Unauthorized users cannot access, modify, enumerate, export, or infer protected data.
- [ ] Object ownership and tenant boundaries are checked server-side.
- [ ] Admin-only actions require an explicit server-side permission check.
- [ ] Role/permission changes cannot be self-granted unless explicitly designed and guarded.
- [ ] Password reset, invite, email change, MFA, and account-linking flows have expiration,
      single-use semantics where appropriate, replay protection, and safe error messages.
- [ ] OAuth/OIDC/SAML flows validate redirect/callback state, issuer, audience, nonce, and
      provider identity according to the project pattern.
- [ ] Sessions and tokens have sensible lifetime, revocation, rotation, and secure transport.
- [ ] API keys, secrets, tokens, and PII are not logged or exposed in errors, URLs, client
      bundles, telemetry, screenshots, fixtures, or committed files.
- [ ] Dangerous actions have audit logs with actor, target, action, timestamp, and outcome.
- [ ] Rate limiting or abuse controls exist for login, signup, reset, invite, verification,
      search/enumeration, and expensive admin actions when relevant.
- [ ] Release path includes migration safety, backwards compatibility, rollback, and config
      validation when security behavior changes.

### Step 4: Test the Negative Cases

Security work is not verified by the happy path alone. Add or run targeted checks for:

- Anonymous request to a protected endpoint.
- Authenticated user accessing another user's or another tenant's resource.
- Non-admin attempting an admin action directly through the API.
- Disabled/deleted/suspended user attempting to use an old session or token.
- Expired, reused, malformed, or tampered reset/invite/MFA/OAuth state token.
- Client-side route hidden but backend endpoint called manually.
- Migration or release flag in old and new states when both can exist during rollout.

Use the narrowest existing test framework first. If the repository lacks suitable tests,
perform a manual smoke test and clearly report the residual risk.

### Step 5: Handoff Summary

When reporting back, include:

- Security surface touched.
- Enforcement point and why it is the right boundary.
- Negative cases verified.
- Residual risks, assumptions, or follow-up hardening.
- Any release/rollback note if behavior, permissions, schema, config, or sessions changed.

## Red Flags

Pause and call out the risk before implementing if the request implies:

- "Just hide the button" as the only access control.
- Trusting role, user ID, tenant ID, price, plan, or permission from the client.
- Broad admin endpoints that can update arbitrary user fields.
- Changing auth/session/token behavior without tests or rollback.
- Disabling MFA, CSRF, CORS restrictions, signature checks, or audit logging for convenience.
- Putting secrets in frontend env vars, logs, database rows visible to users, or docs.
- Using email alone as a stable identity across providers without account-linking rules.
- Adding impersonation, support access, or bulk admin actions without audit and limits.
- Relaxing release gates for migrations that touch user, permission, or secret data.

If a red flag is present, explain the concern, propose a safer alternative, and ask for
confirmation only if the user still wants the risky direction.
