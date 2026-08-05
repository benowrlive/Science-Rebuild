/* Per-stage-type editor forms. Each renders a form for one stage and calls
   onChange with the updated stage object on every edit.

   The forms show ONLY the fields relevant to that stage type, so an author
   never sees an empty "accepts" field on a hook stage and wonders whether to
   fill it in. The build's lint rules are mirrored in validate.js — the form
   is a guide, the validator is the gate. */

import { el } from "../el.js";
import { AVAILABLE_SIMS, SIM_INFO, defaultParams } from "./validate.js";

/* A labelled field wrapper: label on top, control below, optional hint. */
function field(label, control, hint) {
  return el("div", { class: "auth-field" },
    el("label", { class: "auth-label", text: label }),
    control,
    hint ? el("p", { class: "auth-hint", text: hint }) : null);
}

/* A concept dropdown — shows the module's declared concepts so the author
   picks from valid options instead of typing (and typo'ing). Falls back to
   a text input if the module has no concepts declared. */
function conceptSelect(stage, key, onChange, moduleConcepts) {
  if (!moduleConcepts?.length) {
    return text(stage, key, onChange, { placeholder: "e.g. velocity-is-rate" });
  }
  const current = stage[key] ?? "";
  return el("select", {
    class: "auth-input",
    onchange: (e) => { stage[key] = e.target.value || ""; onChange(); },
  }, el("option", { value: "", text: "(pick a concept)", selected: !current }),
    ...moduleConcepts.map((c) => el("option", { value: c, selected: c === current, text: c })));
}
function text(stage, key, onChange, opts = {}) {
  const v = stage[key] ?? "";
  const input = el("input", {
    type: "text", class: "auth-input", value: v,
    "data-fk": `stage-${key}`,
    oninput: (e) => { stage[key] = e.target.value; onChange(); },
  });
  if (opts.placeholder) input.placeholder = opts.placeholder;
  return input;
}

/* A number input. */
function num(stage, key, onChange, opts = {}) {
  const v = stage[key] ?? 0;
  return el("input", {
    type: "number", class: "auth-input", value: v,
    min: opts.min ?? "", max: opts.max ?? "", step: opts.step ?? "1",
    "data-fk": `stage-${key}`,
    oninput: (e) => { stage[key] = Number(e.target.value); onChange(); },
  });
}

/* A variant array editor: shows 4 textareas (L1-L4), but L3/L4 are optional.
   Missing variants fall back downward at render time, so the form says so. */
function variants(stage, key, onChange, opts = {}) {
  const arr = Array.isArray(stage[key]) ? stage[key] : (stage[key] ? [stage[key]] : []);
  // Ensure at least L1 and L2 exist as inputs
  while (arr.length < 2) arr.push("");
  const rows = [1, 2, 3, 4].map((lv) => {
    const i = lv - 1;
    const val = arr[i] ?? "";
    const required = lv === 1;
    const optional = lv >= 3 && !val;
    return el("div", { class: "auth-variant-row" },
      el("span", { class: "auth-variant-lvl", text: `L${lv}${required ? "*" : ""}` }),
      el("textarea", {
        class: "auth-textarea",
        rows: 2,
        "data-fk": `stage-${key}-L${lv}`,
        oninput: (e) => {
          arr[i] = e.target.value;
          // Trim trailing empty strings but keep L1 and L2
          while (arr.length > 2 && !arr[arr.length - 1]) arr.pop();
          stage[key] = arr.length ? arr : "";
          onChange();
        },
      }, document.createTextNode(val)),
      optional ? el("span", { class: "auth-variant-opt", text: "optional — falls back to L2" }) : null,
    );
  });
  return el("div", { class: "auth-variants" }, ...rows);
}

/* A checkbox for booleans. */
function checkbox(stage, key, label, onChange) {
  const id = `cb-${key}-${Math.random().toString(36).slice(2, 6)}`;
  return el("label", { class: "auth-check" },
    el("input", {
      type: "checkbox", id, checked: !!stage[key],
      onchange: (e) => { stage[key] = e.target.checked; onChange(); },
    }),
    el("span", { text: label }));
}

/* Levels multi-select (which content levels see this stage). */
function levels(stage, onChange) {
  const current = new Set(stage.levels ?? [1, 2, 3, 4]);
  const toggles = [1, 2, 3, 4].map((lv) => {
    const on = current.has(lv);
    return el("label", { class: "auth-level-toggle" },
      el("input", {
        type: "checkbox", checked: on,
        onchange: (e) => {
          if (e.target.checked) current.add(lv); else current.delete(lv);
          stage.levels = [...current].sort();
          if (stage.levels.length === 4) delete stage.levels;  // all = no filter
          onChange();
        },
      }),
      el("span", { text: `L${lv}` }));
  });
  return el("div", { class: "auth-levels" }, ...toggles);
}

