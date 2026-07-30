# Authoring a lesson — for non-coders

This is a guide for people who want to write lessons but do not write code.
You do not need to know JavaScript, JSON, or how the build works. The
authoring tool handles the format; you handle the content.

If you *do* write code, read `docs/AUTHORING.md` instead — it is the full
technical spec. This document is the human version.

---

## What you are doing

Every lesson is a short interactive experience — about 5 minutes of a
child's time. It has a hook (something worth wondering about), a chance to
predict before looking, a simulation they can operate, the name of the
concept, why it matters, and a check to see if it stuck.

You are writing the words. The tool puts them in the right place.

## Before you start

You need:

- A browser. Any modern browser works.
- The site running locally (ask whoever set you up — usually
  `python3 -m http.server 8000` from the project folder, then open
  `http://localhost:8000`).
- About 30 minutes for your first lesson. It gets faster.

You do NOT need:

- A code editor
- Git or GitHub access
- Node.js or npm
- Any programming knowledge

## Quick reference: the 9 stage types

Every lesson is a sequence of stages. Here is what each one does, in one line:

| Stage | What it does | When to use it |
|---|---|---|
| `hook` | Opens with a question, never a definition | Every lesson starts here |
| `predict` | Child commits to a guess before seeing the answer | Before any sim or revelation |
| `slider` | Child moves through a range with captions | When a parameter has named steps |
| `sim` | Child operates a real simulation | The heart of the lesson |
| `build` | Child places parts into slots (drag or tap) | The boss stage |
| `name` | The concept is finally named | After the exploration |
| `apply` | Why this matters in the real world | One short beat |
| `check` | Multiple-choice with mechanism feedback | At least one per lesson |
| `weigh` | Two attributed readings of contested evidence | Only for contested topics (L3-4) |

A typical lesson: `hook` → `predict` → `sim` → `name` → `apply` → `check`.

## Quick reference: the simulations

The sim dropdown shows a description for each one. Here is the full list:

| Sim | What it does | Key params |
|---|---|---|
| `incline` | Ball on a surface; push + friction sliders | `push` (1-6), `friction` (0-5), `goalDist` (0.5-0.9) |
| `forces` | Trolley with push/mass/friction; F=ma with visible force arrows | `push` (0-6), `mass` (1-4), `friction` (0-4), `goalSpeed` (0.2-0.5) |
| `membrane` | Cell membrane; molecules random-walk through pores | `kinds` (2-6), `pore` (1-9), `temp` (1-3), `target` (0.5-0.8) |
| `selection` | Natural selection; beetles with different colours | (no documented params) |
| `replication` | DNA replication; child copies a base sequence | (no documented params) |
| `folding` | Protein folding; oil/water bead chain | (no documented params) |
| `spike` | Viral spike protein binding to a receptor | (no documented params) |
| `stomata` | Stomata opening/closing on a leaf | (no documented params) |
| `web` | Food web; child connects organisms | (no documented params) |
| `outbreak` | Epidemic spreading through a population | (no documented params) |
| `energy` | Energy flow through a system | (no documented params) |

When you select a sim in the tool, the params textarea pre-fills with defaults.
Change the numbers to tune the difficulty. The hint below the textarea lists
what each param does.

## Opening the authoring tool

1. Open the site in your browser.
2. Click **Me** in the top right.
3. Scroll to the bottom. Click **Authoring tool**.

You are now at `#/author`. The URL will say so. Bookmark it if you like.

## The three steps

The tool has three screens: pick a module, pick a lesson, edit the stages.

### Step 1: Pick a module

You will see every module in every subject, grouped by world. Each module
says how many lessons it has and how many concepts it covers.

Click the module you want to author in. If you are not sure, pick one whose
topic you know well — authoring is much easier when you already understand
the science.

### Step 2: Pick a lesson

Each module has a fixed number of lesson slots. The titles are already
decided (they live in `curriculum.json` — that is a separate, more technical
file). Click the lesson number you want to write.

The tool shows you two important things on this screen:

- **Concepts declared for this module**: these are the only concepts your
  lesson is allowed to test. If you want to test a concept that is not
  listed, you need to ask a coder to add it to `curriculum.json` first.
- **Specimens**: the "inventory items" this module can award. Your lesson
  can award one of these (or none).

### Step 3: Edit the stages

This is where you write. A lesson is a sequence of **stages**, shown one at
a time to the child. The tool starts you with four stages: a hook, a
predict, a name, and a check. You can add more, remove some, or reorder
them.

At the top of the editor, there is a **validation panel**. It is red when
something is wrong and green when everything passes. You cannot export
until it is green. The panel tells you exactly what to fix.

## How to write each stage type

### `hook` — the question, never a definition

