# Production Readiness Plan (Multi-Month Roadmap)

Scope confirmed (security, performance, UX, deployment hardening):
- localStorage validation + checksum
- CSP + self-host fonts
- WASM security headers + hosting config
- XSS sanitization (move quality UI)
- Rate limiting localStorage writes
- Security tests + CI
- Image compression + responsive images
- Three.js performance (instancing/culling)
- Lazy-loading/code-splitting
- Dependency updates (three/chess.js/stockfish)
- PWA/offline + service worker
- Analytics + monitoring
- Error boundaries + global error handling
- Accessibility improvements

---

## Phase 0: Baseline + Guardrails (Week 0-1)

### Task 0.1: Establish deployment-safe branch policy
Plan A (GitHub Actions + protected main)
- Technical steps:
  1) Configure branch protection rules on main (require PR, status checks).
  2) Add CI workflow to run `npm run build` and `npm run test`.
  3) Require review for changes touching src/saveSystem.ts, src/main-3d.ts, src/renderer3d.ts.
Plan B (Lightweight, local-only gate)
- Technical steps:
  1) Add npm script `prepush` to run `npm run test` and `npm run build`.
  2) Document local checklist in README.
Plan C (TBD)
- Note: If GitHub permissions are limited, we will fall back to Plan B and revisit.

### Task 0.2: Create security test harness skeleton
Plan A (Vitest + jsdom)
- Technical steps:
  1) Add tests/security.test.ts with fixtures for localStorage validation.
  2) Add a helper to reset localStorage between tests.
  3) Wire into `npm run test`.
Plan B (Separate npm script)
- Technical steps:
  1) Add `npm run test:security` to isolate security tests.
  2) Run it in CI after standard tests.
Plan C (TBD)

---

## Phase 1: Critical Security Fixes (Week 1-2)

### Task 1.1: Validate localStorage save data
Plan A (Zod schema validation)
- Technical steps:
  1) Define SaveData schema in src/saveSystem.ts.
  2) Replace direct JSON parse with `schema.safeParse`.
  3) Clamp or drop invalid fields; fall back to defaults.
  4) Add tests for malicious payloads (overflow, Infinity, arrays).
Plan B (Manual validation)
- Technical steps:
  1) Implement per-field guards (min/max/int checks).
  2) Sanitize arrays (max length, enum values).
  3) Add tests for worst-case payloads.
Plan C (TBD)

### Task 1.2: Add checksum to save files
Plan A (SHA-256 + salt)
- Technical steps:
  1) Add a checksum field to SaveData.
  2) Compute checksum from stable JSON + app salt.
  3) Validate checksum on load and reject on mismatch.
Plan B (Simple hash)
- Technical steps:
  1) Use a small non-crypto hash for tamper detection.
  2) Log and revert to default on mismatch.
Plan C (TBD)

### Task 1.3: Rate-limit localStorage writes
Plan A (Debounce)
- Technical steps:
  1) Add a debounced save function in saveSystem.ts.
  2) Replace direct localStorage writes with debounced writes.
  3) Guard against QuotaExceededError.
Plan B (Write batching)
- Technical steps:
  1) Buffer changes and flush at fixed intervals.
  2) Trigger immediate flush on unload.
Plan C (TBD)

### Task 1.4: XSS sanitization in move quality UI
Plan A (Escape HTML)
- Technical steps:
  1) Add sanitize helper to moveQualityAnalyzer.ts.
  2) Apply before inserting notation into DOM.
  3) Add tests with injected markup.
Plan B (Text-only insertion)
- Technical steps:
  1) Replace innerHTML usage with textContent where possible.
  2) Ensure downstream UI supports plain text.
Plan C (TBD)

### Task 1.5: CSP + self-host fonts
Plan A (Self-host + strict CSP)
- Technical steps:
  1) Download fonts and serve from /public/fonts.
  2) Update index.html to local font sources.
  3) Add CSP meta tag (or server header) to allow only self.
Plan B (CSP with Google Fonts)
- Technical steps:
  1) Add CSP that allows fonts.googleapis.com + fonts.gstatic.com.
  2) Add preconnect links for performance.
Plan C (TBD)

