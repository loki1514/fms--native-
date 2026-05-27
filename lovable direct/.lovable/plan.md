

The user wants a comprehensive design spec / prompt they can use to recreate this exact UI in React Native. This is a documentation/research task — no code changes. I'll read the key files to extract precise values (colors, gradients, fonts, spacing, animations, image sources) and present it as a structured design brief they can hand to another AI or implement themselves.

Let me gather what I already have from context (most is visible) and present a complete spec.

---

# End-to-End Design Spec: "Properties" Dashboard

A complete reference to recreate the current web build in React Native. Every value below is taken from the live codebase.

## 1. Design Philosophy

**Name:** *Atmospheric Glass* — cinematic night-sky ambience with Apple-grade restraint.

**Principles:**
- Deep, desaturated night palette as the canvas; content floats on it as frosted glass.
- Type is tight, display-weight, negatively tracked (Apple HIG feel).
- Motion is slow, eased, never bouncy. Hovers nudge ~2px and scale 1.005–1.05 max.
- Color is communicated through gradient washes, not flat fills. Status uses glowing dots, never colored backgrounds.
- Every surface has: blur + saturation + 1px inner highlight + soft outer shadow.

## 2. Color System (OKLCH → convert to hex/RGB for RN)

| Token | Value | Use |
|---|---|---|
| Background base | `oklch(0.14 0.03 260)` ≈ `#0F1424` | App bg |
| Foreground | `oklch(0.98 0.005 250)` ≈ `#F9FAFC` | Primary text |
| Muted text | `white / 50–70%` | Captions, codes |
| Success (Optimal) | `oklch(0.78 0.20 145)` ≈ `#56D88E` | Status dot |
| Warning (Watch) | `oklch(0.82 0.18 75)` ≈ `#E8C45A` | Status dot |
| Critical | `oklch(0.66 0.24 22)` ≈ `#E5563A` | Status dot |
| Accent (info) | `oklch(0.70 0.15 235)` ≈ `#4FA3E8` | Focus ring |

**Background gradient (radial, fixed):**
```
radial-gradient(120% 80% at 50% 0%,
  #1F2A47 0%,    /* oklch(0.32 0.08 250) */
  #1A2238 45%,   /* oklch(0.18 0.05 260) */
  #0B0F1C 100%   /* oklch(0.10 0.03 265) */
)
```
In RN: use `expo-linear-gradient` with `RadialGradient` from `react-native-svg` for the radial, or fake with two stacked linear gradients + a centered blurred ellipse.

**Aurora overlay (additive, drifts 24s):**
- Top-right blob: `radial-gradient(60% 40% at 80% 10%, oklch(0.55 0.18 280 / 35%), transparent 60%)` (violet)
- Top-left blob: `radial-gradient(50% 35% at 10% 20%, oklch(0.55 0.18 220 / 30%), transparent 60%)` (cyan)

## 3. Typography

- **Family:** SF Pro Display (system on iOS; on Android use Inter as fallback or bundle SF).
- **Display rule:** `fontWeight: 700`, `letterSpacing: -0.04em` (≈ `-1.6` at 40px in RN), `-webkit-font-smoothing: antialiased`.
- **Body:** same family, weight 400–500, `letterSpacing: -0.01em`.
- **Sizes used:**
  - "Properties" H1: 40–48px / weight 700 / tracking -4%
  - Card property name: 24px / 700 / tracking -4%
  - Big ticket count: 48px / 300 (light) / leading none
  - Code (PROP-001): 12px / 500 / white 70%
  - Status label: 12px / 500
  - H/L stats: 12px / 500 / tabular-nums

## 4. Layout (mobile-first, max-width 672px / `max-w-2xl`)

```
Padding: 20px horizontal, 24–40px top
Gap between cards: 12px (gap-3)
Card height: 128px (h-32)
Card radius: 24px (rounded-3xl)
Search radius: 16px (rounded-2xl)
Menu button: 44×44 round
```

## 5. Property Card (the hero element)

**Structure (z-stacked):**
1. Background `<Image>` — full bleed, `resizeMode: cover`, scale 1 → 1.05 on hover (700ms ease)
2. Gradient overlay: `linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3), rgba(0,0,0,0.4))`
3. Content layer (padding 20px), flex column, space-between

**Top row:** Name + code (left), giant ticket number (right, 48px light)
**Bottom row:** Status dot + label (left), `H:465  L:0` (right, tabular-nums, gap 12px)

**Status dot:**
```
width: 6, height: 6, borderRadius: 3
backgroundColor: <statusColor>
shadowColor: <statusColor>, shadowRadius: 8, shadowOpacity: 1  // the glow
```

