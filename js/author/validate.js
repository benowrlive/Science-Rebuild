/* The authoring tool's validation engine. Mirrors the lint rules in
   tools/build.mjs exactly — if a lesson passes here, it passes the build.

   The build is the source of truth, so these rules are kept in sync by hand.
   A rule added to build.mjs must be added here too; the alternative (sharing
   the rules) would mean importing Node-only code into the browser, which the
   zero-build-development constraint forbids. */

import { worlds, getModule } from "../curriculum.js";

const STAGE_TYPES = new Set(["hook", "predict", "slider", "name", "apply", "check", "sim", "build", "weigh"]);

// Text fields that must be arrays of level variants, with L1 mandatory.
const VARIANT_FIELDS = new Set(["t", "sub", "q", "why", "question", "note", "after", "evidence", "ask", "goal", "win", "lose"]);

const REQUIRED_PER_LEVEL = [
  ["hook", (t) => t === "hook"],
  ["an exploration", (t) => ["slider", "predict", "sim", "build"].includes(t)],
  ["a naming stage", (t) => t === "name"],
  ["a check", (t) => t === "check"],
];

/** Validate a lesson object against the build's lint rules.
    Returns { errors: [...], warnings: [...] } — errors block export,
    warnings do not. */
export function validate(lesson) {
  const errors = [];
  const warnings = [];
  const where = (msg) => errors.push(msg);

  if (!lesson.stages?.length) { where("lesson has no stages"); return { errors, warnings }; }

  // Top-level fields
  if (!lesson.id) where("missing id (format: module/nn, e.g. describing-motion/01)");
  if (!lesson.module) where("missing module id");
  if (!lesson.title) where("missing title");
  if (typeof lesson.index !== "number") where("missing or non-numeric index");

  // Module must exist and declare concepts
  const mod = getModule(lesson.module);
  if (!mod) where(`module "${lesson.module}" is not in curriculum.json`);
  else {
    if (!mod.concepts?.length) warnings.push(`module "${lesson.module}" declares no concepts in curriculum.json`);
    // Specimen must be defined
    if (lesson.specimen && !(mod.specimens ?? []).some((s) => s.id === lesson.specimen)) {
      where(`specimen "${lesson.specimen}" is not defined under module ${lesson.module}`);
    }
  }

  const stageTypes = new Set();
  for (const [i, st] of lesson.stages.entries()) {
    const stageLabel = `stage ${i} (${st.type ?? "no type"})`;

    if (!STAGE_TYPES.has(st.type)) { where(`${stageLabel}: unknown type "${st.type}"`); continue; }
    stageTypes.add(st.type);

    // Field names must be plain ASCII identifiers (catches Cyrillic, typos)
    for (const key of Object.keys(st)) {
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) where(`${stageLabel}: field name "${key}" is not a plain identifier`);
    }

    // Levels must be in range
    if (st.levels && st.levels.some((l) => l < 1 || l > 4)) where(`${stageLabel}: levels out of range (must be 1-4)`);

    // Variant fields must be arrays with L1
    for (const key of VARIANT_FIELDS) {
      const v = st[key];
      if (v === undefined) continue;
      if (!Array.isArray(v)) { where(`${stageLabel}: "${key}" must be an array of level variants`); continue; }
      if (!v[0]) where(`${stageLabel}: "${key}" has no L1 variant`);
      // Hook L1 max 26 words
      else if (st.type === "hook" && key === "t" && v[0].split(/\s+/).length > 26) {
        where(`${stageLabel}: L1 hook is ${v[0].split(/\s+/).length} words (max 26)`);
      }
    }

    // Sim stage
    if (st.type === "sim") {
      if (!st.sim) where(`${stageLabel}: sim stage needs a "sim" name`);
      else if (!SIM_REGISTRY.has(st.sim)) where(`${stageLabel}: no simulation named "${st.sim}" — registered sims: ${[...SIM_REGISTRY].join(", ")}`);
      if (!st.goal) where(`${stageLabel}: a sim stage needs a goal message`);
    }

    // Build stage
    if (st.type === "build") {
      if (!st.parts?.length) where(`${stageLabel}: a build stage needs parts`);
      if (!st.slots?.length) where(`${stageLabel}: a build stage needs slots`);
      const ids = new Set((st.parts ?? []).map((x) => x.id));
      for (const slot of st.slots ?? []) {
        for (const a of String(slot.accepts ?? "").split(/\s+/).filter(Boolean)) {
          if (!ids.has(a)) where(`${stageLabel}: slot accepts "${a}", which is not one of the parts`);
        }
        const correct = slot.correct ?? slot.accepts;
        if (!correct) where(`${stageLabel}: a slot needs "correct" (or "accepts")`);
        else if (!ids.has(correct)) where(`${stageLabel}: slot's correct part "${correct}" is not one of the parts`);
      }
      if (st.trials && (st.slots ?? []).every((sl) => sl.accepts)) {
        where(`${stageLabel}: every slot constrains placement, so the trials cannot fail (make at least one slot unconstrained)`);
      }
      for (const t of st.trials ?? []) {
        for (const n of t.needs ?? []) if (!ids.has(n)) where(`${stageLabel}: trial needs "${n}", which is not a part`);
      }
    }

    // Weigh stage
    if (st.type === "weigh") {
      if (!Array.isArray(st.views) || st.views.length < 2) {
        where(`${stageLabel}: a weigh stage needs at least two views`);
      }
      for (const [j, v] of (st.views ?? []).entries()) {
        if (!v.who?.trim()) where(`${stageLabel}, view ${j}: no "who" — an interpretation must say whose it is`);
        if (!Array.isArray(v.claim) || !v.claim[0]) where(`${stageLabel}, view ${j}: "claim" needs an L1 variant`);
        if (!Array.isArray(v.because) || !v.because[0]) where(`${stageLabel}, view ${j}: "because" needs an L1 variant`);
      }
    }

    // Check stage
    if (st.type === "check") {
      if (!st.concept) where(`${stageLabel}: a check must name the concept it tests`);
      if (st.answer == null || !st.options?.length) where(`${stageLabel}: check needs options and an answer index`);
      else if (st.answer >= st.options.length) where(`${stageLabel}: answer index out of range`);
    }

    // Concept must be declared in module
    if (st.concept && mod?.concepts && !mod.concepts.includes(st.concept)) {
      where(`${stageLabel}: concept "${st.concept}" is not declared in ${lesson.module}'s concepts list`);
      where(`  (add it to curriculum.json under ${lesson.module}.concepts, or fix the typo)`);
    }
  }

  // The pedagogy fork: every level must have a complete path
  for (const lv of [1, 2, 3, 4]) {
    const mine = lesson.stages.filter((st) => !st.levels || st.levels.includes(lv));
    for (const [label, test] of REQUIRED_PER_LEVEL) {
      if (!mine.some((st) => test(st.type))) {
        where(`level ${lv} has no ${label} — the stage filter stranded it`);
      }
    }
  }

  return { errors, warnings };
}

