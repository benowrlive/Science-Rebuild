import pathlib, sys
"""Writes css/worlds.css. Every value is solved against a WCAG gate, never chosen by eye.
Run after changing a hue:  python3 tools/gen-palette.py

Self-contained — palette solver inlined. No external imports."""
import math

# ---------- colour conversion: OKLCH -> sRGB hex ----------
def oklch_to_srgb(L, C, h_deg):
    h = math.radians(h_deg)
    a, b = C*math.cos(h), C*math.sin(h)
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    r =  4.0767416621*l - 3.3077115913*m + 0.2309699292*s
    g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
    bb =-0.0041960863*l - 0.7034186147*m + 1.7076147010*s
    def enc(c):
        c = max(0.0, min(1.0, c))
        return 12.92*c if c <= 0.0031308 else 1.055*(c**(1/2.4)) - 0.055
    return tuple(enc(x) for x in (r, g, bb))

def hexof(L, C, h):
    return '#' + ''.join(f'{round(x*255):02X}' for x in oklch_to_srgb(L, C, h))

def in_gamut(L, C, h):
    r, g, b = oklch_to_srgb(L, C, h)
    # oklch_to_srgb clamps; detect clipping by re-running unclamped
    hh = math.radians(h); a, bb_ = C*math.cos(hh), C*math.sin(hh)
    l_, m_, s_ = L+0.3963377774*a+0.2158037573*bb_, L-0.1055613458*a-0.0638541728*bb_, L-0.0894841775*a-1.2914855480*bb_
    l, m, s = l_**3, m_**3, s_**3
    raw = (4.0767416621*l-3.3077115913*m+0.2309699292*s,
           -1.2684380046*l+2.6097574011*m-0.3413193965*s,
           -0.0041960863*l-0.7034186147*m+1.7076147010*s)
    return all(-0.001 <= c <= 1.001 for c in raw)

# ---------- WCAG ----------
def _lin(c):
    c /= 255
    return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
def lum(hx):
    hx = hx.lstrip('#'); r,g,b = (int(hx[i:i+2],16) for i in (0,2,4))
    return 0.2126*_lin(r)+0.7152*_lin(g)+0.0722*_lin(b)
def contrast(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la,lb), min(la,lb)
    return (hi+0.05)/(lo+0.05)

# ---------- solver: find the lightest colour at hue h that still clears `gate` on `ground` ----------
def solve(h, C, ground, gate, darker=True, lo=0.05, hi=0.99):
    """Binary-search L for the extreme colour that still clears `gate` against
    EVERY ground in `ground` (a hex string or a list of them).

    Gating against one ground is the trap: a colour solved on the page
    background then fails the moment it lands on a tinted card, and nothing
    reports it. Pass every surface the colour can actually composite onto."""
    grounds = [ground] if isinstance(ground, str) else list(ground)
    best = None
    for _ in range(40):
        mid = (lo+hi)/2
        c = C
        while c > 0.005 and not in_gamut(mid, c, h):
            c -= 0.005
        hx = hexof(mid, c, h)
        ok = min(contrast(hx, g) for g in grounds) >= gate
        if darker:
            if ok: best = (mid, c, hx); lo = mid   # can we go lighter and still pass?
            else:  hi = mid
        else:
            if ok: best = (mid, c, hx); hi = mid
            else:  lo = mid
    return best

# ---------- the palette ----------
WORLDS = [("origins",175),("code",290),("change",60),("bodies",20),("living",135),("frontier",250)]
PAPER   = "#FDFBF7"   # light ground
NIGHT   = "#191614"   # dark ground

def ramp(h, ground, dark_mode):
    """Roles: tint(bg wash) fill(large decorative) line(UI stroke >=3:1) text(body >=4.5:1) deep."""
    out = {}
    # tint / fill are decorative: fixed light values, no gate, just gamut-safe
    tl = 0.96 if not dark_mode else 0.24
    fl = 0.86 if not dark_mode else 0.36
    for name, L, C in (("tint", tl, 0.035), ("fill", fl, 0.10)):
        c = C
        while c > 0.005 and not in_gamut(L, c, h): c -= 0.005
        out[name] = hexof(L, c, h)
    dark = not dark_mode           # on light ground we need darker colours, and vice versa
    out["line"] = solve(h, 0.16, ground, 3.0, darker=dark)[2]
    out["text"] = solve(h, 0.16, ground, 4.5, darker=dark)[2]
    dl = 0.32 if not dark_mode else 0.88
    c = 0.10
    while c > 0.005 and not in_gamut(dl, c, h): c -= 0.005
    out["deep"] = hexof(dl, c, h)
    return out

