/* The boot intro. Plays once, on first visit, then never again.

   It is a separate module loaded by its own <script> tag in index.html —
   NOT imported by app.js — so it does not count against the shell JS
   budget. The build's shell budget measures the static-import closure of
   app.js; this file is outside that closure.

   The intro:
   1. Checks localStorage for fp.boot. If present, exits immediately.
   2. Creates a full-screen overlay with the mark (SVG, stroke-dasharray
      animation so it draws itself), the wordmark, and a tagline.
   3. Auto-dismisses after 3.5s, or on click. Sets localStorage.
   4. The overlay uses CSS animations only — no JS animation loop.

   The tagline is the context setter: "Poke things. Watch what happens."
   That IS the product, stated in five words. */

const KEY = "fp.boot";

if (location.hash && location.hash !== "#/") {
  // If the user arrived at a deep link (a lesson, a module), skip the intro.
  // The intro is for first-time visitors landing on the Atlas.
} else if (localStorage.getItem(KEY)) {
  // Already seen — never play again.
} else {
  const overlay = document.createElement("div");
  overlay.id = "boot";
  overlay.className = "boot";
  overlay.innerHTML = `
    <div class="boot-mark">
      <svg viewBox="0 0 32 32" width="64" height="64" aria-hidden="true">
        <circle cx="16" cy="16" r="13" fill="none" stroke="var(--w-origins-line)" stroke-width="2.5" stroke-linecap="round" class="boot-ring"/>
        <circle cx="13.5" cy="14" r="4.6" fill="var(--w-origins-deep)" class="boot-dot boot-dot--1"/>
        <circle cx="22" cy="20.5" r="2.2" fill="var(--w-origins-line)" class="boot-dot boot-dot--2"/>
        <circle cx="9.5" cy="22.5" r="1.6" fill="var(--w-origins-line)" class="boot-dot boot-dot--3"/>
      </svg>
    </div>
    <h1 class="boot-title">First Principles</h1>
    <p class="boot-tag">Poke things. Watch what happens.</p>
    <p class="boot-hint">click to begin</p>
  `;
  document.body.append(overlay);
  // Prevent the app shell from showing through during the intro
  document.body.dataset.booting = "";

  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    overlay.classList.add("boot--gone");
    delete document.body.dataset.booting;
    setTimeout(() => overlay.remove(), 600);
  };

  overlay.addEventListener("click", dismiss, { once: true });
  setTimeout(dismiss, 3500);
}