/* Options list editor (for predict/check options). */
function options(stage, key, onChange) {
  const arr = stage[key] ?? [];
  const rows = arr.map((opt, i) => el("div", { class: "auth-option-row" },
    el("span", { class: "auth-option-n", text: String(i + 1) }),
    el("input", {
      type: "text", class: "auth-input", value: opt,
      oninput: (e) => { arr[i] = e.target.value; onChange(); },
    }),
    el("button", {
      class: "auth-remove pressable", type: "button",
      onclick: () => { arr.splice(i, 1); onChange(); },
    }, "\u00d7")));
  return el("div", {},
    ...rows,
    el("button", {
      class: "auth-add pressable", type: "button",
      onclick: () => { arr.push(""); onChange(); },
    }, "+ Add option"));
}

/* ---- Per-type editors ---- */

const EDITORS = {
  hook: (stage, onChange) => [
    field("The question (not a definition)", variants(stage, "t", onChange),
      "Max 26 words for L1. A hook is something worth wondering about, not 'A cell is the basic unit of life.'"),
    field("The small line under it", variants(stage, "sub", onChange), "Optional. One short follow-up."),
  ],

  predict: (stage, onChange, mc) => [
    field("Concept this prediction tests", conceptSelect(stage, "concept", onChange, mc),
      "Pick from the module's declared concepts. Typos here fail the build."),
    field("The question", variants(stage, "question", onChange)),
    field("Options (the child picks one)", options(stage, "options", onChange),
      "outcome must be one of these, exactly."),
    field("What actually happens", text(stage, "outcome", onChange, { placeholder: "Must match one of the options exactly" })),
    field("Note (shown after they pick)", variants(stage, "note", onChange), "Optional. Why guessing matters."),
  ],

  slider: (stage, onChange) => [
    field("Levels", levels(stage, onChange), "Which content levels see this stage. L1-2 = guided, L3-4 = open."),
    field("Guided?", checkbox(stage, "guided", "Guided (caption names what they see)", onChange),
      "Guided: L1-2 track. Open: L3-4 track — they predict before the label arrives."),
    field("Label", text(stage, "label", onChange, { placeholder: "e.g. How hard do you push?" })),
    el("div", { class: "auth-row" },
      field("Min", num(stage, "min", onChange)),
      field("Max", num(stage, "max", onChange)),
      field("Start value", num(stage, "value", onChange))),
    field("Captions (one per step)", options(stage, "captions", onChange),
      "One caption per step from min to max. captions[n] shows at value n."),
    field("The instruction", variants(stage, "t", onChange)),
    field("Shown when they reach max", variants(stage, "after", onChange)),
  ],

  name: (stage, onChange) => [
    field("The concept, finally named", variants(stage, "t", onChange),
      "The only stage that hands over a term. On the guided track it follows the exploration; on the open track the child has usually got there first."),
    field("The follow-up", variants(stage, "sub", onChange), "Optional."),
  ],

  apply: (stage, onChange) => [
    field("Kicker", text(stage, "kicker", onChange, { placeholder: "Why this matters" })),
    field("The application", variants(stage, "t", onChange),
      "Medicine, sport, agriculture, climate. One short beat, not a text panel."),
  ],

  check: (stage, onChange, mc) => [
    field("Concept this checks", conceptSelect(stage, "concept", onChange, mc),
      "Required. Pick from the module's declared concepts. Seeded into the retrieval schedule."),
    field("The question", variants(stage, "q", onChange)),
    field("Options", options(stage, "options", onChange)),
    field("Correct answer (0-indexed)", num(stage, "answer", onChange, { min: 0, max: (stage.options?.length ?? 1) - 1 }),
      "0 = first option, 1 = second, etc."),
    field("Why (shown for right AND wrong answers)", variants(stage, "why", onChange),
      "Show the mechanism, not the answer. 'Because it is too big' is the answer. 'The holes were big enough for food and too small for poison' is the mechanism."),
  ],

  sim: (stage, onChange) => {
    const info = SIM_INFO[stage.sim];
    const sel = el("select", {
      class: "auth-input",
      onchange: (e) => {
        stage.sim = e.target.value;
        stage.params = defaultParams(stage.sim);
        onChange();
      },
    }, ...AVAILABLE_SIMS.map((s) => {
      const d = SIM_INFO[s]?.desc;
      return el("option", { value: s, selected: s === stage.sim, text: s + (d ? " - " + d.slice(0, 55) : "") });
    }));
    const ph = info ? Object.entries(info.params).map(([k, v]) => k + ": " + v).join("\n") : "";
    return [
      field("Levels", levels(stage, onChange)),
      field("Guided?", checkbox(stage, "guided", "Guided (caption names what they see)", onChange)),
      field("Simulation", sel, "Which sim to load. The description tells you what it does."),
      info ? el("p", { class: "auth-hint", text: info.desc }) : null,
      field("The instruction", variants(stage, "t", onChange)),
      field("Params (JSON)", el("textarea", {
        class: "auth-textarea auth-json",
        rows: 5,
        "data-fk": "stage-params",
        oninput: (e) => { try { stage.params = JSON.parse(e.target.value) || {}; onChange(); } catch { /* keep last valid */ } },
      }, document.createTextNode(JSON.stringify(stage.params ?? defaultParams(stage.sim) ?? {}, null, 2))),
        ph ? "Available params for this sim:\n" + ph : "No documented params. Ask a coder."),
      field("Goal (shown when objective met)", variants(stage, "goal", onChange)),
    ];
  },

  build: (stage, onChange) => [
    field("The instruction", variants(stage, "t", onChange)),
    field("Parts", el("div", {},
      ...(stage.parts ?? []).map((p, i) => el("div", { class: "auth-option-row" },
        el("input", { type: "text", class: "auth-input", value: p.id, placeholder: "id",
          oninput: (e) => { p.id = e.target.value; onChange(); } }),
        el("input", { type: "text", class: "auth-input", value: p.label, placeholder: "label",
          oninput: (e) => { p.label = e.target.value; onChange(); } }),
        el("button", { class: "auth-remove pressable", type: "button",
          onclick: () => { stage.parts.splice(i, 1); onChange(); } }, "\u00d7"))),
      el("button", { class: "auth-add pressable", type: "button",
        onclick: () => { (stage.parts ??= []).push({ id: "", label: "" }); onChange(); } }, "+ Add part")),
      "The things the child places. Each has an id (used in slots/trials) and a label (shown)."),
    field("Slots", el("div", {},
      ...(stage.slots ?? []).map((s, i) => el("div", { class: "auth-option-row" },
        el("input", { type: "text", class: "auth-input", value: s.correct ?? s.accepts ?? "", placeholder: "correct part id",
          oninput: (e) => { s.correct = e.target.value; onChange(); } }),
        el("input", { type: "text", class: "auth-input", value: s.accepts ?? "", placeholder: "accepts (optional)",
          oninput: (e) => { if (e.target.value) s.accepts = e.target.value; else delete s.accepts; onChange(); } }),
        el("button", { class: "auth-remove pressable", type: "button",
          onclick: () => { stage.slots.splice(i, 1); onChange(); } }, "\u00d7"))),
      el("button", { class: "auth-add pressable", type: "button",
        onclick: () => { (stage.slots ??= []).push({ correct: "", label: [""] }); onChange(); } }, "+ Add slot")),
      "correct = the right part id. accepts = (optional) constrains what may be dropped. If all slots use accepts, the trials can't fail."),
  ],

  weigh: (stage, onChange) => [
    field("Levels", levels(stage, onChange), "Weigh stages are usually L3-4 only."),
    field("The instruction", variants(stage, "t", onChange)),
    field("Evidence (what nobody disputes)", variants(stage, "evidence", onChange), "Optional."),
    field("Views", el("div", {},
      ...(stage.views ?? []).map((v, i) => el("fieldset", { class: "auth-view" },
        el("legend", { text: `View ${i + 1}` }),
        field("Who holds this view", text(v, "who", onChange, { placeholder: "e.g. Most geologists" }),
          "Mandatory. The page never speaks in its own voice on a weigh stage."),
        field("The claim", variants(v, "claim", onChange)),
        field("Because (the reasoning)", variants(v, "because", onChange), "Mandatory. A view without reasoning is a label."),
        el("button", { class: "auth-remove pressable", type: "button",
          onclick: () => { stage.views.splice(i, 1); onChange(); } }, "Remove view"))),
      el("button", { class: "auth-add pressable", type: "button",
        onclick: () => { (stage.views ??= []).push({ who: "", claim: [""], because: [""] }); onChange(); } }, "+ Add view")),
      "At least two views. Both must be opened before Next unlocks."),
    field("The open question (no answer box)", variants(stage, "ask", onChange), "Optional. Closes the stage with something to think about."),
  ],
};

