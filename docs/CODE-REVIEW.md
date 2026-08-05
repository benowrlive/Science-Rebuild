# Code Quality & Maintainability Review

## Executive Summary

The codebase is **functional but accumulating technical debt** from rapid
feature development. There are **11 confirmed issues** across 6 categories.
None are critical bugs, but several affect maintainability and budget
headroom. The CSS budget is at 95% (19.0/20 KB) and the JS budget at 99%
(24.7/25 KB) — both need relief before new features can be added.

---

## 1. DEAD CODE

### 1.1 UNUSED EXPORTS in curriculum.js

| Export | Used? | Impact of removal | Risk |
|---|---|---|---|
| `getWorld(id)` | Yes (4 refs) | Keep | — |
| `worldHasContent` | **No** (0 refs outside curriculum.js) | Remove | None — internal function, only called by `playableWorlds` which is in the same file. Can be inlined or kept as private. |
| `allSpecimens()` | **No** (0 refs outside curriculum.js) | Remove export, keep as private | None — `specimensByWorld()` calls it internally. Make it non-exported. |
| `comingWorlds` | Yes (2 refs) | Keep | — |

**Recommendation:** Remove `export` from `worldHasContent` and `allSpecimens`. They are internal helpers. Saves ~20 bytes gzipped.

### 1.2 UNUSED EXPORTS in state.js

| Export | Used? | Impact | Risk |
|---|---|---|---|
| `VERSION` | **No** (0 refs outside state.js) | Remove export | None — it's used internally by `migrate()`. Make it `const` without export. |
| `flush` | Yes (6 refs) | Keep | — |

**Recommendation:** Remove `export` from `VERSION`. Saves ~10 bytes.

### 1.3 UNUSED EXPORTS in level.js

| Export | Used? | Impact | Risk |
|---|---|---|---|
| `DEFAULT_LEVEL` | **No** (0 refs outside level.js) | Remove export | None — used internally as fallback in `prose()` and `content()`. Make non-exported. |

**Recommendation:** Remove `export` from `DEFAULT_LEVEL`. Saves ~15 bytes.

### 1.4 UNUSED CSS CLASSES

| Class | Used in JS? | Impact | Risk |
|---|---|---|---|
| `.skeleton` | **No** (0 JS refs) | Remove CSS | None — was intended for loading states but never implemented in JS. |
| `.stage-exit` / `@keyframes stage-exit` | **No** (0 JS refs) | Remove CSS | None — the `m-exit` class is never added to any element. |
| `.boot-ring` `.boot-dot` `.boot-title` `.boot-tag` `.boot-hint` | **No** (0 JS refs) | Remove CSS | Low — these were for the boot intro which was removed. The `boot.js` file was deleted. **Verify no HTML references exist first.** |

**Recommendation:** Remove these 7 CSS rules. Saves ~400 bytes gzipped.

### 1.5 UNUSED FILE: styleguide.html + styleguide.js

| File | Used? | Impact | Risk |
|---|---|---|---|
| `styleguide.html` | **Dev-only** (0 refs in index.html, in DEV_ONLY set) | Keep as dev tool | — It's already excluded from the precache and budget. |
| `styleguide.js` | **Dev-only** (0 imports) | Keep as dev tool | — Same as above. |

**Recommendation:** Keep. Already correctly excluded from production.

### 1.6 UNUSED FILE: tools/preview.mjs

| File | Used? | Impact | Risk |
|---|---|---|---|
| `tools/preview.mjs` | **No** (not in package.json scripts) | Remove or document | None — appears to be a dev utility for screenshotting. Not wired to any npm script. |

**Recommendation:** Document its purpose in a comment or remove. Low priority.

---

## 2. DUPLICATE LOGIC

### 2.1 DUPLICATE CSS DEFINITIONS (CRITICAL)

| Selector | Count | Lines | Impact |
|---|---|---|---|
| `.continue` | **3 definitions** | Lines 51, 407, 651 | The last definition wins, but earlier ones waste bytes and create confusion. ~200 bytes wasted. |
| `.choices` | **2 definitions** | Lines 214, 475 | Identical content, pure duplication. ~80 bytes wasted. |
| `.specimens` | **2 definitions** | Lines 460, 685 | Near-identical, minor differences in `grid-template-columns`. ~100 bytes wasted. |

