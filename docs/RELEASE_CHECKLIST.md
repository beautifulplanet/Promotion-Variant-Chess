# Release Checklist

Run through this before every deploy. Takes ~5 minutes if everything passes.

---

## Pre-Deploy

### 1. Build Check
```bash
npx tsc --noEmit           # TypeScript compiles clean
npx vite build             # Production build succeeds
```

### 2. Unit Tests
```bash
npx vitest run                          # 420 frontend tests
cd server && npx vitest run && cd ..    # 168 server tests
cd rust-engine && cargo test && cd ..   # 218 engine tests
```
**Gate: all pass. No skips without tracking comment.**

### 3. Perft Quick Check
```bash
cd rust-engine && cargo test perft && cd ..
```
**Gate: depth 3/4/5 match reference values. If this fails, the engine is broken — do not deploy.**

### 4. E2E Suite
```bash
npx playwright test --project=chromium --workers=1
```
**Gate: all pass. Known flaky tests documented in TESTING.md.**

Note: Use `--workers=1` to avoid WASM overload. On CI with more RAM, `--workers=2` is fine.

### 5. Console Error Sanity
```bash
npx playwright test e2e/smoke.spec.ts -g "no console errors" --project=chromium
```
Or: open the game in Chrome, play 3 moves, check DevTools console. Filter out:
- Service worker registration (expected in dev)
- Favicon 404 (cosmetic)

### 6. Metrics Endpoint
```bash
curl https://[server-url]/health    # Should return 200 + JSON (uptime, connections)
curl https://[server-url]/metrics   # Should return 200 + Prometheus text format
```

### 7. Manual Spot Check (60 seconds)
- [ ] Load the page — dashboard appears
- [ ] Click Play — game starts, AI responds
- [ ] Make 3 moves — no errors, pieces animate
- [ ] Toggle Classic Mode — layout switches cleanly
- [ ] On mobile (or DevTools mobile emulator) — touch works, board fits

---

## Post-Deploy

- [ ] Check `/health` endpoint on production URL
- [ ] Check `/metrics` endpoint returns data
- [ ] Play one game against AI on production
- [ ] Check Fly.io logs for crash/restart (`fly logs`)

---

## Rollback

If something is broken in production:

```bash
# Vercel (frontend) — instant rollback in dashboard
# Or: git revert HEAD && git push

# Fly.io (server)
fly releases
fly deploy --image registry.fly.io/[app]:v[previous]
# Or: git revert HEAD && git push (auto-deploys)
```

---

## Load Test (before major releases only)

```bash
k6 run server/k6/http-load.js --vus=50 --duration=60s
k6 run server/k6/ws-load.js --vus=100 --duration=60s
k6 run server/k6/stress.js --vus=200 --duration=120s
```

**Look for:** P95 < 500ms, error rate < 5%, no crash.