**Hover/press in RN:** use `Pressable` with `Animated.spring` on `scale` (1 → 0.98 on press) and a separate `Animated.timing` on the inner Image scale (1 → 1.05, 700ms easing `Easing.bezier(0.22, 1, 0.36, 1)`).

## 6. Glass Effect (search bar, menu button, sidebar)

CSS:
```
background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
backdrop-filter: blur(24px) saturate(160%);
border: 1px solid rgba(255,255,255,0.12);
box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10);
```

**RN equivalent:**
- Use `expo-blur` `<BlurView intensity={40} tint="dark">`
- Wrap in a `View` with the gradient (`expo-linear-gradient`) + 1px white/12% border + the outer shadow.
- The `inset 0 1px 0 rgba(255,255,255,0.10)` highlight: add a 1px tall absolutely-positioned `View` at top with `backgroundColor: 'rgba(255,255,255,0.10)'`.

## 7. Search Bar

- Height ~48px, radius 16, `bg: rgba(255,255,255,0.10)`, blur 24, border `rgba(255,255,255,0.10)`
- Left icon (Search, 16px, white 50%), input padding-left 44
- Right icon (Mic, 16px, white 60%)
- Placeholder color `rgba(255,255,255,0.50)`
- Focus ring: 2px `rgba(255,255,255,0.20)` (use `onFocus` to bump border)

## 8. Imagery

Five Unsplash building photos (1200w, q=80). Pre-fetch and cache in RN with `expo-image`:
- SS Plaza: `photo-1486406146926-c627a92ad1ab`
- Rabale: `photo-1577415124269-fc1140a69e91`
- ETPL: `photo-1531973576160-7125cd663d86`
- Head Office: `photo-1497366216548-37526070297c`
- Bajaj Kolkata: `photo-1486325212027-8081e485255e`

URL format: `https://images.unsplash.com/{id}?auto=format&fit=crop&w=1200&q=80`

## 9. Motion / Animations

| Element | Animation | Timing |
|---|---|---|
| Card hover | scale image to 1.05 | 700ms, ease `[0.22, 1, 0.36, 1]` |
| Card press | scale wrapper to 0.995 | spring |
| Menu button hover | bg 10% → 20% | 200ms |
| Aurora drift | translateX ±3%, translateY ±1% | 24s ease-in-out, infinite alternate |
| Stars twinkle | opacity 0.2 ↔ 1 | 3s ease-in-out, infinite |
| Status dot (if pulsing) | opacity 1↔0.5, scale 1↔0.85 | 1.6s ease-in-out, infinite |

In RN: use `react-native-reanimated` v3 with `withRepeat`, `withTiming`, `Easing.bezier(0.22, 1, 0.36, 1)`.

## 10. Star Field (background ambience)

~110 absolutely-positioned 2px white circles, random x/y, each with `twinkle` animation at randomized delay (0–3s) and duration (2–4s). In RN: render once in a `<Canvas>` (Skia) for perf, or 60–80 `Animated.View`s with staggered loops.

## 11. Order of Build (so you don't fight layout later)

1. Install: `expo-linear-gradient`, `expo-blur`, `expo-image`, `react-native-reanimated`, `react-native-svg`.
2. Build `AtmosphereBackground` (radial bg + aurora blobs + star field) as an absolute-fill component.
3. Add SF Pro Display font via `expo-font` (or rely on iOS system).
4. Build `GlassSurface` wrapper component (BlurView + gradient + border + inner highlight).
5. Build `PropertyCard` with the Image + gradient overlay + content rows + animated press.
6. Compose the screen: header row (menu + title) → search → FlatList of cards.

## 12. Gotchas for RN

- `backdrop-filter` doesn't exist — `expo-blur`'s `BlurView` is the only option, and on Android it's weaker; consider a slightly more opaque fallback (`rgba(255,255,255,0.14)`).
- OKLCH isn't supported — convert every color to hex/rgba up front (values above).
- Radial gradients aren't native — use `react-native-svg`'s `RadialGradient` or layer two `LinearGradient`s.
- Use `expo-image` (not `Image`) for the cards — much better caching and the `transition` prop gives you a free fade-in.
- `letterSpacing` in RN is in absolute units (pt), not em — multiply em × fontSize.
- Avoid heavy blur on Android low-end devices; gate behind `Platform.OS === 'ios'` if FPS drops.

This is everything driving the look. Hand this whole block to your RN agent (or use it as a checklist) and you'll get a 1:1 port.