**Recommendation:** Remove all but the last (or best) definition of each. Saves ~380 bytes gzipped. **This is the single highest-impact cleanup.**

### 2.2 DUPLICATE `setPref` FUNCTION

`screens.js` line 226 defines a local `setPref` function:
```js
function setPref(key, value) { update((p) => { p.prefs[key] = value || null; }); }
```

This shadows the imported `setPref` from `state.js` (which was already removed from the import). The local function is correct but creates confusion — the same pattern exists in `welcome.js` which imports `setPref` from `state.js`.

**Recommendation:** Move `setPref` to `state.js` as a proper export, import it everywhere. Eliminates the local duplicate. Saves ~50 bytes.

### 2.3 DUPLICATE CONTENT IN components.css

The file has **two major sections** that redefine the same components:
- Lines 1-260: Original component styles (claymorphic)
- Lines 300+: "Colorful" section that overrides them

The original styles are dead weight — the colorful section always wins via cascade.

**Recommendation:** Remove the original claymorphic definitions that are fully overridden. Saves ~1-2 KB gzipped. **Highest single cleanup.**

---

## 3. OVERLY COMPLEX IMPLEMENTATIONS

### 3.1 paintToken Guard in app.js

```js
const token = ++paintToken;
const nodes = await view();
if (token !== paintToken) return;
```

This guard was added to prevent stale async paints, but it caused the
navigation bug where `setPref + location.hash` races cancelled legitimate
paints. The `fp:repaint` event was added as a workaround.

**Problem:** Two mechanisms doing the same job (preventing stale paints),
neither fully correct.

**Recommendation:** Remove the paintToken guard. The `fp:repaint` event
plus the `subscribe()` callback is sufficient. The guard adds complexity
and was the root cause of the navigation bug. Saves ~100 bytes and
eliminates a class of race conditions.

### 3.2 `needsWelcome` + `needsPicker` Gate Chain

```js
const view = needsWelcome() ? lazyWelcome : needsPicker() ? levelPicker : resolve();
```

Three states for the initial view. `needsWelcome` checks
`progress.prose == null && !progress.prefs?.greeted`. `needsPicker`
checks `progress.prose == null`. These overlap — if `greeted` is set
but `prose` is null, `needsPicker` returns true. This is correct but
fragile — adding a fourth gate (e.g. `needsIntro`) would make it
unmaintainable.

**Recommendation:** Consolidate into a single `initialView()` function
that returns the correct view. Document the state machine.

---

## 4. LEGACY CODE

### 4.1 `fp:repaint` Event (Temporary Workaround)

The `fp:repaint` custom event was added as a workaround for the paintToken
race. If the paintToken guard is removed (see 3.1), the `fp:repaint`
event becomes unnecessary — the `subscribe()` callback alone handles
repaints correctly.

**Recommendation:** Remove after removing paintToken guard. Test
navigation thoroughly before deploying.

### 4.2 Emergency SW Fixes (Mostly Cleaned)

The SW killer was removed. The dummy `boot.js` file was removed. The
network-first SW navigation was reverted to cache-first. These are all
clean now, but the `ARCHITECTURE.md` still references them.

**Recommendation:** Update `ARCHITECTURE.md` to reflect current state.

### 4.3 `tools/palette.py` + `tools/gen-palette.py`

`gen-palette.py` imports `palette.py`. Both exist. `palette.py` contains
the colour solver; `gen-palette.py` calls it. This is correct but
confusing — two files for one job.

**Recommendation:** Merge into a single `tools/gen-palette.py`. Low
priority.

---

## 5. FILES THAT APPEAR ABANDONED

### 5.1 `docs/PHASE-1-BLUEPRINT.md` (44 KB)

The original project blueprint. Still referenced in README and DECISIONS
but describes a phase-1 plan that is long completed.

**Recommendation:** Keep for historical reference. Move to `docs/archive/`
if it clutters.

### 5.2 `docs/child-test-sheet.html`

A standalone HTML file for child testing. Not linked from the app.

**Recommendation:** Keep. Dev tool, correctly excluded from production.

### 5.3 `docs/AUTHORING.md` vs `docs/AUTHORING-GUIDE.md`

