/* <fp-coaster> — the energy simulation. Hand-drawn, mechanism-first.

   A ball on a roller-coaster track. The child sets the starting height and
   friction. The ball rolls down the track, trading potential energy for
   kinetic energy as it falls, and back again as it climbs. The goal: get
   the ball over the hill to the finish.

   The physics is real energy conservation:
     PE = m * g * h        (proportional to height)
     KE = ½ * m * v²       (proportional to speed squared)
     PE + KE = const        (minus friction losses)

   Two energy bars are drawn beside the track: PE (gold) and KE (blue). As
   the ball descends, the PE bar shrinks and the KE bar grows. As it climbs,
   the reverse. A child can watch the energy move from one bar to the other
   — and watch both shrink when friction is on.

   The hand-drawn track is a series of connected hills and valleys, drawn
   with the sketchy line utility from hand.js. */

import { Sim, token, chip, say } from "./base.js";
import { handLine, handCircle, handArrow, handDashed, handText, seedHand } from "./hand.js";
import "../components/slider.js";

/* The track is defined as a function y(x) — height at position x.
   x is 0..1 (left to right), y is 0..1 (0 = ground, 1 = top).
   The track: start high on the left, dip to ground, rise over a hill
   in the middle, dip again, and end at ground level on the right. */
function trackY(x) {
  // Start ramp: high at x=0, ground by x=0.2
  if (x < 0.2) return 0.8 * (1 - x / 0.2) + 0.05;
  // Valley: ground from 0.2 to 0.3
  if (x < 0.3) return 0.05;
  // Climb to hill peak at x=0.5, height 0.55
  if (x < 0.5) {
    const t = (x - 0.3) / 0.2;
    return 0.05 + 0.5 * (1 - Math.cos(t * Math.PI)) / 2;
  }
  // Descend from hill to ground by x=0.7
  if (x < 0.7) {
    const t = (x - 0.5) / 0.2;
    return 0.55 - 0.5 * (1 - Math.cos(t * Math.PI)) / 2;
  }
  // Flat to the end
  return 0.05;
}

/* Slope of the track at x, for computing the acceleration along the track. */
function trackSlope(x) {
  const dx = 0.005;
  return (trackY(x + dx) - trackY(x - dx)) / (2 * dx);
}

class Coaster extends Sim {
  setup() {
    this.startHeight = this.params.startHeight ?? 4;
    this.friction = this.params.friction ?? 0;
    this.goalX = this.params.goalX ?? 0.9;
    this.elapsed = 0;
    this.held = 0;

    // Physics state. The ball starts at the left at the chosen height.
    // startHeight 1-5 maps to track heights 0.15 to 0.85.
    this.ball = {
      x: 0.02,
      y: 0.15 + this.startHeight * 0.14,
      v: 0,        // velocity along the track
    };
    // Override the ball's y to sit on the track at its x position
    this.ball.y = trackY(this.ball.x);
    // If the start height is above the track start, give it an initial PE boost
    this.ball.y = Math.max(this.ball.y, 0.15 + this.startHeight * 0.14);

    this.running = false;
    this.maxKE = 0;
    this.maxPE = 0;
  }

  buildControls() {
    const add = (label, min, max, value, key) => {
      const s = document.createElement("fp-slider");
      Object.assign(s.dataset, { label, min, max, value, step: "1" });
      s.addEventListener("fp:change", (e) => {
        this[key] = e.detail.value;
        if (!this.running) { this.setup(); this.render(); this.announce(); }
      });
      this.controls.append(s);
    };
    add("How high do you start?", 1, 5, this.startHeight, "startHeight");
    add("How rough is the track?", 0, 3, this.friction, "friction");

    const mk = (cls, text, fn) => {
      const b = document.createElement("button");
      b.className = `sim-btn pressable ${cls}`;
      b.textContent = text;
      b.onclick = fn;
      return b;
    };
    this.playControls.append(mk("", "Launch", () => { this.setup(); this.launch(); }));
    this.stepControls.append(
      mk("", "Launch", () => { this.setup(); this.launch(); this.stepOnce(120); }),
      mk("", "Start again", () => { this.setup(); this.render(); this.announce(); }),
    );

    const legend = document.createElement("ul");
    legend.className = "sim-legend";
    const li1 = document.createElement("li");
    li1.append(chip("circle", "--w-energy-line"), document.createTextNode(say(["Height energy (PE)", "Potential energy"])));
    const li2 = document.createElement("li");
    li2.append(chip("square", "--w-frontier-line"), document.createTextNode(say(["Speed energy (KE)", "Kinetic energy"])));
    legend.append(li1, li2);
    this.append(legend);
  }

