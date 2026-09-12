# KIVO Design System — Standalone Spec for Agents

> Copy this file into any project. It is the complete visual language extracted from the Kivo app (`frontend/Design.md` + `app/globals.css` + `lib/theme.js` + `lib/chat-style.js` + `transitions.css` / `transitions-extra.css`). An agent with NO access to the Kivo repo must be able to reproduce the look exactly from this file alone.
> Stack-agnostic: works with Tailwind v4, plain CSS, or any framework. JS-only, no TypeScript required.

## 0. Agent Instructions (MUST FOLLOW)

1. **Dark-only. Never ship light mode** unless explicitly asked. Default canvas is near-black `#090909`.
2. **Never hardcode hex in components.** Use CSS vars / tokens only: `var(--canvas)`, `var(--surface-1)`, `var(--ink)`, `var(--ink-muted)`, `var(--accent-blue)`, `var(--border)`, or Tailwind equivalents (`bg-canvas text-ink`).
3. **Accent blue `#4ba9e1` is a signal color ONLY** — links, focus rings, selection, unread badges, active toggles. Never as button fill, card bg, or section bg.
4. **All CTAs are pills** (`border-radius:9999px`). Primary = white pill on dark. Secondary = charcoal pill. No ghost-bordered CTAs, no squared buttons.
5. **Hierarchy via surface lift** (`canvas → surface-1 → surface-2`), NOT via extra colors or font-weight ramps.
6. **Typography:** Display `Outfit`, Body `Inter` with OpenType features on. Keep aggressive negative tracking on display sizes.
7. **Motion:** use only the `t-*` classes + duration/ease tokens below. Always honor `prefers-reduced-motion`.
8. **Gradients are cards, never section backgrounds.** Max 1–2 spotlight cards per viewport.
9. If a token you need does not exist below, reuse the closest existing one. Do NOT invent new palette entries.

---

## 1. Philosophy

- The dark canvas IS the whitespace. Long stretches of near-black with one assertive statement per band.
- Page rhythm: band of charcoal cards → band of black with a gradient spotlight card → back to charcoal.
- Hierarchy is binary: `ink` or `ink-muted`. Weight stays 400/500; size + tracking carry hierarchy.
- Brand chrome is monochrome (white pills, charcoal cards, gray text). One blue signal + one gradient family.

## 2. Colors

### 2.1 Core tokens

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#090909` | page bg, hero, FAQ, footer |
| `--surface-1` | `#141414` | cards, secondary buttons, mockup tiles, inputs |
| `--surface-2` | `#1c1c1c` | featured cards, selected tabs, hovers, received bubbles |
| `--surface-3` | `#222222` | hover lift only |
| `--hairline` | `#262626` | 1px borders, dividers, input borders |
| `--hairline-soft` | `#1a1a1a` | subtle dividers |
| `--ink` | `#ffffff` | headlines, primary text, primary CTA bg |
| `--ink-muted` | `#999999` | secondary text, meta, placeholders |
| `--accent-blue` | `#4ba9e1` | links, focus ring, selection, unread badge, toggle-on |
| `--inverse-canvas` | `#ffffff` | primary CTA bg (same as ink on dark) |
| `--inverse-ink` | `#000000` | primary CTA text |
| `--success` | `#22c55e` | online dot, checkmarks |
| `--destructive` | `#ff5577` | danger bg/text |
| `--gradient-magenta` | `#d44df0` | spotlight card variant |
| `--gradient-violet` | `#6a4cf5` | spotlight card variant (most common) |
| `--gradient-orange` | `#ff7a3d` | spotlight card variant |
| `--gradient-coral` | `#ff5577` | spotlight card variant |

### 2.2 shadcn / component mapping (Tailwind v4 `@theme`)

```
--background:#090909 --foreground:#ffffff
--card:#141414 --card-foreground:#ffffff
--popover:#141414 --popover-foreground:#ffffff
--primary:#ffffff --primary-foreground:#000000
--secondary:#1c1c1c --secondary-foreground:#ffffff
--muted:#1c1c1c --muted-foreground:#999999
--accent:#1c1c1c --accent-foreground:#ffffff
--border:#262626 --input:#262626 --ring:#4ba9e1
--sidebar:#141414 --sidebar-foreground:#ffffff
```

