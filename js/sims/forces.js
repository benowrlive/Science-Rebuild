/* <fp-forces> — Newton's laws in one screen. Hand-drawn, mechanism-first.

   A trolley on a surface. The child sets:
   - the push (applied force, in arbitrary "push units" that map to newtons)
   - the mass (how heavy the trolley is)
   - friction (the surface's resistance)

   The trolley obeys F_net = ma: a = (push - friction) / mass. The acceleration
   is visible as the rate at which the speed arrow grows. Three force arrows
   are drawn on the trolley at all times: the push (forward), friction
   (backward), and the net force (the difference). A child can watch the net
   force arrow shrink to zero when push equals friction — and see the trolley
   stop accelerating at that moment.

   This is the lesson: forces add, the net force decides the acceleration, and
   a = F/m. Nothing is scripted; the integrator is real.

   The pedagogy fork: L1-2 get a guided track where the caption names what is
   happening. L3-4 get an open track where they predict before looking. */

import { Sim, token, chip, say } from "./base.js";
import { handLine, handCircle, handArrow, handDashed, handText, seedHand } from "./hand.js";
import "../components/slider.js";

class Forces extends Sim {
  setup() {
    this.push = this.params.push ?? 3;
    this.mass = this.params.mass ?? 2;
    this.friction = this.params.friction ?? 1;
    this.goalSpeed = this.params.goalSpeed ?? 0.4;   // fraction of max speed
    this.elapsed = 0;
    this.held = 0;

    // Physics state. The trolley starts at rest; the child launches it.
    // Units: position in canvas-fraction, velocity in fraction/s.
    this.trolley = { x: 0.12, v: 0 };
    this.running = false;
    this.trail = [];
  }

  buildControls() {
    const add = (label, min, max, value, key) => {
      const s = document.createElement("fp-slider");
      Object.assign(s.dataset, { label, min, max, value, step: "1" });
      s.addEventListener("fp:change", (e) => {
        this[key] = e.detail.value;
        if (!this.running) this.render();
        this.announce();
      });
      this.controls.append(s);
    };
    add("How hard do you push?", 0, 6, this.push, "push");
    add("How heavy is the trolley?", 1, 4, this.mass, "mass");
    add("How rough is the ground?", 0, 4, this.friction, "friction");

    const mk = (cls, text, fn) => {
      const b = document.createElement("button");
      b.className = `sim-btn pressable ${cls}`;
      b.textContent = text;
      b.onclick = fn;
      return b;
    };
    this.playControls.append(mk("", "Launch", () => this.launch()));
    this.stepControls.append(
      mk("", "Launch", () => { this.launch(); this.stepOnce(120); }),
      mk("", "Start again", () => { this.setup(); this.render(); this.announce(); }),
    );

    const legend = document.createElement("ul");
    legend.className = "sim-legend";
    const li1 = document.createElement("li");
    li1.append(chip("diamond", "--w-forces-line"), document.createTextNode(say(["Your push", "Applied force"])));
    const li2 = document.createElement("li");
    li2.append(chip("cross", "--w-change-line"), document.createTextNode(say(["Friction", "Friction force"])));
    const li3 = document.createElement("li");
    li3.append(chip("square", "--w-correct-line"), document.createTextNode(say(["Net force", "Net force (the sum)"])));
    legend.append(li1, li2, li3);
    this.append(legend);
  }

  /* Launch: the trolley starts moving under the configured forces.
     Unlike incline (where push sets an initial velocity), here the push is a
     CONTINUOUS force — the trolley accelerates for as long as the push exceeds
     friction. This is the F=ma lesson. */
  launch() {
    if (this.running) return;
    this.trolley.v = 0;
    this.running = true;
    this.trail = [];
    this.elapsed = 0;
    this.resume();
  }

