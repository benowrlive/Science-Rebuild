/* Hand-drawn canvas drawing utilities.

   Every physics simulation draws with these instead of plain canvas paths, so
   the whole subject reads as sketched rather than engineered. The aesthetic
   matches the claymorphic UI: warm, physical, slightly imperfect — not a
   CAD diagram.

   The technique: every "stroke" is drawn as many short segments with small
   random offsets, so a line wobbles like a pencil dragged by hand.

   STABILITY: the jitter seed is a per-draw-call counter, NOT the pixel
   coordinates. This is critical — if the seed were derived from x/y, a 1px
   resize would change the hash and the jitter pattern would shift every frame,
   making static lines vibrate. The counter resets at the start of each draw()
   via seedHand(), so "the 3rd element drawn" always gets the same jitter as
   long as the draw order is stable. Moving elements (the ball, arrows whose
   position depends on velocity) get a new counter value each frame because
   they are drawn in a different order or position — which is correct, because
   they ARE moving.

   Zero dependencies, stays in the sim JS budget. Used by fp-incline,
   fp-forces, fp-coaster, and any future physics sim. */

// Deterministic PRNG so a frame doesn't flicker between repaints.
// mulberry32: small, fast, good enough for visual jitter.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-sim base seed (so two sims on the same page don't jitter in unison)
// plus a per-draw-call counter that increments on every hand*() call.
// seedHand() resets the counter at the start of each draw() so element N
// is stable across frames.
let _seed = 1;
let _counter = 0;
export function seedHand(n) { _seed = n | 0; _counter = 0; }
export function nextRng() { return mulberry32(_seed + (_counter++ * 2654435761)); }

/** Draw a hand-drawn line from (x1,y1) to (x2,y2).
    `jitter` is the max offset in px; `passes` is how many times to go over it
    (2 passes reads as a pencil pressed twice, not a single clean stroke). */
export function handLine(ctx, x1, y1, x2, y2, { jitter = 1.5, passes = 2, color, width = 2 } = {}) {
  if (color) ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  const rng = nextRng();
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(4, Math.floor(len / 8));
  for (let p = 0; p < passes; p++) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Perpendicular offset for the wobble, plus a tiny along-line offset
      // so the endpoints don't line up perfectly between passes.
      const nx = -dy / (len || 1), ny = dx / (len || 1);
      const j = (rng() - 0.5) * 2 * jitter;
      const x = x1 + dx * t + nx * j;
      const y = y1 + dy * t + ny * j;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** Draw a hand-drawn rectangle (outline). */
export function handRect(ctx, x, y, w, h, opts = {}) {
  handLine(ctx, x, y, x + w, y, opts);
  handLine(ctx, x + w, y, x + w, y + h, opts);
  handLine(ctx, x + w, y + h, x, y + h, opts);
  handLine(ctx, x, y + h, x, y, opts);
}

/** Draw a hand-drawn circle (wobbly ellipse, multi-pass). */
export function handCircle(ctx, cx, cy, r, { jitter = 1.5, passes = 2, color, width = 2, fill } = {}) {
  if (color) ctx.strokeStyle = color;
  if (fill) ctx.fillStyle = fill;
  ctx.lineWidth = width;
  const rng = nextRng();
  const steps = 32;
  for (let p = 0; p < passes; p++) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const j = (rng() - 0.5) * 2 * jitter;
      const rr = r + j;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (fill) ctx.fill();
    ctx.stroke();
  }
}

/** Draw a hand-drawn arrow from (x1,y1) to (x2,y2) with a arrowhead. */
export function handArrow(ctx, x1, y1, x2, y2, { jitter = 1.5, color, width = 2.2, head = 10 } = {}) {
  handLine(ctx, x1, y1, x2, y2, { jitter, passes: 2, color, width });
  // Arrowhead: two short lines from the tip, splayed at ~25 degrees.
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h1x = x2 - Math.cos(a - 0.4) * head;
  const h1y = y2 - Math.sin(a - 0.4) * head;
  const h2x = x2 - Math.cos(a + 0.4) * head;
  const h2y = y2 - Math.sin(a + 0.4) * head;
  handLine(ctx, x2, y2, h1x, h1y, { jitter: jitter * 0.6, passes: 2, color, width });
  handLine(ctx, x2, y2, h2x, h2y, { jitter: jitter * 0.6, passes: 2, color, width });
}

/** Draw a hand-drawn dashed line (for grid lines, motion trails, etc). */
export function handDashed(ctx, x1, y1, x2, y2, { dash = 6, gap = 4, jitter = 1, color, width = 1.5 } = {}) {
  if (color) ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  const rng = nextRng();
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  let t = 0;
  while (t < len) {
    const t2 = Math.min(t + dash, len);
    ctx.beginPath();
    const steps = Math.max(2, Math.floor((t2 - t) / 4));
    for (let i = 0; i <= steps; i++) {
      const tt = t + (t2 - t) * (i / steps);
      const j = (rng() - 0.5) * 2 * jitter;
      const x = x1 + dx * (tt / len) + nx * j;
      const y = y1 + dy * (tt / len) + ny * j;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    t = t2 + gap;
  }
}

/** Draw hand-written text using the canvas font, with a slight rotation
    per character so labels read as annotated rather than typeset. */
export function handText(ctx, text, x, y, { color, size = 14, align = "start", rotate = 0 } = {}) {
  if (color) ctx.fillStyle = color;
  ctx.font = `${size}px ${ctx.font?.split("px")?.pop() ?? "sans-serif"}`;
  ctx.textAlign = align;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