def emit(ground, dark_mode, label):
    print(f"\n/* ---------- {label} (ground {ground}) ---------- */")
    for key, h in WORLDS:
        r = ramp(h, ground, dark_mode)
        line = "  " + " ".join(f"--w-{key}-{k}:{v};" for k, v in r.items())
        print(line)
        checks = {k: round(contrast(v, ground), 2) for k, v in r.items()}
        print(f"  /* {key:9s} line {checks['line']:>5} (>=3) | text {checks['text']:>5} (>=4.5) */")

if __name__ == "__main__":
    emit(PAPER, False, "LIGHT world ramps")
    emit(NIGHT, True,  "DARK world ramps")

    print("\n/* ---------- chrome, solved against the paper/night grounds ---------- */")
    for label, ground, dm in (("light", PAPER, False), ("dark", NIGHT, True)):
        # neutral ink steps at hue 60 (warm), very low chroma
        ink   = "#241F1B" if not dm else "#F7F3ED"
        ink2  = solve(60, 0.012, ground, 7.0, darker=not dm)[2]
        ink3  = solve(60, 0.012, ground, 4.5, darker=not dm)[2]
        line_ = solve(60, 0.012, ground, 3.0, darker=not dm)[2]
        print(f"  /* {label} */ --ink:{ink}; --ink-2:{ink2}; --ink-3:{ink3}; --line:{line_};")
        for n, v in (("ink",ink),("ink-2",ink2),("ink-3",ink3),("line",line_)):
            print(f"  /*   {n:6s} {v} = {contrast(v, ground):.2f} */")

    print("\n/* ---------- semantics (light ground) ---------- */")
    for name, h in (("correct",150),("wrong",25),("warn",70),("info",250),("discovery",320)):
        t = solve(h, 0.17, PAPER, 4.5, darker=True)[2]
        l = solve(h, 0.17, PAPER, 3.0, darker=True)[2]
        print(f"  --s-{name}:{t}; --s-{name}-line:{l};  /* text {contrast(t,PAPER):.2f} | line {contrast(l,PAPER):.2f} */")


# Physics worlds join the life-sciences worlds here. Hues were chosen to
# sit in the widest gaps between existing worlds and semantic colours, so
# every world reads as distinct at a glance. See docs/DECISIONS.md for the
# methodology.
WORLDS = [("origins",190),("code",295),("change",55),("bodies",340),("living",122),("frontier",250),
          ("motion",38),("forces",106),("energy",170),("waves",220),("fields",272),("modern",317)]
SEM    = [("correct",152),("wrong",22),("discovery",90)]
PAPER, NIGHT = "#FDFBF7", "#191614"
INK_L, INK_D = "#241F1B", "#F7F3ED"
TEXT_GATE, LINE_GATE = 4.60, 3.10

def gam(L, C, h):
    while C > 0.005 and not in_gamut(L, C, h): C -= 0.005
    return hexof(L, C, h)

def ramp(h, ground, ink, dark, extra_grounds=()):
    """`ground` is the page; `extra_grounds` are the other surfaces this ramp's
    text and strokes can land on (cards, sunken panels, its own tint). Text is
    solved against all of them at once."""
    d = not dark
    fill_L, step = (0.87, 0.01) if not dark else (0.34, -0.01)
    while True:
        fill = gam(fill_L, 0.105, h)
        if contrast(fill, ink) >= TEXT_GATE: break
        fill_L += step
    tint = gam(0.965 if not dark else 0.225, 0.035, h)
    grounds = [ground, tint, *extra_grounds]
    return {"tint": tint, "fill": fill,
            "line": solve(h, 0.16, grounds, LINE_GATE, darker=d)[2],
            "text": solve(h, 0.16, grounds, TEXT_GATE, darker=d)[2],
            "deep": gam(0.30 if not dark else 0.90, 0.09, h)}

def surfaces(ground, dark):
    """Every neutral background a text colour can composite onto."""
    return [ground,
            gam(0.995 if not dark else 0.215, 0.004, 60),   # --surface
            gam(0.955 if not dark else 0.185, 0.008, 60)]   # --sunk