### 2.3 Drop-in `:root` block (paste into any CSS)

```css
:root{
  --canvas:#090909; --surface-1:#141414; --surface-2:#1c1c1c; --surface-3:#222222;
  --hairline:#262626; --hairline-soft:#1a1a1a;
  --ink:#ffffff; --ink-muted:#999999;
  --accent-blue:#4ba9e1; --inverse-canvas:#ffffff; --inverse-ink:#000000;
  --gradient-magenta:#d44df0; --gradient-violet:#6a4cf5;
  --gradient-orange:#ff7a3d; --gradient-coral:#ff5577;
  --success:#22c55e; --destructive:#ff5577;
  --background:#090909; --foreground:#ffffff; --card:#141414;
  --primary:#ffffff; --primary-foreground:#000000;
  --secondary:#1c1c1c; --muted:#1c1c1c; --muted-foreground:#999999;
  --border:#262626; --input:#262626; --ring:#4ba9e1;
  color-scheme:dark;
}
::selection{background:var(--accent-blue);color:#fff;}
```

Body baseline:

```css
html{background:var(--canvas);color:var(--ink);scroll-behavior:smooth;}
body{
  background:var(--canvas); color:var(--ink);
  font-family:Inter,system-ui,sans-serif;
  font-feature-settings:"cv01" 1,"cv05" 1,"cv09" 1,"cv11" 1,"ss03" 1,"ss07" 1,"dlig" 1,"tnum" 1;
  -webkit-font-smoothing:antialiased;
}
/* faint grid backdrop — signature */
body::before{
  content:""; position:fixed; inset:0; z-index:0; pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
  background-size:64px 64px;
  mask-image:radial-gradient(circle at 50% 30%,black,transparent 75%);
}
/* scrollbars */
*{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.14) transparent;}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:9999px}
::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.28)}
```

## 3. Themes (10 presets — same shape, different canvas cast)

All themes share accent `#4ba9e1`, online `#22c55e`. Only `base/surface/elevated/border/text` shift. Geometry never changes per theme.

| ID | Label | base | surface | elevated | border | textPrimary | textMuted |
|---|---|---|---|---|---|---|---|
| `framer` (default) | Framer | `#090909` | `#141414` | `#1c1c1c` | `#262626` | `#ffffff` | `#999999` |
| `midnight` | Midnight | `#0a0e16` | `#121826` | `#182032` | `#26334a` | `#ffffff` | `#999999` |
| `graphite` | Graphite | `#0d0f12` | `#171a1f` | `#1f2329` | `#2b3038` | `#ffffff` | `#999999` |
| `espresso` | Espresso | `#130e0a` | `#201811` | `#2a2016` | `#3a2c1c` | `#ffffff` | `#999999` |
| `pine` | Pine | `#0a160f` | `#12261a` | `#183222` | `#264a33` | `#ffffff` | `#999999` |
| `plum` | Plum | `#100a14` | `#1c1222` | `#26182e` | `#3a2646` | `#ffffff` | `#999999` |
| `porcelain` | Porcelain | `#faf9f7` | `#ffffff` | `#ffffff` | `#e6e3dd` | `#161615` | `#7a7770` |
| `linen` | Linen | `#f8f4ec` | `#fffdf8` | `#ffffff` | `#e9dfc9` | `#20180f` | `#8a7c66` |
| `mist` | Mist | `#f5f7fa` | `#ffffff` | `#ffffff` | `#dde3ea` | `#12161c` | `#707a87` |
| `sage` | Sage | `#f5f7f1` | `#fbfdf7` | `#ffffff` | `#dfe6d4` | `#151d12` | `#79826c` |

Chat tokens per theme: dark → `bubbleSent:#ffffff fg:#090909, bubbleReceived:#1c1c1c-ish surface`; light → `bubbleSent:ink fg:canvas, bubbleReceived:warm gray`. `unreadBadge` always = accent. `onAccent` = `#090909` on dark.

**Custom studio overlay (optional):** `{accent, tint}` over any preset. Tint washes only surface family (`base/surface/elevated/border/scrollbar/bubbleReceived`) at 20% (dark) / 14% (light), preserving lightness. Accent replaces `accent/unreadBadge/accentSoft`. Never wash text tokens.

## 4. Typography

