# Definition of Done

Every change — feature, fix, refactor — must pass this checklist before merge/deploy.

---

## Fast Checklist (copy into PR or commit message)

```
- [ ] Relevant tests pass (unit + E2E subset)
- [ ] No new console errors in E2E run
- [ ] No new TODOs without a tracking comment (// TODO(#issue): reason)
- [ ] Risky changes have rollback path or feature toggle
- [ ] Change answers: what behavior changed? what could break? what proves it didn't?
```

---

## Detail

### 1. Tests Pass

| Layer | Command | Must pass |
|---|---|---|
| Frontend unit | `npx vitest run` | All 420 |
| Rust engine | `cargo test` (in rust-engine/) | All 218 |
| Server unit | `npx vitest run` (in server/) | All 168 |
| E2E (relevant) | `npx playwright test <changed-area> --project=chromium --workers=1` | All touched |
| E2E (full, before deploy) | `npx playwright test --project=chromium --workers=1` | All |

### 2. No Console Errors

Run E2E or manual browser test. Filter out known noise:
- Service worker registration (expected in dev)
- Favicon 404 (cosmetic)
- Manifest warnings (cosmetic)

**Any `TypeError`, `ReferenceError`, `Uncaught`, or red error = not done.**

### 3. No Orphan TODOs

Every `TODO` in code must have:
```typescript
// TODO(#123): description    ← linked to an issue/tracking item
// TODO(scope): description   ← linked to SCOPE.md non-goal
```

Not acceptable:
```typescript
// TODO: fix this later        ← no tracking, will rot
// HACK: temporary             ← no tracking, will rot
```

### 4. Rollback / Safe Failure

For risky changes (new features, protocol changes, DB migrations):

| Risk level | Required |
|---|---|
| Low (CSS, copy, docs) | Nothing extra |
| Medium (new UI feature) | Feature can be toggled off or hidden behind flag |
| High (protocol, DB schema, auth) | Tested rollback path documented in commit message |

### 5. Ship Narrative

Every update should be describable in three sentences:

1. **What user-visible behavior changed?** (e.g., "Welcome dashboard appears on load")
2. **What could break?** (e.g., "Existing E2E tests need to dismiss the dashboard first")
3. **What test/metric proves it didn't?** (e.g., "All 5 smoke tests pass with new dismissDashboard helper")

Include these in the commit message body or PR description.

---

## Commit Message Format

```
type: short description (imperative mood)

What changed (user-visible):
- ...

What could break:
- ...

Proof it didn't:
- ... tests pass
- ... manual check on mobile
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `chore`
