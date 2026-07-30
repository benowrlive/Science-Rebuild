/* The authoring tool. Lives at #/author, lazy-loaded so a child on the Atlas
   never downloads it.

   The workflow:
   1. Pick a module (from curriculum.json) and a lesson index
   2. Edit stages in a form — each stage type has its own editor
   3. Live validation mirrors the build's lint rules — red errors block export
   4. Export: copy JSON to clipboard, download as a file, or preview in-app

   The tool reads curriculum.json to know which modules and concepts exist,
   and writes a single JSON file the author drops into content/<module>/.
   It does NOT write to the filesystem — that is a deliberate line. The build
   is the gate; the tool is the helper. */

import { el, mount } from "../el.js";
import { icon } from "../icons.js";
import { worlds, getModule } from "../curriculum.js";
import { validate, newStage, newLesson } from "./validate.js";
import { stageEditor, addStageToolbar } from "./stages.js";

export async function authorView() {
  // State — held in closure, not in progress state, because authoring is not
  // a learning activity and should not persist between sessions.
  let lesson = null;
  let currentModule = null;
  let currentIndex = 0;

  const host = el("div", { class: "auth-host" });

  function rerender() {
    mount(host, renderBody());
  }

  function renderBody() {
    if (!currentModule) return modulePicker();
    if (!lesson) return lessonPicker();
    return lessonEditor();
  }

  /* ---- Step 1: pick a module ---- */
  function modulePicker() {
    const worldList = worlds.map((w) => {
      const items = w.modules.map((m) =>
        el("li", {},
          el("button", {
            class: "auth-module pressable",
            onclick: () => { currentModule = m; currentIndex = 0; lesson = null; rerender(); },
          },
            el("span", { class: "auth-module-title", text: m.title }),
            el("span", { class: "auth-module-meta", text: m.lessons + " lessons \u00b7 " + (m.concepts?.length ?? 0) + " concepts" })))
      );
      return el("section", { class: "auth-world" },
        el("h2", { text: w.title }),
        el("ul", { class: "auth-modules" }, ...items));
    });
    return [
      el("h1", { text: "Authoring tool" }),
      el("p", { class: "lede", text: "Pick a module to author a lesson in. The tool validates against the same lint rules as the build." }),
      ...worldList,
    ];
  }

  /* ---- Step 2: pick a lesson index ---- */
  function lessonPicker() {
    const m = currentModule;
    const indices = Array.from({ length: m.lessons }, (_, i) => i);
    const lessonList = indices.map((i) => {
      const title = m.lessonTitles?.[i] ?? `Lesson ${i + 1}`;
      return el("li", {},
        el("button", {
          class: "auth-lesson pressable",
          onclick: () => {
            lesson = newLesson(m.id, i);
            lesson.title = title;
            rerender();
          },
        },
          el("span", { class: "auth-lesson-n", text: String(i + 1) }),
          el("span", { class: "auth-lesson-title", text: title })));
    });
    return [
      el("a", { class: "back pressable", href: "#", onclick: (e) => { e.preventDefault(); currentModule = null; rerender(); } },
        icon("back"), el("span", { text: "All modules" })),
      el("h1", { text: m.title }),
      el("p", { class: "lede", text: "Pick which lesson to author. The title comes from curriculum.json." }),
      el("ul", { class: "auth-lessons" }, ...lessonList),
      el("p", { class: "shelf-note", text: `Concepts declared for this module: ${(m.concepts ?? []).join(", ") || "none"}` }),
      m.specimens?.length ? el("p", { class: "shelf-note", text: `Specimens: ${m.specimens.map((s) => s.id).join(", ")}` }) : null,
    ];
  }

  /* ---- Step 3: the editor ---- */
  function lessonEditor() {
    const { errors, warnings } = validate(lesson);

    // Validation panel
    const valPanel = errors.length
      ? el("section", { class: "auth-validation auth-validation--err" },
          el("h3", { text: `\u2717 ${errors.length} error${errors.length === 1 ? "" : "s"}` }),
          ...errors.map((e) => el("p", { class: "auth-error", text: e })))
      : el("section", { class: "auth-validation" },
          el("h3", { text: "\u2713 Passes the build's lint rules" }),
          warnings.length ? el("p", { class: "auth-warn", text: `${warnings.length} warning(s)` }) : null);

    // Specimen select
    const specSel = el("select", {
      class: "auth-input",
      onchange: (e) => { lesson.specimen = e.target.value || null; rerender(); },
    }, el("option", { value: "", text: "(none)" }),
      ...(currentModule.specimens ?? []).map((s) =>
        el("option", { value: s.id, selected: s.id === lesson.specimen, text: s.id })));

    // Stages
    const stageEls = lesson.stages.map((st, i) => stageEditor(
      st,
      () => { /* live edit — no rerender to preserve focus */ },
      () => { lesson.stages.splice(i, 1); rerender(); },
      (idx, dir) => {
        const j = idx + dir;
        const tmp = lesson.stages[idx];
        lesson.stages[idx] = lesson.stages[j];
        lesson.stages[j] = tmp;
        rerender();
      },
      i, lesson.stages.length,
    ));

    return [
      el("a", { class: "back pressable", href: "#", onclick: (e) => { e.preventDefault(); lesson = null; rerender(); } },
        icon("back"), el("span", { text: currentModule.title })),

      el("div", { class: "auth-head" },
        el("h1", { text: lesson.title }),
        el("p", { class: "auth-meta", text: `${lesson.id} \u00b7 ${lesson.stages.length} stages \u00b7 specimen: ${lesson.specimen ?? "none"}` })),

      valPanel,

      el("section", { class: "auth-section" },
        el("h2", { text: "Lesson metadata" }),
        el("div", { class: "auth-row" },
          el("label", { class: "auth-field" },
            el("span", { class: "auth-label", text: "Title" }),
            el("input", { type: "text", class: "auth-input", value: lesson.title,
              oninput: (e) => { lesson.title = e.target.value; } })),
          el("label", { class: "auth-field" },
            el("span", { class: "auth-label", text: "Specimen" }),
            specSel))),

      el("section", { class: "auth-section" },
        el("h2", { text: "Stages" }),
        ...stageEls,
        addStageToolbar((type) => { lesson.stages.push(newStage(type)); rerender(); })),

      el("section", { class: "auth-section" },
        el("h2", { text: "Export" }),
        el("p", { class: "shelf-note", text: "Copy this JSON into content/<module>/<file>.json, then run npm run build. The build regenerates authored.json and reviews.json." }),
        el("div", { class: "auth-export-actions" },
          el("button", {
            class: "pressable", type: "button", disabled: errors.length > 0,
            onclick: () => {
              const json = JSON.stringify(lesson, null, 2) + "\n";
              navigator.clipboard?.writeText(json).then(() => alert("Copied to clipboard"));
            },
          }, "Copy JSON"),
          el("button", {
            class: "pressable", type: "button", disabled: errors.length > 0,
            onclick: () => {
              const json = JSON.stringify(lesson, null, 2) + "\n";
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = el("a", { href: url, download: `${lesson.id.replace("/", "-")}.json` });
              document.body.append(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
            },
          }, "Download file")),
        el("pre", { class: "auth-json-out" }, document.createTextNode(JSON.stringify(lesson, null, 2)))),
    ];
  }

  rerender();
  return [
    el("a", { class: "back pressable", href: "#/me" }, icon("back"), el("span", { text: "Me" })),
    host,
  ];
}