  launch() {
    if (this.running) return;
    this.ball.v = 0;
    this.running = true;
    this.elapsed = 0;
    this.resume();
  }

  /* Energy-conserving integrator. The acceleration along the track is
     g * sin(slope) - friction * v. Energy is conserved when friction = 0;
     with friction, it drains as heat. */
  step(dt) {
    if (!this.running) return;
    this.elapsed += dt;
    const b = this.ball;

    // Track the ball's height at its current position
    const trackHeight = trackY(b.x);
    // If the ball is above the track (from the start height boost), it falls
    // freely until it lands on the track.
    if (b.y > trackHeight + 0.01) {
      // Free fall: simple gravity
      b.v -= 0.3 * dt * 60;
      b.y += b.v * dt * 0.5;
      if (b.y <= trackHeight) { b.y = trackHeight; /* keep v — it converts to along-track */ }
    } else {
      // On the track: acceleration = g * slope - friction
      b.y = trackHeight;
      const slope = trackSlope(b.x);
      const g = 0.4;
      const accel = g * slope - this.friction * 0.03 * Math.sign(b.v || 0.001);
      b.v += accel * dt * 60;
      b.x += b.v * dt * 0.3;
      // Clamp to track bounds
      if (b.x < 0) { b.x = 0; b.v = 0; }
    }

    // Track max energies for the bar scaling
    const pe = this.startHeight * 0.14 + 0.15 - b.y;
    const ke = b.v * b.v * 0.5;
    this.maxKE = Math.max(this.maxKE, ke);
    this.maxPE = Math.max(this.maxPE, pe);

    // Stop conditions
    if (b.x >= this.goalX) { this.running = false; this.settle(); this.checkGoal(); }
    else if (Math.abs(b.v) < 0.005 && Math.abs(trackSlope(b.x)) < 0.01) {
      b.v = 0; this.running = false; this.settle(); this.checkGoal();
    }
  }

  checkGoal() {
    const reached = this.ball.x >= this.goalX;
    this.held = reached ? this.held + 1 : 0;
    if (this.held > 15) this.succeed({ seconds: Math.round(this.elapsed) });
  }

  /* Compute PE and KE for the bar display. Normalised to 0..1 for bar height. */
  energies() {
    const b = this.ball;
    const maxH = 0.85;
    const pe = Math.max(0, (maxH - b.y) / maxH);
    const ke = Math.min(1, Math.abs(b.v) * 2);
    return { pe, ke, total: pe + ke };
  }

  describe() {
    const b = this.ball;
    const { pe, ke } = this.energies();
    if (!this.running && b.v === 0 && b.x < 0.05) {
      return say([
        `Start height ${this.startHeight}, friction ${this.friction}. Press Launch.`,
        `h₀=${this.startHeight}, μ=${this.friction}. Ready to launch.`,
      ]);
    }
    if (this.running) {
      return say([
        `The ball is moving. PE=${Math.round(pe*100)}%, KE=${Math.round(ke*100)}%.`,
        `v=${b.v.toFixed(2)}, PE=${pe.toFixed(2)}, KE=${ke.toFixed(2)}. Energy is conserved${this.friction ? " minus friction" : ""}.`,
      ]);
    }
    if (b.x >= this.goalX) {
      return say(["The ball reached the end!", "Goal reached — energy was sufficient."]);
    }
    return say([
      `The ball stopped at ${(b.x*100).toFixed(0)}%. Not enough energy to clear the hill.`,
      `Stopped at x=${b.x.toFixed(2)}. Insufficient initial PE to overcome the hill${this.friction ? " and friction" : ""}.`,
    ]);
  }

