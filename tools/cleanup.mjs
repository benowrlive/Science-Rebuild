/* Automated cleanup scanner. Run: node tools/cleanup.mjs
   Scans the codebase for dead code, duplicates, and issues.
   Does NOT modify files — it reports only. Manual review required.

   Categories checked:
   1. Unused exports (exported but never imported elsewhere)
   2. Duplicate CSS selectors (same selector defined multiple times)
   3. Dead CSS classes (defined but never referenced in JS)
   4. Broken imports (import paths that don't resolve)
   5. Orphaned files (JS files not imported by anything)
   6. Files in precache that shouldn't be (skills/, upload/, etc.)
   7. Duplicate function definitions in the same file */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, extname, basename, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["tools", "docs", "node_modules", ".git", ".github", "shots", "skills", "upload", "scripts", "agent-ctx"]);
const problems = [];
const warnings = [];
const pass = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => { warnings.push(msg); console.log(`  ⚠ ${msg}`); };
const fail = (msg) => { problems.push(msg); console.log(`  ✗ ${msg}`); };

function walk(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(relative(ROOT, p).replaceAll("\\", "/"));
  }
  return out;
}

const files = walk().filter(f => f.endsWith(".js") || f.endsWith(".css") || f.endsWith(".html") || f.endsWith(".json"));
const jsFiles = files.filter(f => f.endsWith(".js"));
const cssFiles = files.filter(f => f.endsWith(".css"));

console.log(`\nCleanup scan: ${files.length} files (${jsFiles.length} JS, ${cssFiles.length} CSS)\n`);

// --- 1. Unused exports ---
console.log("1. Checking for unused exports...");
const allExports = new Map(); // export name -> [file]
const allImports = new Map(); // import name -> [file]

for (const f of jsFiles) {
  const src = readFileSync(join(ROOT, f), "utf8");
  // Find exports
  for (const m of src.matchAll(/export\s+(?:const|let|function|async function|class)\s+(\w+)/g)) {
    const name = m[1];
    if (!allExports.has(name)) allExports.set(name, []);
    allExports.get(name).push(f);
  }
  // Find imports
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
    for (const name of m[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0].trim())) {
      if (!allImports.has(name)) allImports.set(name, []);
      allImports.get(name).push(f);
    }
  }
  // Find dynamic imports
  for (const m of src.matchAll(/import\([^)]+\)\.then\(\(m\)\s*=>\s*m\.(\w+)/g)) {
    const name = m[1];
    if (!allImports.has(name)) allImports.set(name, []);
    allImports.get(name).push(f);
  }
}

let unusedCount = 0;
for (const [name, exportFiles] of allExports) {
  const importFiles = allImports.get(name) || [];
  // Filter out self-imports (file imports its own export — shouldn't happen but safe)
  const externalImports = importFiles.filter(f => !exportFiles.includes(f));
  if (externalImports.length === 0 && exportFiles.length > 0) {
    // Check if it's used as a string reference (e.g. in template literals)
    let stringRef = false;
    for (const f of jsFiles) {
      const src = readFileSync(join(ROOT, f), "utf8");
      if (src.includes(`"${name}"`) || src.includes(`'${name}'`)) {
        stringRef = true;
        break;
      }
    }
    if (!stringRef) {
      warn(`Unused export: ${name} (exported from ${exportFiles.join(", ")})`);
      unusedCount++;
    }
  }
}
if (unusedCount === 0) pass("No unused exports found");

// --- 2. Duplicate CSS selectors ---
console.log("\n2. Checking for duplicate CSS selectors...");
const cssSrc = readFileSync(join(ROOT, "css/components.css"), "utf8");
const selectorCounts = new Map();
for (const m of cssSrc.matchAll(/^(\.[a-zA-Z][\w-]*)\s*\{/gm)) {
  const sel = m[1];
  selectorCounts.set(sel, (selectorCounts.get(sel) || 0) + 1);
}
let dupCount = 0;
for (const [sel, count] of selectorCounts) {
  if (count > 1) {
    fail(`Duplicate CSS: ${sel} defined ${count} times`);
    dupCount++;
  }
}
if (dupCount === 0) pass("No duplicate CSS selectors found");

// --- 3. Dead CSS classes (defined but not in JS) ---
console.log("\n3. Checking for dead CSS classes...");
const cssClasses = new Set();
for (const m of cssSrc.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
  cssClasses.add(m[1]);
}
let allJsSrc = "";
for (const f of jsFiles) allJsSrc += readFileSync(join(ROOT, f), "utf8") + "\n";
const htmlSrc = readFileSync(join(ROOT, "index.html"), "utf8");
allJsSrc += htmlSrc;

let deadCount = 0;
for (const cls of cssClasses) {
  // Skip common utility classes
  if (["pressable", "sr-only", "skip-link", "icon", "m-enter", "m-attend", "m-stagger"].includes(cls)) continue;
  if (!allJsSrc.includes(cls) && !htmlSrc.includes(cls)) {
    // Check if it's a sub-class (e.g. "badge--earned" might be referenced as template literal)
    const pattern = new RegExp(`\\b${cls}\\b`);
    if (!pattern.test(allJsSrc)) {
      warn(`Dead CSS class: .${cls} (not referenced in any JS or HTML)`);
      deadCount++;
    }
  }
}
if (deadCount === 0) pass("No dead CSS classes found");

// --- 4. Broken imports ---
console.log("\n4. Checking for broken imports...");
let brokenCount = 0;
for (const f of jsFiles) {
  const src = readFileSync(join(ROOT, f), "utf8");
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?\bfrom\s+)?["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const resolved = join(dirname(f), spec).replaceAll("\\", "/");
    if (!existsSync(join(ROOT, resolved)) && !existsSync(join(ROOT, resolved + ".js")) && !existsSync(join(ROOT, resolved + "/index.js"))) {
      fail(`Broken import: ${f} → ${spec} (resolved: ${resolved})`);
      brokenCount++;
    }
  }
}
if (brokenCount === 0) pass("No broken imports found");