The hook is the first thing the child sees. It must make them want to know
the answer. **It must not be a definition.**

| Bad hook (a definition) | Good hook (a question) |
|---|---|
| A cell is the basic unit of life. | What if a whole city had to fit inside something smaller than a grain of sand? |
| Speed is distance divided by time. | Two balls roll. One gets there first. What is different about what it did? |
| Inertia is resistance to changes in motion. | Push a ball. It rolls. Stop pushing. Why does it keep going? |

Write two variants of the hook text: one for level 1 (ages 5–7) and one
for levels 2–4. The level 1 variant must be **26 words or fewer** — the
tool will tell you if it is too long.

**The level 1 variant is not a simplified level 2.** A five-year-old is not
a ten-year-old with shorter words. Level 1 uses concrete objects, simple
verbs, and one idea per sentence. Level 2 can hold two.

### `predict` — commit before you look

The child picks one of several options before they see what happens. They
get XP for predicting, **whether they are right or wrong** — so do not make
the answer obvious.

You write:

- **concept**: which concept this prediction tests. The tool shows a dropdown
  of the module's declared concepts — pick from the list. Typing is not
  needed and typos are impossible.
- **question**: the prompt, in 2–4 level variants
- **options**: 2–4 possible answers
- **outcome**: which option is actually correct (must match one of the
  options exactly)
- **note** (optional): a short line shown after they pick, explaining why
  guessing matters

The best predict stages have an answer that surprises most people. If
everyone gets it right, the prediction teaches nothing.

### `slider` — a parameter with captions

A slider lets the child move through a range of values and see something
change. Each position on the slider has a caption.

You write:

- **label**: what the slider controls (e.g. "How hard do you push?")
- **min, max, value**: the range and starting position
- **captions**: one caption per step, from min to max. The tool requires
  one per step — gaps are not allowed.
- **after**: shown when they reach the max

For levels 1–2, set `guided: true` — the caption names what they are
seeing. For levels 3–4, set `guided: false` — they predict before the label
arrives.

### `sim` — a real simulation

This is the heart of the lesson. The child operates a real simulation (not
a video, not an animation — a thing with physics).

You write:

- **sim**: which simulation to load. The dropdown shows a description for
  each sim so you know what it does before you pick it.
- **t**: the instruction, in level variants
- **params**: simulation parameters. When you select a sim, the tool
  pre-fills the params with defaults and shows a hint listing what each
  param does. Change the numbers to tune difficulty — you do not need to
  write JSON from scratch.
- **goal**: shown when the child reaches the objective

The sim stage also offers "I have had enough of this one" — the goal is
worth trying for, but it is not a toll gate. A child who cannot reach it is
not trapped.

### `name` — the concept, finally named

The only stage that hands over a term. On the guided track (levels 1–2) it
follows the exploration immediately. On the open track (levels 3–4) the
child has usually got there first.

Write the name in 2–4 level variants. Level 1 uses the word simply. Level 4
states the full definition with proper terms.

### `apply` — why anyone should care

One short beat. Medicine, sport, agriculture, climate. Not a text panel —
two sentences at most.

### `check` — retrieval, with mechanism-showing feedback

A multiple-choice question. The child picks an answer and gets feedback.

You write:

- **concept** (required): which concept this checks. This is the key the
  spaced-retrieval scheduler uses — the child will be re-asked this
  question in 1, 3, 7, 16 and 35 days.
- **q**: the question, in level variants
- **options**: 2–4 possible answers
- **answer**: the correct one (0 = first, 1 = second, etc.)
- **why** (required): the explanation, shown for **right AND wrong
  answers**

**The `why` shows the mechanism, not the answer.** "Because it is too big"
is the answer. "The holes were big enough for food and too small for
poison — nothing pushed anything, the size did all the work" is the
mechanism. A child who guessed right still needs to know why; a child who
guessed wrong needs to see what they missed.

### `build` — placement, and the boss

A drag-and-tap (or keyboard) placement stage. The child puts parts into
slots. With `trials`, it becomes a stress test: each trial names a part and
asks what happens without it.

This is the most complex stage to author. If you are new, skip it for your
first lesson and ask a coder to help with it later.

### `weigh` — two attributed readings of the same evidence

For contested topics (six lessons in the curriculum use this). Two or more
views, each attributed to a named holder, each with its reasoning.

**`who` is mandatory.** The page never speaks in its own voice on a weigh
stage. Put weigh stages on levels 3–4 only — a six-year-old should be
finding out what a fossil is, not adjudicating radiometric dating.

## The validation panel

At the top of the editor, a panel turns red when something is wrong and
green when everything passes. Common errors:

- **"L1 hook is N words (max 26)"** — your level 1 hook is too long.
  Shorten it.