  draw(ctx) {
    const { w, h } = this;
    const ground = h * 0.85;
    const topPad = 30;
    const trackH = ground - topPad;
    seedHand(91);

    // Draw the track — hand-drawn curve
    ctx.strokeStyle = token("--ink-2");
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const steps = 60;
    const rng = ((s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; })(91);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;
      const y = trackY(x);
      const px = 20 + x * (w - 40);
      const py = ground - y * trackH;
      // Add hand-drawn jitter
      const jx = (rng() - 0.5) * 1.5;
      const jy = (rng() - 0.5) * 1.5;
      if (i === 0) ctx.moveTo(px + jx, py + jy);
      else ctx.lineTo(px + jx, py + jy);
    }
    ctx.stroke();
    // Second pass for pencil look
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;
      const y = trackY(x);
      const px = 20 + x * (w - 40);
      const py = ground - y * trackH;
      const jx = (rng() - 0.5) * 1.5;
      const jy = (rng() - 0.5) * 1.5;
      if (i === 0) ctx.moveTo(px + jx, py + jy);
      else ctx.lineTo(px + jx, py + jy);
    }
    ctx.stroke();

    // Ground line
    handLine(ctx, 20, ground, w - 20, ground, { jitter: 2, passes: 2, color: token("--ink-3"), width: 2 });

    // Goal marker
    const goalPx = 20 + this.goalX * (w - 40);
    handDashed(ctx, goalPx, ground - 50, goalPx, ground, {
      dash: 5, gap: 4, jitter: 1, color: token("--w-energy-line"), width: 2,
    });
    handText(ctx, "GOAL", goalPx, ground - 58, {
      color: token("--w-energy-text"), size: 11, align: "center",
    });

    // Energy bars — PE (gold) on the left, KE (blue) on the right
    const { pe, ke } = this.energies();
    const barW = 16;
    const barH = 80;
    const barX1 = 28;
    const barX2 = w - 28 - barW;
    const barY = ground - barH - 20;

    // PE bar
    ctx.fillStyle = token("--sunk");
    ctx.fillRect(barX1, barY, barW, barH);
    ctx.fillStyle = token("--w-energy-fill");
    ctx.fillRect(barX1, barY + barH * (1 - pe), barW, barH * pe);
    ctx.strokeStyle = token("--ink-3");
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX1, barY, barW, barH);
    handText(ctx, "PE", barX1 + barW / 2, barY - 6, { color: token("--w-energy-text"), size: 10, align: "center" });

    // KE bar
    ctx.fillStyle = token("--sunk");
    ctx.fillRect(barX2, barY, barW, barH);
    ctx.fillStyle = token("--w-frontier-fill");
    ctx.fillRect(barX2, barY + barH * (1 - ke), barW, barH * ke);
    ctx.strokeStyle = token("--ink-3");
    ctx.strokeRect(barX2, barY, barW, barH);
    handText(ctx, "KE", barX2 + barW / 2, barY - 6, { color: token("--w-frontier-text"), size: 10, align: "center" });

    // The ball
    const bx = 20 + this.ball.x * (w - 40);
    const by = ground - this.ball.y * trackH;
    const ballR = 12;
    handCircle(ctx, bx, by - ballR, ballR, {
      jitter: 1.2, passes: 2,
      color: token("--w-energy-line"), width: 2.5,
      fill: token("--w-energy-fill"),
    });
    // Cross-hatch
    handLine(ctx, bx - ballR*0.5, by - ballR*0.5 - ballR, bx + ballR*0.5, by + ballR*0.5 - ballR,
      { jitter: 0.6, passes: 1, color: token("--w-energy-deep"), width: 1 });
    handLine(ctx, bx - ballR*0.5, by + ballR*0.5 - ballR, bx + ballR*0.5, by - ballR*0.5 - ballR,
      { jitter: 0.6, passes: 1, color: token("--w-energy-deep"), width: 1 });

    // Height label at start
    if (!this.running && this.ball.x < 0.05) {
      handText(ctx, "h=" + this.startHeight, bx, by - ballR - 25, {
        color: token("--w-energy-text"), size: 12, align: "center",
      });
    }

    // Speed arrow when moving
    if (this.running && Math.abs(this.ball.v) > 0.01) {
      const vLen = Math.min(Math.abs(this.ball.v) * 60, 50);
      handArrow(ctx, bx, by - ballR - 12, bx + vLen, by - ballR - 12, {
        jitter: 1, color: token("--w-frontier-line"), width: 2, head: 7,
      });
    }
  }
}

if (!customElements.get("fp-coaster")) customElements.define("fp-coaster", Coaster);
export default Coaster;