// --- 5. Orphaned JS files ---
console.log("\n5. Checking for orphaned JS files...");
const allReferenced = new Set(["js/app.js", "js/welcome.js"]); // entry points
for (const f of jsFiles) {
  const src = readFileSync(join(ROOT, f), "utf8");
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?\bfrom\s+)?["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const resolved = join(dirname(f), spec).replaceAll("\\", "/");
    allReferenced.add(resolved);
  }
  // Also check dynamic imports
  for (const m of src.matchAll(/import\(["']([^"']+)["']\)/g)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const resolved = join(dirname(f), spec).replaceAll("\\", "/");
    allReferenced.add(resolved);
  }
}
let orphanCount = 0;
for (const f of jsFiles) {
  if (!allReferenced.has(f) && f !== "js/app.js" && f !== "js/welcome.js" && f !== "styleguide.js") {
    // Check if it's registered in SIMS or loaded dynamically
    const src = readFileSync(join(ROOT, f), "utf8");
    if (src.includes("customElements.define")) {
      // It's a custom element — check if the tag name is used elsewhere
      const tagMatch = src.match(/customElements\.define\(["']([^"']+)["']/);
      if (tagMatch) {
        const tag = tagMatch[1];
        let found = false;
        for (const f2 of jsFiles) {
          if (f2 === f) continue;
          const s2 = readFileSync(join(ROOT, f2), "utf8");
          if (s2.includes(tag)) { found = true; break; }
        }
        if (!found) {
          warn(`Orphaned file: ${f} (custom element ${tag} not used anywhere)`);
          orphanCount++;
        }
      }
    } else if (f.startsWith("js/sims/")) {
      // Sims are loaded dynamically by name — check if registered in sim.js
      const simName = basename(f, ".js");
      const simSrc = readFileSync(join(ROOT, "js/lesson/parts/sim.js"), "utf8");
      if (!simSrc.includes(simName)) {
        warn(`Orphaned sim: ${f} (not registered in sim.js)`);
        orphanCount++;
      }
    }
  }
}
if (orphanCount === 0) pass("No orphaned JS files found");

// --- 6. Files in precache that shouldn't be ---
console.log("\n6. Checking precache for junk files...");
const swSrc = readFileSync(join(ROOT, "sw.js"), "utf8");
for (const dir of ["skills/", "upload/", "scripts/", "agent-ctx/", ".git/"]) {
  if (swSrc.includes(`"${dir}`)) {
    fail(`Precache contains files from ${dir}`);
  }
}
pass("Precache is clean");

// --- 7. Duplicate function definitions in same file ---
console.log("\n7. Checking for duplicate functions in same file...");
let funcDupCount = 0;
for (const f of jsFiles) {
  const src = readFileSync(join(ROOT, f), "utf8");
  const funcDefs = new Map();
  for (const m of src.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g)) {
    const name = m[1];
    funcDefs.set(name, (funcDefs.get(name) || 0) + 1);
  }
  for (const [name, count] of funcDefs) {
    if (count > 1) {
      fail(`Duplicate function: ${name}() defined ${count} times in ${f}`);
      funcDupCount++;
    }
  }
}
if (funcDupCount === 0) pass("No duplicate functions found");

// --- Summary ---
console.log(`\n${"=".repeat(50)}`);
console.log(`SUMMARY: ${problems.length} errors, ${warnings.length} warnings`);
if (problems.length === 0 && warnings.length === 0) {
  console.log("✓ Codebase is clean. No issues found.");
} else {
  if (problems.length > 0) console.log(`\nErrors (must fix before deploy):`);
  for (const p of problems) console.log(`  - ${p}`);
  if (warnings.length > 0) console.log(`\nWarnings (review and consider fixing):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
process.exit(problems.length > 0 ? 1 : 0);