Fonts: Display `Outfit` (Google, `next/font`), Body `Inter`, Mono system/JetBrains Mono. Load: `Inter var(--font-inter) + Outfit var(--font-outfit)`.

| Token | Size | W | LH | Tracking | Use |
|---|---|---|---|---|---|
| display-xxl | 110px / `clamp(3rem,9vw,6.875rem)` | 500 | 0.85 | -5.5px (-5%) | hero |
| display-xl | 85px | 500 | 0.95 | -4.25px | section opener |
| display-lg | 62px / `clamp(2.5rem,6vw,3.875rem)` | 500 | 1.0 | -3.1px | sub-opener |
| display-md | 32px / `clamp(1.75rem,4vw,2rem)` | 500 | 1.13 | -1px | card titles |
| headline | 22px | 700 | 1.2 | -0.8px | tier/FAQ titles |
| subhead | 24px | 400 | 1.3 | -0.01px | lead inside spotlight cards |
| body-lg | 18px | 400 | 1.3 | -0.18px | hero subhead |
| body | 15px | 400 | 1.3 | -0.15px | default |
| body-sm | 14px | 500 | 1.4 | -0.14px | dense rows |
| caption | 13px | 500 | 1.2 | -0.13px | eyebrows, footer, meta |
| micro | 12px | 400 | 1.2 | -0.12px | disclaimers |
| button | 14px | 500 | 1.0 | -0.14px | pills |

CSS helpers:

```css
.framer-display-xl{font-family:Outfit,Inter,sans-serif;font-size:clamp(3rem,9vw,6.875rem);line-height:.85;letter-spacing:-5.5px;font-weight:500}
.framer-display-lg{font-family:Outfit,Inter,sans-serif;font-size:clamp(2.5rem,6vw,3.875rem);line-height:1;letter-spacing:-3.1px;font-weight:500}
.framer-display-md{font-family:Outfit,Inter,sans-serif;font-size:clamp(1.75rem,4vw,2rem);line-height:1.13;letter-spacing:-1px;font-weight:500}
```

Scale display down on mobile (110→62→32) but keep the percentage-negative tracking.

## 5. Spacing / Radius / Elevation / Layout

- Spacing (5px base): `4/8/12/15/20/24/30/40`, section `96px`. Card padding `20–24px`, spotlight `30–32px`, pill button `10px 15px`, input `10px 14px`.
- Radius: `xs 4px` chips, `sm 6px` badges, `md 10px` inputs, `lg 15px` thumbs, `xl 20px` cards, `xxl 30px` spotlight, `pill 9999px` CTAs, `full 9999px` circles.
- Elevation: `sm 0 1px 2px rgba(0,0,0,.4)`; `md inset 0 1px 0 rgba(255,255,255,.06), 0 10px 30px -10px rgba(0,0,0,.6)`; `lg inset 0 1px 0 rgba(255,255,255,.08), 0 20px 50px -12px rgba(0,0,0,.7)`.
- Layout: max width `1200px`, gutters scale to `30px` desktop. Card grids 2-up desktop → 1-up <810px. Nav collapses <810px to hamburger; primary pill stays visible.

## 6. Components (exact specs)

### Buttons
- Primary (`.kivo-cta`): `bg #fff, color #000, radius 9999px, pad 10px 15px (min-h 44px touch), font 14/500`. Hover `brightness(.94)`, active `scale(.97)`.
- Secondary: `bg surface-1, color ink, pill`. Translucent (on busy bg): `bg surface-2, pill`.
- Icon circular: `40px circle (44px touch), bg surface-1`.
- Focus: `box-shadow:0 0 0 2px var(--canvas),0 0 0 4px var(--accent-blue)` — never default outline.

### Inputs
`bg surface-1, color ink, radius 10px, pad 10px 14px, border hairline`. Focus keeps surface; ring = `rgba(0,153,255,.15) 0 0 0 1px`. Placeholder = ink-muted.

### Cards
`.framer-card{background:var(--surface-1);border:1px solid var(--hairline);border-radius:20px;box-shadow:var(--shadow-md)}`
Featured: `bg surface-2`. Template thumb: `radius 15px, pad 12px`.

