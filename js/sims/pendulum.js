/* <fp-pendulum> — oscillation simulation. Hand-drawn, mechanism-first.

   A pendulum hangs from a pivot. The child sets:
   - length (how long the string is)
   - amplitude (how far it starts from the centre)
   - damping (how much air resistance slows it)

   The pendulum swings with real physics: angular acceleration =
   -(g/L)sin(θ), with optional damping. The motion is periodic — it
   repeats — and the period depends only on the length (not the mass,
   not the amplitude, for small angles). That is Galileo's discovery.

   A trace of the bob's path is drawn as a faint hand-drawn trail, so
   the child can see the rhythm: the same arc, back and forth, slowing
   with damping. A centre line marks the resting position.

   The goal: keep the pendulum swinging for N seconds. With damping=0
   it swings forever; with damping>0 it eventually stops. The child
   learns that a pendulum needs no push to keep going (unlike the
   trolley) — the restoring force does all the work. */

import { Sim, token, chip, say } from "./base.js";
import { handLine, handCircle, handArrow, handDashed, handText, seedHand } from "./hand.js";
import "../components/slider.js";

const G = 9.81;   // m/s², scaled for display

class Pendulum extends Sim {
  setup() {
    this.length = this.params.length ?? 3;       // 1-5, maps to display length
    this.amplitude = this.params.amplitude ?? 3; // 1-5, maps to initial angle
    this.damping = this.params.damping ?? 0;     // 0-3
    this.goalTime = this.params.goalTime ?? 8;   // seconds of swinging
    this.elapsed = 0;
    this.held = 0;
    this.launched = false;

    // Physics state. θ is the angle from vertical (radians), ω is angular velocity.
    // amplitude 1-5 maps to 10-50 degrees.
    this.theta = (this.amplitude * 10) * Math.PI / 180;
    this.omega = 0;
    this.trail = [];   // recent bob positions for the trace
  }

  /* Episodic: the pendulum swings on its own once launched, no continuous
     force needed. But the reveal (the smooth motion) uses the loop, so we
     keep autoplay=true and let the physics run. */
  get autoplay() { return true; }

  buildControls() {
    const add = (label, min, max, value, key) => {
      const s = document.createElement("fp-slider");
      Object.assign(s.dataset, { label, min, max, value, step: "1" });
      s.addEventListener("fp:change", (e) => {
        this[key] = e.detail.value;
        if (!this.launched) { this.setup(); this.render(); this.announce(); }
      });
      this.controls.append(s);
    };
    add("How long is the string?", 1, 5, this.length, "length");
    add("How far does it start?", 1, 5, this.amplitude, "amplitude");
    add("How much air resistance?", 0, 3, this.damping, "damping");

    const mk = (cls, text, fn) => {
      const b = document.createElement("button");
      b.className = `sim-btn pressable ${cls}`;
      b.textContent = text;
      b.onclick = fn;
      return b;
    };
    this.playControls.append(mk("", "Let it swing", () => this.launch()));
    this.stepControls.append(
      mk("", "Let it swing", () => { this.launch(); }),
      mk("", "Start again", () => { this.setup(); this.render(); this.announce(); }),
    );

    const legend = document.createElement("ul");
    legend.className = "sim-legend";
    const li1 = document.createElement("li");
    li1.append(chip("circle", "--w-waves-line"), document.createTextNode(say(["The bob", "Bob position"])));
    const li2 = document.createElement("li");
    li2.append(chip("cross", "--w-change-line"), document.createTextNode(say(["Air resistance", "Damping force"])));
    legend.append(li1, li2);
    this.append(legend);
  }

  launch() {
    if (this.launched) return;
    this.setup();              // reset to current slider values
    this.launched = true;
    this.elapsed = 0;
    this.held = 0;
    this.met = false;
    this.resume();
  }

  /* Real pendulum physics: θ̈ = -(g/L)sin(θ) - b·θ̇
     For small angles, sin(θ) ≈ θ, giving simple harmonic motion with
     period T = 2π√(L/g). The simulation uses the full nonlinear equation. */
  step(dt) {
    if (!this.launched) return;
    this.elapsed += dt;

    // L maps from 1-5 to 0.5-2.5 m (display scale)
    const L = this.length * 0.5;
    const accel = -(G / L) * Math.sin(this.theta) - this.damping * 0.3 * this.omega;
    this.omega += accel * dt;
    this.theta += this.omega * dt;

    // Record trail every few steps
    if (this.trail.length === 0 || this.elapsed - this.trail[this.trail.length - 1].t > 0.05) {
      this.trail.push({ t: this.elapsed, theta: this.theta });
      if (this.trail.length > 80) this.trail.shift();
    }

    // Goal: keep swinging for goalTime seconds
    if (this.elapsed >= this.goalTime && Math.abs(this.omega) > 0.01) {
      this.held++;
      if (this.held > 10) this.succeed({ seconds: Math.round(this.elapsed) });
    }

    // Stop if damped to rest
    if (this.damping > 0 && Math.abs(this.omega) < 0.005 && Math.abs(this.theta) < 0.01) {
      this.launched = false;
      this.settle();
    }
  }