/** Render the editor for one stage. Returns a DOM node.
    moduleConcepts is the array of concept ids declared in curriculum.json
    for this lesson's module — passed down so concept fields render as
    dropdowns instead of text inputs. */
export function stageEditor(stage, onChange, onRemove, onMove, index, total, moduleConcepts) {
  const editor = EDITORS[stage.type] ?? (() => [el("p", { text: `No editor for type "${stage.type}"` })]);
  return el("section", { class: "auth-stage", "data-type": stage.type },
    el("header", { class: "auth-stage-head" },
      el("span", { class: "auth-stage-n", text: `${index + 1}` }),
      el("span", { class: "auth-stage-type", text: stage.type }),
      el("span", { class: "auth-stage-spacer" }),
      index > 0 ? el("button", { class: "auth-move pressable", type: "button", onclick: () => onMove(index, -1) }, "\u2191") : null,
      index < total - 1 ? el("button", { class: "auth-move pressable", type: "button", onclick: () => onMove(index, 1) }, "\u2193") : null,
      el("button", { class: "auth-remove pressable", type: "button", onclick: onRemove }, "Remove")),
    el("div", { class: "auth-stage-body" }, ...editor(stage, onChange, moduleConcepts)));
}

/** The "add stage" toolbar. */
export function addStageToolbar(onAdd) {
  const types = ["hook", "predict", "slider", "sim", "build", "name", "apply", "check", "weigh"];
  return el("div", { class: "auth-add-stage" },
    el("span", { class: "auth-add-label", text: "Add stage:" }),
    ...types.map((t) => el("button", {
      class: "auth-add-btn pressable", type: "button",
      onclick: () => onAdd(t),
    }, t)));
}