/** The sims available on disk. Hardcoded here because the browser cannot read
    the filesystem. Update when a new sim is added to js/sims/. */
const SIM_REGISTRY = new Set([
  "membrane", "energy", "selection", "replication", "folding",
  "spike", "stomata", "web", "outbreak", "incline",
]);

export const AVAILABLE_SIMS = [...SIM_REGISTRY];

/** Default stage templates — what gets inserted when you add a stage.
    Pre-filled with the minimum the build requires, so a fresh stage passes
    validation after you fill in the placeholders. */
export function newStage(type) {
  const base = { type };
  if (type === "hook") return { type, t: ["", ""] };
  if (type === "predict") return { type, concept: "", question: ["", ""], options: ["", "", ""], outcome: "", note: ["", ""] };
  if (type === "slider") return { type, levels: [1, 2], guided: true, label: "", min: 0, max: 4, value: 0, captions: [], t: ["", ""], after: ["", ""] };
  if (type === "name") return { type, t: ["", ""], sub: ["", ""] };
  if (type === "apply") return { type, kicker: "Why this matters", t: ["", ""] };
  if (type === "check") return { type, concept: "", q: ["", ""], options: ["", "", ""], answer: 0, why: ["", ""] };
  if (type === "sim") return { type, sim: "incline", levels: [1, 2], guided: true, t: ["", ""], params: {}, goal: ["", ""] };
  if (type === "build") return { type, t: ["", ""], parts: [{ id: "a", label: "A" }], slots: [{ correct: "a", label: ["Slot"] }] };
  if (type === "weigh") return { type, levels: [3, 4], t: ["", ""], views: [{ who: "", claim: [""], because: [""] }, { who: "", claim: [""], because: [""] }] };
  return base;
}

/** Default empty lesson for a module + index. */
export function newLesson(moduleId, index) {
  const mod = getModule(moduleId);
  return {
    id: `${moduleId}/${String(index).padStart(2, "0")}`,
    module: moduleId,
    index,
    title: mod?.lessonTitles?.[index] ?? `Lesson ${index + 1}`,
    specimen: mod?.specimens?.[0]?.id ?? null,
    stages: [
      newStage("hook"),
      newStage("predict"),
      newStage("name"),
      newStage("check"),
    ],
  };
}