Two authoring docs:
- `AUTHORING.md` — the technical spec (261 lines, for coders)
- `AUTHORING-GUIDE.md` — the non-coder guide (322 lines, for teachers)

**Recommendation:** Keep both. Different audiences. Cross-reference them.

---

## 6. OPPORTUNITIES TO REDUCE TECHNICAL DEBT

### 6.1 CSS Consolidation (HIGH IMPACT)

**Problem:** `components.css` is 58 KB raw / 11 KB gzipped. It has
~200 duplicate or overridden rules from the multiple UI phases
(notebook → colorful → vivid). The file was built by appending blocks
without removing superseded ones.

**Plan:**
1. Remove all duplicate `.continue`, `.choices`, `.specimens` definitions
2. Remove the original claymorphic styles that are overridden by the
   colorful section
3. Remove dead boot-intro CSS (7 rules)
4. Remove `.skeleton` and `.stage-exit` (never used in JS)
5. Consolidate `.shelf-*` rules (scattered across the file)

**Estimated savings:** 1.5-2.5 KB gzipped (from 19.0 to ~17 KB)
**Risk:** Low — CSS cascade means last-definition-wins, so removing
earlier duplicates changes nothing visually.
**Verification:** Visual diff before/after on every screen.

### 6.2 JS Import Cleanup (MEDIUM IMPACT)

**Problem:** Multiple files import names they don't use, or import
from the wrong place.

**Plan:**
1. Remove `export` from `VERSION`, `DEFAULT_LEVEL`, `worldHasContent`,
   `allSpecimens` (make them private)
2. Move `setPref` to `state.js`, import it in `screens.js` and
   `welcome.js`
3. Remove the `paintToken` guard and `fp:repaint` event
4. Consolidate `needsWelcome` + `needsPicker` into a single function

**Estimated savings:** 200-300 bytes gzipped
**Risk:** Medium — removing paintToken changes the paint flow. Test
all navigation paths.

### 6.3 Generated Files in Git (LOW IMPACT)

`content/authored.json` and `content/reviews.json` are generated by
the build. They're committed to git, which is correct (the build
verifies they're up-to-date in CI). But they're 162 and 132 KB
respectively — large diffs when lessons change.

**Recommendation:** Keep. The CI `git diff --exit-code` check is the
right pattern. No action needed.

---

## CLEANUP PLAN (Ordered by Impact)

| Priority | Action | Savings | Risk | Effort |
|---|---|---|---|---|
| **1** | Remove duplicate CSS definitions (continue, choices, specimens, claymorphic overrides) | ~2 KB gz | Low | 30 min |
| **2** | Remove dead CSS (boot-intro, skeleton, stage-exit) | ~400 bytes gz | None | 10 min |
| **3** | Remove paintToken guard + fp:repaint event | ~200 bytes JS | Medium | 20 min + testing |
| **4** | Remove unused exports (VERSION, DEFAULT_LEVEL, worldHasContent, allSpecimens) | ~50 bytes JS | None | 10 min |
| **5** | Consolidate setPref to state.js | ~50 bytes JS | Low | 10 min |
| **6** | Merge palette.py + gen-palette.py | 0 (clarity) | None | 10 min |
| **7** | Document or remove tools/preview.mjs | 0 (clarity) | None | 5 min |

**Total estimated savings:** ~2.7 KB CSS + ~300 bytes JS = **~3 KB freed**

This would bring CSS from 19.0 to ~17 KB (85%) and JS from 24.7 to ~24.4
KB (98%), giving meaningful headroom for future features.

---

## RISKS BEFORE DELETION

1. **CSS removal:** Must visual-diff every screen after cleanup. The
   cascade means removing an earlier definition is safe IF a later one
   exists. But if a property only exists in the earlier definition,
   removing it changes the appearance.

2. **paintToken removal:** Must test: level picker → Atlas, Me → Atlas,
   Me → dev toggle → Atlas, lesson → back → Atlas, review flow. All
   must work without the guard.

3. **Export removal:** Must verify no dynamic `import()` or string
   reference uses the export name. Search for the name in ALL files,
   not just static imports.

4. **setPref consolidation:** Must verify the `update()` call signature
   matches — the local function uses `update((p) => { p.prefs[key] = value || null; })`
   which is correct, but the state.js version must match.