  /* Semi-implicit Euler. a = (push - friction) / mass, but friction only
     opposes motion (or resists starting). When moving, friction = -sign(v) * mu.
     When at rest, friction cancels push up to its max, so the trolley does not
     move until push > static friction. */
  step(dt) {
    if (!this.running) return;
    this.elapsed += dt;
    const t = this.trolley;

    // Net force. Friction opposes motion; at rest it cancels push up to its max.
    let netForce;
    if (Math.abs(t.v) < 0.001) {
      // Static friction: cancels push up to friction's max
      const resisted = Math.min(Math.abs(this.push), this.friction);
      netForce = this.push - Math.sign(this.push || 1) * resisted;
    } else {
      // Kinetic friction: constant, opposing motion
      netForce = this.push - Math.sign(t.v) * this.friction;
    }

    const accel = netForce / this.mass;
    t.v += accel * dt * 0.5;   // scale factor to keep speeds in a visible range
    t.x += t.v * dt;

    // Trail
    if (this.trail.length === 0 || Math.abs(t.x - this.trail[this.trail.length - 1]) > 0.01) {
      this.trail.push(t.x);
      if (this.trail.length > 40) this.trail.shift();
    }

    // Stop conditions: trolley reaches the edge, or comes to rest
    if (t.x >= 0.92) { this.running = false; this.settle(); this.checkGoal(); }
    else if (t.x < 0.05) { t.x = 0.12; t.v = 0; this.running = false; this.settle(); }
    else if (Math.abs(t.v) < 0.001 && netForce <= 0) { t.v = 0; this.running = false; this.settle(); this.checkGoal(); }

    this.checkGoal();
  }

  checkGoal() {
    // Goal: reach the target speed. Held for a few frames to avoid flicker.
    const reached = Math.abs(this.trolley.v) >= this.goalSpeed;
    this.held = reached ? this.held + 1 : 0;
    if (this.held > 20) {
      this.succeed({ seconds: Math.round(this.elapsed) });
    }
  }

  describe() {
    const t = this.trolley;
    const netF = this.push - this.friction;
    if (!this.running && t.v === 0) {
      return say([
        `Push ${this.push}, mass ${this.mass}, friction ${this.friction}. Press Launch.`,
        `F=${this.push}, m=${this.mass}, friction=${this.friction}. Ready to launch.`,
      ]);
    }
    if (this.running) {
      const dir = netF > 0 ? "forward" : netF < 0 ? "backward" : "balanced";
      return say([
        `The trolley is moving. Push ${this.push}, friction ${this.friction}, so the net force is ${dir}.`,
        `v=${t.v.toFixed(2)}, a=(F−f)/m=(${this.push}−${this.friction})/${this.mass}=${(netF/this.mass).toFixed(2)}. Net force ${dir}.`,
      ]);
    }
    return say([
      `The trolley stopped. Final speed: ${t.v.toFixed(2)}.`,
      `Stopped. v_final=${t.v.toFixed(2)}. The net force determined the acceleration throughout.`,
    ]);
  }