- **"level 3 has no hook"** — you filtered a stage to levels 1–2 only, and
  now level 3 has no hook. Either remove the filter or add a second hook
  for levels 3–4.
- **"concept X is not declared in module's concepts list"** — you typed a
  concept id that does not match the module's declared concepts. Check
  spelling (kebab-case, like `velocity-is-rate`).
- **"answer index out of range"** — you set `answer: 2` but only have 2
  options (indexed 0 and 1).
- **"no simulation named X"** — you typed a sim name that does not exist.
  Use the dropdown.

You cannot export until the panel is green. This is deliberate — it
guarantees that what you produce will pass the build.

## Exporting

When the panel is green, two buttons appear at the bottom:

- **Copy JSON** — puts the lesson on your clipboard. Paste it into a file.
- **Download file** — saves it with the correct filename to your downloads.

The tool names the file for you using the convention: `NN-slug.json` (e.g.
`02-how-fast-is-fast.json`). The filename is shown above the buttons so you
know what to expect.

The file goes into `content/<module>/` in the project folder. For example,
a Describing Motion lesson goes in:

```
content/describing-motion/02-how-fast-is-fast.json
```

Then someone runs `npm run build` and the lesson is live. The build
regenerates `authored.json` and `reviews.json` automatically — you do not
touch those files.

**You do not run the build yourself.** That is a one-line command for
whoever manages the code. Your job ends at the downloaded JSON file.

## Writing good level variants

This is the hardest part and the most important.

| Level | Who reads it | How it sounds |
|---|---|---|
| 1 | Ages 5–7, or anyone who struggles to read | Short sentences. Concrete objects. One idea per sentence. No jargon. |
| 2 | Ages 8–10 | Full sentences. Can hold two ideas. Simple terms OK. |
| 3 | Ages 11–13 | Real vocabulary. Can reason about abstractions. |
| 4 | Ages 14–16 | Full technical register. Proper terms, real numbers. |

**The mistake everyone makes:** writing level 1 as level 2 with shorter
words. That is not level 1. Level 1 uses different sentence structure, not
just shorter words.

Example — the same concept at four levels:

- **L1**: "Push a ball. It rolls. Stop pushing. Why does it keep going?"
- **L2**: "You push a ball, then let go. It keeps moving. What is carrying it?"
- **L3**: "A ball is pushed and released. It continues moving. Nothing is in contact with it. What keeps it going?"
- **L4**: "An object given an initial velocity continues in the absence of net force. Why does this need a law?"

Notice: L1 is a sequence of short actions. L2 is a question about an
observation. L3 describes the setup abstractly. L4 uses the proper term
("net force") and asks about the law, not the phenomenon.

## The three things reviewers will send back

1. **A hook that is a definition.** "A cell is the basic unit of life" is
   not a hook. "What if a whole city had to fit inside something smaller
   than a grain of sand?" is.
2. **A `why` that says the answer instead of the mechanism.** "Because it
   is too big" is the answer. "The holes were big enough for food and too
   small for poison — nothing pushed anything, the size did all the work"
   is the mechanism.
3. **Level-1 prose that is level-2 prose with shorter words.** Level 1 is
   not a translation. It is a different way of saying the thing, for a
   reader who is decoding the words rather than reading them.

## If you get stuck

- **The validation panel is your friend.** It tells you exactly what to fix.
- **Read an existing lesson.** Open any file in `content/cells/` or
  `content/describing-motion/` in a text editor — they are all JSON, which
  is just text. You will see the pattern quickly.
- **Ask a coder for the sim params.** Each simulation reads different
  parameters. The tool cannot tell you what they are (the browser cannot
  read the sim's source). Ask whoever wrote the sim, or read the first
  few lines of `js/sims/<name>.js`.
- **Do not edit `curriculum.json` yourself.** That file defines the module
  graph, concepts, and specimens. If you need a new concept or specimen
  added, ask a coder — it is a one-line change but it is a contract, not
  documentation.

## Your first lesson: a checklist

- [ ] Pick a module whose topic you know well
- [ ] Pick a lesson slot whose title you can write to
- [ ] Write the hook (2 variants, L1 ≤ 26 words, not a definition)
- [ ] Add a predict stage (concept from the module's list, 3 options, one
      correct outcome)
- [ ] Add a sim stage (pick a sim from the dropdown, set params, write a
      goal)
- [ ] Add a name stage (2–4 variants, the term finally named)
- [ ] Add an apply stage (one short beat — why this matters)
- [ ] Add a check stage (concept, question, 3 options, correct answer,
      mechanism-showing why)
- [ ] Get the validation panel green
- [ ] Export the JSON and hand it to whoever runs the build

That is a complete lesson. It will take about 30 minutes the first time,
15 once you have done a few.

Welcome to authoring.
