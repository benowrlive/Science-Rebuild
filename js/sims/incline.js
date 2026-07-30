/* <fp-incline> — the first physics simulation. Hand-drawn, mechanism-first.

   The thesis of the whole subject in one screen: push a thing, watch what
   happens, predict before you look. A ball on a surface. Two sliders — how
   hard you push, and how rough the surface is. The ball obeys F=ma with
   friction, drawn as a hand-sketched ball on a hand-sketched line, with a
   hand-drawn arrow showing the force you are applying.

   Nothing is scripted. The physics is a real integrator (semi-implicit Euler
   with a fixed timestep from the base class), the friction is a real force,
   and the ball either reaches the end or stops short — whichever the numbers
   say. A child who pushes gently on a rough surface watches the ball stop,
   and that IS the lesson: friction is a force, and it wins when the push is
   small enough.

   The hand-drawn look comes from js/sims/hand.js — every stroke is a
   jittered multi-pass pencil line, so the sim reads as a notebook sketch
   rather than a CAD diagram. The jitter is deterministic per-frame so it
   does not flicker. */

import { Sim, token, chip, say } from "./base.js";
import { handLine, handCircle, handArrow, handDashed, handText, seedHand } from "./hand.js";
import "../components/slider.js";

class Incline extends Sim {
  setup() {
    this.push = this.params.push ?? 3;
    this.friction = this.params.friction ?? 2;
    this.goalDist = this.params.goalDist ?? 0.7;   // fraction of canvas width
    this.elapsed = 0;
    this.held = 0;

    // Physics state. The ball starts at the left; the goal is at goalDist.
    // Units are canvas-fraction (0..1); forces are in fraction/s^2.
    this.ball = { x: 0.08, v: 0, m: 1 };
    this.running = false;     // not moving until the child pushes "Go"
    this.trail = [];          // recent positions for the motion trail
  }

  buildControls() {
    const add = (label, min, max, value, key) => {
      const s = document.createElement("fp-slider");
      Object.assign(s.dataset, { label, min, max, value, step: "1" });
      s.addEventListener("fp:change", (e) => {
        this[key] = e.detail.value;
        if (!this.running) this.render();   // update the force arrow live
        this.announce();
      });
      this.controls.append(s);
    };
    add("How hard do you push?", 1, 6, this.push, "push");
    add("How rough is the ground?", 0, 5, this.friction, "friction");

    const mk = (cls, text, fn) => {
      const b = document.createElement("button");
      b.className = `sim-btn pressable ${cls}`;
      b.textContent = text;
      b.onclick = fn;
      return b;
    };
    this.playControls.append(mk("", "Push!", () => this.launch()));
    this.stepControls.append(
      mk("", "Push!", () => { this.launch(); this.stepOnce(120); }),
      mk("", "Start again", () => { this.setup(); this.render(); this.announce(); }),
    );

    // The legend explains the arrows — shape is the redundant channel.
    const legend = document.createElement("ul");
    legend.className = "sim-legend";
    const li1 = document.createElement("li");
    li1.append(chip("diamond", "--w-motion-line"), document.createTextNode(say(["Your push", "Applied force"])));
    const li2 = document.createElement("li");
    li2.append(chip("cross", "--w-change-line"), document.createTextNode(say(["Friction", "Friction force"])));
    legend.append(li1, li2);
    this.append(legend);
  }

  /* The child commits to a prediction by pressing Push — the ball launches
     with an initial velocity proportional to the push, then friction
     decelerates it. This is the mechanism: push sets v, friction drains it. */
  launch() {
    if (this.running) return;
    this.ball.v = this.push * 0.15;   // initial velocity from the push
    this.running = true;
    this.trail = [];
    this.resume();
  }

  /* Semi-implicit Euler with friction. dt is fixed by the base class (1/60 s).
     Friction is a constant deceleration opposing motion — the simplest model
     that is still honest. Static friction (the ball not moving until push >
     friction) is a separate lesson. */
  step(dt) {
    if (!this.running) return;
    this.elapsed += dt;
    const b = this.ball;

    // Friction: constant deceleration opposing velocity. Only when moving.
    const fricDecel = this.friction * 0.04;
    if (b.v > 0) b.v = Math.max(0, b.v - fricDecel * dt * 60);

    b.x += b.v * dt;

    // Trail: every few steps, record position for the dashed trail.
    if (this.trail.length === 0 || b.x - this.trail[this.trail.length - 1] > 0.01) {
      this.trail.push(b.x);
      if (this.trail.length > 40) this.trail.shift();
    }

    // Ball stopped or reached the end.
    if (b.v <= 0.001) { b.v = 0; this.running = false; this.settle(); this.checkGoal(); }
    else if (b.x >= 0.96) { this.running = false; this.settle(); this.checkGoal(); }
  }

  checkGoal() {
    const reached = this.ball.x >= this.goalDist;
    // Hold the state so a single lucky frame doesn't count.
    this.held = reached ? this.held + 1 : 0;
    if (this.held > 15) {
      this.succeed({ seconds: Math.round(this.elapsed) });
    }
  }

