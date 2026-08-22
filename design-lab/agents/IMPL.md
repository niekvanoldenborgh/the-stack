# Nocturne implementation — rules every screen agent follows

Branch: `thea-nocturne-rebrand`. The palette swap is already committed. You are
porting a **visual redesign** onto an existing, working app.

## The single most important rule

**This is a presentation change, not a behaviour change.** Do not alter dosing
logic, safety evaluation, store shape, persistence, navigation contracts, or what
data a screen reads. If a screen currently computes adherence a certain way, it
still does. You are changing how it *looks*, not what it *says*.

If the redesign seems to require a data change, **stop and leave a `TODO(nocturne):`
comment** explaining what would be needed. Do not invent the data.

## Read before writing

- `src/ui/theme.ts` — the token contract. `useTheme()` → `{ color, mode, shadow(), tone() }`.
- `src/ui/nocturne.tsx` — the new shared components (Tile, CountdownRing, SafetyTile,
  EvidenceBadge, DeltaBadge, PhaseBar). **Reuse these. Do not re-implement them.**
- `src/ui/components.tsx`, `src/ui/primitives.tsx`, `src/ui/charts.tsx` — what already
  exists. Reuse before inventing.
- Your assigned mockup in `design-lab/mockups/` — the visual target.
- `design-lab/mockups/KIT.md` — the design system rationale.
- The current version of your screen — preserve every behaviour in it.

## Non-negotiables (AGENTS.md — product safety rules, not style)

1. **Never hardcode a hex.** Every colour from `useTheme().color`.
2. **`color.severity` is reserved** for danger. Never decorative, never a chart series,
   never a tile accent on a non-warning tile. `color.evidence` is separate.
3. **Charts use ONE hue** against a neutral track. No categorical palette — it has
   failed CVD validation twice on this product.
4. **Status is never colour alone** — always an icon or label too.
5. **Never set `fontWeight` alongside `fontFamily`.** Each weight is its own family;
   setting both makes Android fall back to system font. Use `fonts.medium` etc.
6. **Never put a bare string inside a `<View>`.** RN throws on device; web only warns,
   so this ships silently. Wrap in `<Text>`.
7. **`useNativeDriver: true` silently no-ops on react-native-web.** Follow the pattern
   in `src/ui/motion.tsx` — these animations drive opacity, so getting it wrong ships
   invisible content.
8. **No invented numbers.** This is a harm-reduction dosing app. A plausible-looking
   fabricated dose range is a real defect. If a value is unknown, render the empty
   state or nothing — **fail closed**.
9. **Accessibility**: `accessibilityRole`, `accessibilityLabel`, `accessibilityState`
   where relevant. Minimum 44×44 touch targets. The existing screens are consistently
   wired for this — keep that.
10. **Relative imports only** (`../../src/...`). There is no `@/` alias.

## Both themes

The app has light and dark. Your screen must look deliberate in **both**. Dark expresses
elevation with brightness and a single glowing hero; light has no glow, so express the
same emphasis with deeper, more saturated violet. Never assume a dark background.

## Definition of done

- `npm run typecheck` passes clean
- `npm test` still passes (191 tests)
- `npm run contrast` still passes
- You touched **only** your assigned files

Then print `DONE <screen>` and stop.
