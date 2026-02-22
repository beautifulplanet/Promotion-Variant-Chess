---
name: Change / Feature
about: Scope a change before implementing it
title: "[CHANGE] "
labels: ''
assignees: ''
---

## Scope

**What user-visible behavior will change?**


**Which files / modules are affected?**


**Is this in-scope per [SCOPE.md](../../docs/SCOPE.md)?**
- [ ] Yes — covered by MVP or In Scope table
- [ ] No — justification:

---

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

---

## Edge Cases

| Case | Expected behavior |
|---|---|
| | |
| | |

---

## What Could Break

- Risk 1 →  mitigation
- Risk 2 →  mitigation

---

## Rollback Plan

How to undo this if it goes wrong:

- [ ] Revert commit
- [ ] Feature toggle: set `X` to `false`
- [ ] Other:

---

## Definition of Done

```
- [ ] Relevant tests pass (unit + E2E subset)
- [ ] No new console errors in E2E run
- [ ] No new TODOs without tracking
- [ ] Risky changes have rollback path
- [ ] Commit message includes: what changed, what could break, what proves it didn't
```