  describe() {
    const b = this.ball;
    if (!this.running && b.v === 0 && b.x < 0.1) {
      return say([
        `Push ${this.push}, ground ${this.friction}. Press Push to launch.`,
        `Push ${this.push}, friction ${this.friction}. Ready to launch.`,
      ]);
    }
    if (this.running) {
      return say([
        `The ball is moving. Push ${this.push}, ground ${this.friction}.`,
        `Moving at ${b.v.toFixed(2)} per second. Applied force ${this.push}, friction ${this.friction}.`,
      ]);
    }
    if (b.x >= this.goalDist) {
      return say([
        `It reached the end! Push ${this.push} was enough.`,
        `Goal reached. The applied force overcame friction.`,
      ]);
    }
    return say([
      `It stopped short. Push ${this.push} was not enough for ground ${this.friction}.`,
      `Stopped at ${(b.x * 100).toFixed(0)}%. Friction exceeded the applied force.`,
    ]);
  }

  draw(ctx) {
    const { w, h } = this;
    const ground = h * 0.7;       // y of the surface line
    const ballR = 18;
    seedHand(42);                 // deterministic jitter per frame

    // Ground line — hand-drawn, slightly wobbly.
    handLine(ctx, 20, ground, w - 20, ground, {
      jitter: 2, passes: 2, color: token("--ink-2"), width: 2.5,
    });

    // Goal marker — a dashed hand-drawn flag at goalDist.
    const goalX = 20 + (w - 40) * this.goalDist;
    handDashed(ctx, goalX, ground - 50, goalX, ground, {
      dash: 5, gap: 4, jitter: 1, color: token("--w-motion-line"), width: 2,
    });
    handText(ctx, "GOAL", goalX, ground - 58, {
      color: token("--w-motion-text"), size: 11, align: "center",
    });

    // Motion trail — dashed hand-drawn line behind the ball.
    if (this.trail.length > 2) {
      for (let i = 1; i < this.trail.length; i++) {
        const x1 = 20 + (w - 40) * this.trail[i - 1];
        const x2 = 20 + (w - 40) * this.trail[i];
        handDashed(ctx, x1, ground - ballR, x2, ground - ballR, {
          dash: 3, gap: 3, jitter: 0.5, color: token("--ink-3"), width: 1.2,
        });
      }
    }

    // The ball — hand-drawn circle with a fill.
    const ballX = 20 + (w - 40) * this.ball.x;
    const ballY = ground - ballR;
    handCircle(ctx, ballX, ballY, ballR, {
      jitter: 1.5, passes: 2,
      color: token("--w-motion-line"), width: 2.5,
      fill: token("--w-motion-fill"),
    });
    // A little cross-hatch inside the ball so it reads as drawn, not filled.
    handLine(ctx, ballX - ballR * 0.5, ballY - ballR * 0.5, ballX + ballR * 0.5, ballY + ballR * 0.5,
      { jitter: 0.8, passes: 1, color: token("--w-motion-deep"), width: 1 });
    handLine(ctx, ballX - ballR * 0.5, ballY + ballR * 0.5, ballX + ballR * 0.5, ballY - ballR * 0.5,
      { jitter: 0.8, passes: 1, color: token("--w-motion-deep"), width: 1 });

    // Force arrows — only when not running (showing the setup) or when running
    // (showing what is happening). Push arrow is gold, friction is red.
    if (!this.running && this.ball.v === 0 && this.ball.x < 0.1) {
      // Setup: show the push arrow to the right of the ball.
      handArrow(ctx, ballX + ballR + 4, ballY, ballX + ballR + 4 + this.push * 10, ballY, {
        jitter: 1.5, color: token("--w-motion-line"), width: 2.5, head: 8,
      });
      handText(ctx, `push ${this.push}`, ballX + ballR + 4 + this.push * 10 + 6, ballY + 4, {
        color: token("--w-motion-text"), size: 12,
      });
    } else if (this.running) {
      // Moving: show velocity arrow (how fast it is going right now).
      const vLen = this.ball.v * 80;
      if (vLen > 3) {
        handArrow(ctx, ballX, ballY - ballR - 8, ballX + vLen, ballY - ballR - 8, {
          jitter: 1.2, color: token("--w-motion-line"), width: 2, head: 7,
        });
        handText(ctx, say(["speed", "velocity"]), ballX + vLen + 6, ballY - ballR - 4, {
          color: token("--w-motion-text"), size: 11,
        });
      }
      // Friction arrow pointing left (opposing motion).
      if (this.friction > 0) {
        handArrow(ctx, ballX - ballR - 4, ballY, ballX - ballR - 4 - this.friction * 8, ballY, {
          jitter: 1.2, color: token("--w-change-line"), width: 2, head: 7,
        });
      }
    }

    // Distance markers along the ground — hand-drawn ticks.
    ctx.fillStyle = token("--ink-3");
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i <= 10; i++) {
      const x = 20 + (w - 40) * (i / 10);
      handLine(ctx, x, ground, x, ground + 5, {
        jitter: 0.5, passes: 1, color: token("--ink-3"), width: 1,
      });
    }
  }
}

if (!customElements.get("fp-incline")) customElements.define("fp-incline", Incline);
export default Incline;