### Task 1.6: WASM security headers
Plan A (GitHub Pages headers)
- Technical steps:
  1) Add _headers file (if supported by host) for wasm MIME + COOP/COEP.
  2) Verify wasm loads without blocking.
Plan B (App-level fallback)
- Technical steps:
  1) Detect wasm init failures and fallback to chess.js.
  2) Log diagnostic details for later hosting changes.
Plan C (TBD)

---

## Phase 2: Stability + Error Boundaries (Week 2-4)

### Task 2.1: Global error boundary for Three.js init
Plan A (Try/catch + fatal UI overlay)
- Technical steps:
  1) Wrap renderer init in try/catch in main-3d.ts.
  2) Add showFatalError() overlay function.
  3) Add window error/unhandledrejection handlers.
Plan B (Graceful 2D fallback)
- Technical steps:
  1) Detect WebGL failure and switch to 2D renderer.
  2) Show a banner indicating fallback mode.
Plan C (TBD)

### Task 2.2: Defensive runtime checks
Plan A (Guard rails)
- Technical steps:
  1) Validate DOM nodes before use.
  2) Add assertions around renderer state sync.
Plan B (Centralized guard module)
- Technical steps:
  1) Create util `assertPresent()` helper.
  2) Replace repeated guards with helper usage.
Plan C (TBD)

---

## Phase 3: Performance + Asset Optimization (Week 4-8)

### Task 3.1: Compress large image assets
Plan A (WebP + responsive variants)
- Technical steps:
  1) Convert oversized PNG to WebP (multiple sizes).
  2) Use <picture> to serve responsive sizes.
Plan B (Lazy-load hero)
- Technical steps:
  1) Load large image only after first render.
  2) Use placeholder image before load.
Plan C (TBD)

### Task 3.2: Three.js instancing + culling
Plan A (InstancedMesh)
- Technical steps:
  1) Replace piece meshes with InstancedMesh.
  2) Update per-instance transforms per frame.
Plan B (Mesh pooling)
- Technical steps:
  1) Pool piece meshes and reuse instead of recreate.
  2) Enable frustum culling on board sections.
Plan C (TBD)

### Task 3.3: Lazy-load heavy modules
Plan A (Dynamic import)
- Technical steps:
  1) Split renderer3d.ts into core + extras.
  2) Load extras only after first user interaction.
Plan B (Route-level split)
- Technical steps:
  1) Move optional features into separate entrypoints.
  2) Load only in relevant modes (training, AI).
Plan C (TBD)

---

## Phase 4: Dependencies + Tooling (Week 6-10)

### Task 4.1: Update dependencies safely
Plan A (Incremental updates)
- Technical steps:
  1) Update three.js to latest compatible version.
  2) Update chess.js to latest; fix API changes.
  3) Evaluate stockfish.js replacement with wasm.
Plan B (Staged upgrades)
- Technical steps:
  1) Update three.js only; stabilize.
  2) Update chess.js in a separate PR.
Plan C (TBD)

### Task 4.2: Add monitoring + analytics
Plan A (Plausible or Umami)
- Technical steps:
  1) Add privacy-respecting analytics script.
  2) Track only high-level events (start game, undo, etc).
Plan B (Self-hosted logs)
- Technical steps:
  1) Use local event batching and export via file.
  2) Provide opt-in toggle.
Plan C (TBD)

---

## Phase 5: UX + Accessibility (Week 8-12)

### Task 5.1: Accessibility pass
Plan A (ARIA + keyboard nav)
- Technical steps:
  1) Add aria-labels to controls.
  2) Add keyboard shortcuts for critical actions.
Plan B (Minimal critical a11y)
- Technical steps:
  1) Add aria-labels only.
  2) Provide a help modal for shortcuts.
Plan C (TBD)

### Task 5.2: PWA + offline
Plan A (Vite PWA)
- Technical steps:
  1) Add manifest.json and icons.
  2) Add service worker for asset caching.
Plan B (Basic offline caching)
- Technical steps:
  1) Use a simple service worker to cache only static assets.
  2) Skip runtime caching for API (none used).
Plan C (TBD)

---

## Tracking

- Status values: Not Started, In Progress, Blocked, Done
- Each task will have a micro-task checklist created at execution time.
- We will not touch out-of-scope areas.