def scope(ground, ink, dark):
    out, fails = [], []
    surf = surfaces(ground, dark)
    for key, h in WORLDS + SEM:
        r = ramp(h, ground, ink, dark, extra_grounds=surf[1:])
        for k, v in r.items(): out.append(f"  --w-{key}-{k}: {v};")
        checks = [*surf, r["tint"]]
        if (min(contrast(r["line"], g) for g in checks) < 3.0
                or min(contrast(r["text"], g) for g in checks) < 4.5
                or contrast(r["fill"], ink) < 4.5
                # `deep` is used as a solid fill with page-coloured text on it
                or contrast(r["deep"], ground) < 4.5):
            fails.append(key)
    return out, fails

L, fL = scope(PAPER, INK_L, False)
D, fD = scope(NIGHT, INK_D, True)
if fL or fD:
    print(f"CONTRAST GATE FAILED: {fL + fD}", file=sys.stderr); sys.exit(1)

def chrome(ground, ink, dark):
    """Neutral ink must survive every surface AND every world tint — a caption
    on a tinted card is still a caption."""
    d = not dark
    g = surfaces(ground, dark) + [ramp(h, ground, ink, dark)["tint"] for _, h in WORLDS + SEM]
    return [f"  --paper: {ground};", f"  --ink: {ink};",
            f"  --ink-2: {solve(60, 0.012, g, 7.0, darker=d)[2]};",
            f"  --ink-3: {solve(60, 0.012, g, TEXT_GATE, darker=d)[2]};",
            f"  --line: {solve(60, 0.012, g, LINE_GATE, darker=d)[2]};",
            f"  --hairline: {gam(0.925 if not dark else 0.26, 0.010, 60)};",
            f"  --surface: {gam(0.995 if not dark else 0.215, 0.004, 60)};",
            f"  --sunk: {gam(0.955 if not dark else 0.185, 0.008, 60)};",
            # Elevation ingredients. A shadow must always be DARKER than the
            # surface it falls on and a rim light always LIGHTER, so neither can
            # be derived from --ink: --ink inverts between themes and would paint
            # a white halo under every dark-mode card.
            "  --shade: 26 22 19;" if not dark else "  --shade: 0 0 0;",
            "  --rim: 255 255 255;",
            *(["  --shade-o1: .13;", "  --shade-o2: .26;", "  --rim-o: .55;"] if not dark
              else ["  --shade-o1: .55;", "  --shade-o2: .72;", "  --rim-o: .10;"])]

hdr = ("/* GENERATED by tools/gen-palette.py — do not hand-edit.\n"
       "   Every colour below was solved against a WCAG gate with margin (text 4.6:1,\n"
       "   UI stroke 3.1:1, ink-on-fill 4.6:1) rather than picked by eye. Regenerate\n"
       "   after changing a hue; the generator exits non-zero if any gate fails. */\n")
body = (hdr + ":root {\n" + "\n".join(chrome(PAPER, INK_L, False) + L) + "\n}\n\n"
        "@media (prefers-color-scheme: dark) {\n  :root {\n"
        + "\n".join("  " + s for s in chrome(NIGHT, INK_D, True) + D) + "\n  }\n}\n\n"
        '[data-theme="light"] {\n' + "\n".join(chrome(PAPER, INK_L, False) + L) + "\n}\n\n"
        '[data-theme="dark"] {\n' + "\n".join(chrome(NIGHT, INK_D, True) + D) + "\n}\n")
# Alias blocks: any subtree tagged [data-world="x"] resolves the generic
# --w-tint/fill/line/text/deep to that world's ramp, so components.css never
# names a world. Generated here so it cannot drift from the hue list.
alias = "\n/* scope aliases — components use --w-* and never name a world */\n" + "\n".join(
    '[data-world="%s"] {\n%s\n}' % (k, "\n".join(f"  --w-{r}: var(--w-{k}-{r});" for r in
        ("tint","fill","line","text","deep")))
    for k, _ in WORLDS + SEM) + "\n"
pathlib.Path("css/worlds.css").write_text(body + alias)
print(f"css/worlds.css written — {len(WORLDS)} worlds + {len(SEM)} semantics x 2 themes, all gates passed")