  draw(ctx) {
    const { w, h } = this;
    const ground = h * 0.7;
    const trolleyW = 60, trolleyH = 32;
    const wheelR = 7;
    seedHand(73);

    // Ground line
    handLine(ctx, 20, ground, w - 20, ground, {
      jitter: 2, passes: 2, color: token("--ink-2"), width: 2.5,
    });

    // Distance ticks
    ctx.fillStyle = token("--ink-3");
    for (let i = 0; i <= 10; i++) {
      const x = 20 + (w - 40) * (i / 10);
      handLine(ctx, x, ground, x, ground + 5, {
        jitter: 0.5, passes: 1, color: token("--ink-3"), width: 1,
      });
    }

    // Goal marker — a speedometer-style target
    const goalX = w - 40;
    handDashed(ctx, goalX, ground - 60, goalX, ground, {
      dash: 5, gap: 4, jitter: 1, color: token("--w-forces-line"), width: 2,
    });
    handText(ctx, say(["GOAL", "target v"]), goalX, ground - 68, {
      color: token("--w-forces-text"), size: 11, align: "center",
    });

    // Motion trail
    if (this.trail.length > 2) {
      for (let i = 1; i < this.trail.length; i++) {
        const x1 = 20 + (w - 40) * this.trail[i - 1];
        const x2 = 20 + (w - 40) * this.trail[i];
        handDashed(ctx, x1, ground - 20, x2, ground - 20, {
          dash: 3, gap: 3, jitter: 0.5, color: token("--ink-3"), width: 1.2,
        });
      }
    }

    // The trolley — hand-drawn box on two wheels
    const tx = 20 + (w - 40) * this.trolley.x;
    const ty = ground - trolleyH - wheelR;
    // Body
    handRect(ctx, tx, ty, trolleyW, trolleyH, {
      jitter: 1.5, color: token("--w-forces-line"), width: 2.5,
    });
    ctx.fillStyle = token("--w-forces-fill");
    ctx.fillRect(tx + 2, ty + 2, trolleyW - 4, trolleyH - 4);
    // Redraw the border on top of the fill so it stays sketchy
    handRect(ctx, tx, ty, trolleyW, trolleyH, {
      jitter: 1.5, color: token("--w-forces-line"), width: 2.5,
    });
    // Wheels
    handCircle(ctx, tx + 14, ground - wheelR, wheelR, {
      jitter: 1, passes: 2, color: token("--ink-2"), width: 2,
      fill: token("--surface"),
    });
    handCircle(ctx, tx + trolleyW - 14, ground - wheelR, wheelR, {
      jitter: 1, passes: 2, color: token("--ink-2"), width: 2,
      fill: token("--surface"),
    });
    // Mass label on the trolley
    handText(ctx, "m=" + this.mass, tx + trolleyW / 2, ty + trolleyH / 2 + 4, {
      color: token("--w-forces-deep"), size: 13, align: "center",
    });

    // Force arrows — the heart of the lesson.
    const arrowY = ty - 18;
    const scale = 12;   // px per force unit

    // Push arrow (forward, gold)
    if (this.push > 0) {
      const len = this.push * scale;
      handArrow(ctx, tx + trolleyW / 2, arrowY, tx + trolleyW / 2 + len, arrowY, {
        jitter: 1.5, color: token("--w-forces-line"), width: 2.8, head: 9,
      });
      handText(ctx, "F=" + this.push, tx + trolleyW / 2 + len + 6, arrowY + 4, {
        color: token("--w-forces-text"), size: 11,
      });
    }

    // Friction arrow (backward, red) — only if moving or if push > 0
    if (this.friction > 0 && (this.trolley.v !== 0 || this.push > 0)) {
      const len = this.friction * scale;
      handArrow(ctx, tx + trolleyW / 2, arrowY + 14, tx + trolleyW / 2 - len, arrowY + 14, {
        jitter: 1.5, color: token("--w-change-line"), width: 2.5, head: 8,
      });
      handText(ctx, "f=" + this.friction, tx + trolleyW / 2 - len - 6, arrowY + 18, {
        color: token("--w-change-text"), size: 11, align: "end",
      });
    }

    // Net force arrow (the sum) — below the trolley
    const netF = this.push - (this.trolley.v !== 0 || this.push > 0 ? this.friction : 0);
    if (Math.abs(netF) > 0.01) {
      const len = Math.abs(netF) * scale;
      const dir = netF > 0 ? 1 : -1;
      const netY = ground + 20;
      handArrow(ctx, tx + trolleyW / 2, netY, tx + trolleyW / 2 + dir * len, netY, {
        jitter: 1.2, color: token("--w-correct-line"), width: 3, head: 9,
      });
      handText(ctx, "net=" + netF, tx + trolleyW / 2 + dir * len + dir * 6, netY + 4, {
        color: token("--w-correct-text"), size: 11, align: dir > 0 ? "start" : "end",
      });
    } else {
      handText(ctx, say(["net=0 (balanced)", "F_net=0 (equilibrium)"]), tx + trolleyW / 2, ground + 24, {
        color: token("--ink-3"), size: 11, align: "center",
      });
    }

    // Velocity readout above the trolley
    if (Math.abs(this.trolley.v) > 0.001) {
      const vLen = Math.min(this.trolley.v * 100, 80);
      handArrow(ctx, tx + trolleyW / 2, ty - 35, tx + trolleyW / 2 + vLen, ty - 35, {
        jitter: 1, color: token("--ink"), width: 2, head: 7,
      });
      handText(ctx, say(["speed " + this.trolley.v.toFixed(2), "v=" + this.trolley.v.toFixed(2)]),
        tx + trolleyW / 2 + vLen + 6, ty - 31, {
          color: token("--ink"), size: 11,
        });
    }
  }
}

/* handRect helper — local to this sim. Draws four hand-lines to form a rectangle. */
function handRect(ctx, x, y, w, h, opts) {
  handLine(ctx, x, y, x + w, y, opts);
  handLine(ctx, x + w, y, x + w, y + h, opts);
  handLine(ctx, x + w, y + h, x, y + h, opts);
  handLine(ctx, x, y + h, x, y, opts);
}

if (!customElements.get("fp-forces")) customElements.define("fp-forces", Forces);
export default Forces;