### Spotlight cards (signature)
```css
.spotlight{border-radius:30px;border:1px solid rgba(255,255,255,.08);color:#fff;position:relative;overflow:hidden}
.spotlight-violet{background:radial-gradient(120% 120% at 0% 0%,#6a4cf5,transparent 60%),linear-gradient(135deg,#5a3df0,#7d4df0)}
.spotlight-magenta{background:radial-gradient(120% 120% at 100% 0%,#d44df0,transparent 60%),linear-gradient(135deg,#c23de0,#e06fc0)}
.spotlight-orange{background:radial-gradient(120% 120% at 0% 100%,#ff7a3d,transparent 60%),linear-gradient(135deg,#ff6a2d,#ff9a4d)}
```
Type inside = subhead 24px. Keep gradient direction across breakpoints.

### Nav / Footer
- Top nav: `bg canvas, h 56px`; floating variant `.kivo-nav-pill{background:rgba(20,20,20,.72);border:1px solid rgba(255,255,255,.08);border-radius:9999px;backdrop-filter:blur(10px);box-shadow:md}`. Links muted → white + `rgba(255,255,255,.06)` hover pill.
- Footer: `bg canvas, color ink-muted, caption 13px, pad 64px 32px`.

### Modal / Empty / Toggle / Tabs / Tooltip / Accordion
- Modal: overlay `bg-black/50 backdrop-blur-[2px]`; sheet `bg surface-1 border hairline rounded-t-2xl mobile / rounded-2xl sm+, max-w-sm, shadow-2xl`. Destructive confirm = `bg destructive pill white text`.
- Empty: centered col; icon `size-12 rounded-2xl border surface muted icon`; title 14 semibold ink; hint 13 muted max-w-260px; action accent pill `12px semibold`.
- Toggle (`.t-toggle`): `40x24 pill, border hairline, bg surface-2`; on = `bg accent-blue border accent-blue`; thumb `18px white circle`, travel 16px with overshoot; focus ring blue.
- Tabs (`.t-tabs`): container `bg surface-1 border hairline radius 48px pad 4px`; tab `h 38px pad 4px 18px muted`; active white; sliding pill `bg surface-2 radius 48px shadow-md`.
- Tooltip (`.t-tt`): `bg surface-2 border hairline radius 12px pad .6rem .8rem, font 13px/500, shadow-lg`.
- Accordion (`.t-acc`): `bg surface-1 border hairline radius 16px`; head `pad 1.25rem 1.5rem font 16/700`; panel grid-rows `0fr→1fr 350ms`; chevron rotates 180°.

### Chat bubbles + wallpapers
- Bubble: `max-width 78%, radius 18px, pad 10px 14px, font 14px/1.45`. Mine = sent token bg + sent-fg text; other = received bg + hairline border. Tails: mine `border-top-right 6px`, other `border-top-left 6px`. Deleted: transparent + dashed border + muted italic.
- Styles on container `kivo-bubbles-*`: `pill → radius 24px pad 11px 18px`; `squared → 5px`; `outline → mine transparent + 1.5px accent border`.
- Wallpapers (`wallpaperCss`): `dots` 22px radial, `grid` 26px lines, `diagonal` 45° 13px, `bubbles` dual-scale radial, `wash` accent gradient — all painted with `color-mix(in srgb, var(--text-primary) 7%, transparent)` / `var(--accent)` so they re-tint per theme. `none` = flat.

## 7. Motion — transitions-dev (full `t-*` library)

Tokens:

```css
:root{
  --duration-micro:80ms; --duration-quick:150ms; --duration-fast:250ms;
  --duration-medium:350ms; --duration-slow:400ms; --duration-very-slow:500ms;
  --ease-smooth-out:cubic-bezier(.22,1,.36,1); --ease-bounce:cubic-bezier(.34,1.36,.64,1);
  --stagger-dur:500ms; --stagger-distance:12px; --stagger-stagger:40ms; --stagger-blur:3px;
}
```