  describe() {
    const deg = (this.theta * 180 / Math.PI).toFixed(0);
    if (!this.launched) {
      return say([
        `String length ${this.length}, start ${this.amplitude}, air ${this.damping}. Press Let it swing.`,
        `L=${this.length}, θ₀=${this.amplitude*10}°, b=${this.damping}. Ready to release.`,
      ]);
    }
    if (Math.abs(this.omega) < 0.005) {
      return say(["The pendulum has stopped. The air resistance won.", "Damped to rest. Energy dissipated."]);
    }
    return say([
      `Swinging at ${Math.abs(deg)} degrees. The string length sets the rhythm.`,
      `θ=${deg}°, ω=${this.omega.toFixed(2)}. Period T=2π√(L/g) — depends on length, not mass.`,
    ]);
  }

  draw(ctx) {
    const { w, h } = this;
    seedHand(55);

    // Pivot at top centre
    const pivotX = w / 2;
    const pivotY = h * 0.15;

    // String length in pixels: 1-5 maps to 60-300px
    const Lpx = this.length * 60;

    // Bob position
    const bobX = pivotX + Math.sin(this.theta) * Lpx;
    const bobY = pivotY + Math.cos(this.theta) * Lpx;

    // Centre line (the resting position) — dashed
    handDashed(ctx, pivotX, pivotY, pivotX, pivotY + Lpx + 20, {
      dash: 4, gap: 4, jitter: 0.8, color: token("--ink-3"), width: 1.5,
    });

    // Amplitude markers — the arc the bob traces
    const ampRad = (this.amplitude * 10) * Math.PI / 180;
    const leftX = pivotX + Math.sin(-ampRad) * Lpx;
    const leftY = pivotY + Math.cos(-ampRad) * Lpx;
    const rightX = pivotX + Math.sin(ampRad) * Lpx;
    const rightY = pivotY + Math.cos(ampRad) * Lpx;
    // Faint arc from left amplitude to right amplitude
    ctx.strokeStyle = token("--hairline");
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, Lpx, Math.PI/2 - ampRad, Math.PI/2 + ampRad);
    ctx.stroke();
    ctx.setLineDash([]);

    // Trail — the bob's recent path
    if (this.trail.length > 2) {
      for (let i = 1; i < this.trail.length; i++) {
        const p0 = this.trail[i - 1];
        const p1 = this.trail[i];
        const x0 = pivotX + Math.sin(p0.theta) * Lpx;
        const y0 = pivotY + Math.cos(p0.theta) * Lpx;
        const x1 = pivotX + Math.sin(p1.theta) * Lpx;
        const y1 = pivotY + Math.cos(p1.theta) * Lpx;
        const alpha = i / this.trail.length;
        ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }

    // Pivot — a small hand-drawn triangle
    ctx.fillStyle = token("--ink-2");
    ctx.beginPath();
    ctx.moveTo(pivotX - 8, pivotY - 10);
    ctx.lineTo(pivotX + 8, pivotY - 10);
    ctx.lineTo(pivotX, pivotY);
    ctx.closePath();
    ctx.fill();

    // String — hand-drawn line
    handLine(ctx, pivotX, pivotY, bobX, bobY, {
      jitter: 0.8, passes: 1, color: token("--ink-2"), width: 2,
    });

    // Bob — hand-drawn circle
    const bobR = 16;
    handCircle(ctx, bobX, bobY, bobR, {
      jitter: 1.2, passes: 2,
      color: token("--w-waves-line"), width: 2.5,
      fill: token("--w-waves-fill"),
    });
    // Cross-hatch
    handLine(ctx, bobX - bobR*0.5, bobY - bobR*0.5, bobX + bobR*0.5, bobY + bobR*0.5,
      { jitter: 0.5, passes: 1, color: token("--w-waves-deep"), width: 1 });
    handLine(ctx, bobX - bobR*0.5, bobY + bobR*0.5, bobX + bobR*0.5, bobY - bobR*0.5,
      { jitter: 0.5, passes: 1, color: token("--w-waves-deep"), width: 1 });

    // Restoring force arrow — points toward the centre line when displaced
    if (Math.abs(this.theta) > 0.05 && this.launched) {
      const forceLen = Math.abs(this.theta) * 60;
      const dir = this.theta > 0 ? -1 : 1;   // toward centre
      handArrow(ctx, bobX, bobY, bobX + dir * forceLen, bobY, {
        jitter: 1, color: token("--w-change-line"), width: 2, head: 7,
      });
      handText(ctx, say(["pull back", "restoring force"]), bobX + dir * forceLen + dir * 6, bobY + 4, {
        color: token("--w-change-text"), size: 10, align: dir > 0 ? "start" : "end",
      });
    }

    // Length label
    handText(ctx, say(["length " + this.length, "L=" + (this.length * 0.5).toFixed(1) + "m"]),
      pivotX + 10, pivotY + Lpx / 2, {
        color: token("--ink-3"), size: 11,
      });

    // Elapsed time (if launched)
    if (this.launched) {
      handText(ctx, Math.round(this.elapsed) + "s", w - 30, 25, {
        color: token("--ink-2"), size: 14, align: "end",
      });
    }
  }
}

if (!customElements.get("fp-pendulum")) customElements.define("fp-pendulum", Pendulum);
export default Pendulum;
