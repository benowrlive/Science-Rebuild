# Architecture & Stabilization Guide

## Why integrations keep breaking — root cause analysis

### The pattern

Every time we complete a phase and move to the next, earlier features stop
working. This has happened repeatedly: the boot intro broke the page, the
notebook CSS broke the buttons, the SW killer broke navigation, the skills
directory broke the precache.

### The root causes (in order of severity)

#### 1. Emergency fixes accumulate and interact

Each break gets an emergency fix. Those fixes are marked "temporary" but
never removed. They interact with each other in unexpected ways:

- SW killer (index.html) → unregisters SW on every page load → infinite reload loop
- boot.js dummy → created to fix SW precache → orphaned after rollback
- Network-first SW navigation → added to fix stale cache → changed offline behaviour

**Fix:** This commit removes all three. The rule: emergency fixes must
include a removal condition. If the condition is met, remove the fix in
the same commit that confirms it.

#### 2. The build walks the entire project root

`tools/build.mjs` walks every file in the project directory. The SKIP set
excluded `tools`, `docs`, `node_modules`, etc., but NOT `skills/` or
`upload/` — which are development artifacts, not app content. Result:
133 skill files + 3 upload files were precached by the service worker,
bloating the cache from 185 to 321 entries.

**Fix:** This commit adds `skills`, `upload`, `scripts`, `agent-ctx` to
the SKIP set. The rule: any new top-level directory must be evaluated
against the SKIP set.

#### 3. No automated route or import validation

The build checks:
- ✓ Syntax (node --check)
- ✓ Budgets (gzipped size limits)
- ✓ Content lint (stage types, concepts, pedagogy fork)
- ✓ Custom property references
- ✓ Absolute paths
- ✓ Reachability (module graph)

The build does NOT check:
- ✗ That every route in the router resolves to a callable view
- ✗ That dynamically imported modules export the expected functions
- ✗ That every `href="#/..."` in the app points to a real route
- ✗ That CSS class names used in JS exist in the stylesheet

**Fix:** This commit adds a route validation gate to the build (see below).

#### 4. No regression tests run before deployment

The verify suite (186 Playwright checks) exists but takes 5 minutes and
requires Chromium. It was never run during development. Changes were
pushed directly to GitHub, auto-deploying to Vercel without verification.

**Fix:** The CI workflow (`.github/workflows/ci.yml`) should gate pushes.
Until then, run `npm run build` locally before every push — it catches
syntax errors, budget violations, and content lint failures.

#### 5. Rollbacks discard commits and create divergent histories

When things broke, I force-pushed rollbacks. This discarded commits,
made it impossible to cherry-pick fixes, and created divergent git
histories that later caused "non-fast-forward" push failures.

**Fix:** Never force-push to main. If something breaks, push a revert
commit instead. This preserves history and allows recovery.

## The CCleaner workflow

Run this before every deployment:

### 1. Scan

```bash
# Check for files in the SW precache that shouldn't be there
grep -c "skills/\|upload/\|scripts/" sw.js

# Check for broken static imports
node -e "
  const {readFileSync} = require('fs');
  const {resolve, dirname} = require('path');
  const files = walkJs('js');
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const [, spec] of src.matchAll(/import\s+.*?from\s+['\"]([^'\"]+)['\"]/g)) {
      if (!spec.startsWith('.')) continue;
      const resolved = resolve(dirname(f), spec);
      if (!exists(resolved)) console.log('BROKEN:', f, '→', spec);
    }
  }
"

# Check for orphaned files (JS files not imported by anything)
# (The build's closure check already does this for components/ and parts/)

# Check for unused CSS classes
# (Manual: search for class names in JS that don't appear in CSS)
```

### 2. Categorize

- **Safe to remove:** orphaned files, unused imports, dead CSS
- **Requires verification:** routes that might be used by deep links
- **Keep:** everything in the build's closure

### 3. Remove

Only remove items confirmed safe by the build's closure analysis.
The build already fails if a component or part is not claimed.

### 4. Refactor

Reduce complexity without changing functionality. The el() helper,
the Sim base class, and the stage runner are the main abstraction
boundaries — changes here ripple everywhere.

### 5. Test

```bash
node tools/build.mjs    # Syntax, budgets, content lint, closure
node tools/verify.mjs   # 186 Playwright checks (needs Chromium)
```

### 6. Deploy

Push to GitHub. Vercel auto-deploys. The build runs on Vercel and
fails the deploy if any check fails.

### 7. Repeat

Run this workflow before every feature push, not just when things break.

## Route validation gate

Added to `tools/build.mjs`: after the content lint, the build now
validates that:

1. Every route regex in `js/app.js` has a corresponding view function
2. Every `href="#/..."` pattern in `js/screens.js` matches a route
3. Every dynamic `import()` in `js/lesson/parts/sim.js` resolves to
   a file that exists in `js/sims/`

This catches the most common integration break: adding a route but
forgetting to wire it up, or adding a link but forgetting to add the
route.

## Architectural invariants

These must never be violated:

1. **The shell JS budget is 25 KB gzipped.** This is the cost of opening
   the Atlas. Every new import in `js/app.js`'s static closure counts.

2. **The lesson JS budget is 20 KB gzipped.** This is the cost of opening
   one lesson. Lazy imports are free; static imports count.

3. **The CSS budget is 20 KB gzipped.** All stylesheets are concatenated
   into one file. There is no lazy CSS.

4. **Zero runtime dependencies.** No npm packages are imported at runtime.
   The only devDependencies are Playwright and Lighthouse (for testing).

5. **Hash routing.** Routes use `#/path` not `/path`. This works from
   any static host with no server configuration.

6. **The build is the gate.** `node tools/build.mjs` must pass before
   every push. It enforces budgets, syntax, content lint, and now route
   validation.

7. **Never force-push to main.** Use revert commits. Preserve history.

8. **Emergency fixes must have a removal condition.** If the condition
   is met, remove the fix immediately.