| Class | Use | Key behavior |
|---|---|---|
| `t-stagger` + `--stagger-index` | hero/list reveals | `translateY(12px)+blur(3px)→none`, 500ms, delay `index*40ms` |
| `t-dropdown` / `.is-open` / `.is-closing` | menus | scale `.97→1`, 250ms open / 150ms close |
| `t-modal` / `.is-open` | dialogs | scale `.96→1`, 250ms; backdrop fade 250ms |
| `t-tabs` + `t-tab` + `t-tabs-pill` | segmented control | pill slides 250ms |
| `t-badge` / `t-badge-dot` / `t-badge-pop` | notif dots | slide-in 260ms, pop 500ms bounce |
| `t-panel-in` | panel enter | `translateY(12px)+blur(2px)`, 400ms |
| `t-item-in` / `t-msg-in` | list/chat rows | `translateY(8px)+blur(2px)`, 400ms; chat rows add `content-visibility:auto` |
| `t-text-swap` | swapping text | `translateY(4px)+blur(2px)`, 150ms |
| `t-toggle` | switches | thumb travel 16px, 220ms, overshoot keyframes |
| `t-shimmer` / `t-skel` | skeletons | white sweep `90deg transparent→rgba(255,255,255,.12)→transparent`, 2.6s/1.8s loop |
| `t-digit-group` | number pops | `translateY(40%) scale(.8)+blur`, bounce |
| `t-tilt` + `t-tilt-glare` | card hover | 3D tilt 250ms + radial glare follows `--glare-x/y` |
| `t-tt` | tooltip | `translate(-50%,4px) scale(.96)→none`, 150ms |
| `t-acc` | accordion | grid-rows animation 350ms |
| `t-check` | animated checkbox | `1.5rem radius .55rem`, tick draws via dashoffset 400ms; checked = blue fill white tick |
| `t-avatar-group .t-avatar` | stacked avatars | `2.75rem circle, border 2px canvas, overlap -.6rem` |
| `t-learn` | link with arrow | gap `.4→.7rem` on hover, blue 600w |
| `t-icon-swap` | icon crossfade | slide ±40% + fade 150ms via `data-swapped` |
| `t-panel-slide` | side reveal | `translateX(-24px)+blur`, 400ms |
| `blob-1/2/3` | hero ambience | float `translateY(-18px) scale(1.04)`, 6/8/7s |
| `spotlight::before` | tile breathe | white radial drift 14s rotate, opacity on hover |
| `avatar-frame-rainbow/gold` | cosmetic rings | conic-gradient ring spin 6s |

Global rule:

```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
  html{scroll-behavior:auto}
}
```

Use `motion` (Framer Motion) for JS-driven staggers/panels; CSS `t-*` for the rest.

## 8. Icons / Media / Responsive / A11y

- Icons: `lucide-react` only, stroke `1.6–2`, `size-4` in buttons, `44px` min touch target (40px circle → 44px touch).
- Avatars: circles, stacked with canvas ring. Plus effects: `kivo-pfx-avatar` pulsing accent ring 2.6s; `kivo-pfx-name` animated accent→pink→amber gradient text 9s.
- Images: never crop mockups; keep aspect. Spotlight corners stay 30px at all viewports.
- Breakpoints: desktop 1199px, tablet 810px (grids 4→2-up, nav→hamburger), mobile comparison table → accordion.
- A11y: `:focus-visible` blue double-ring everywhere; `aria-selected` on tabs, `aria-checked` on checks, `role=dialog aria-modal` on modals; `prefers-reduced-motion` disables ALL motion; contrast carried by ink/muted only.

## 9. Do / Don't

Do: anchor on canvas/white; negative-track display; blue only for links/focus/selection; 1–2 spotlights per page; pill CTAs; Inter variants on; surface-lift for hierarchy; `content-visibility:auto` for long lists.
Don't: light marketing page; mid-gray text outside muted; blue fills; squared CTAs; reduced tracking "for a11y" (reduce size instead); section-wide gradients; second chromatic accent; hardcoded hex; new radius/color tokens.

## 10. Quick start for a new project

1. Paste the `:root` + body CSS from §2.3 and motion tokens from §7.
2. Load `Inter` + `Outfit`, set body features string.
3. Map Tailwind theme: `canvas/surface-1/surface-2/hairline/ink/muted/accent-blue` (+ shadcn mapping).
4. Build primitives in order: button pill → input → card → nav pill → modal/empty → tabs/toggle → spotlight → chat bubble.
5. Copy `t-*` classes needed; add the reduced-motion block verbatim.
6. Run visual check: hero display tracking, one spotlight card, white pill CTA, charcoal card, blue link/focus only.
