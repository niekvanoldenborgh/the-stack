# Design imports

Drop exported Figma frames here as images. This is the zero-quota route into a
design: it costs no Figma MCP calls, and the images can be read for layout *and*
sampled for exact colour values.

Image files in this folder are gitignored — only this README is tracked.

## Exporting from Figma (better than an OS screenshot)

An OS screenshot is capped at your display resolution and picks up the Figma
canvas background. Exporting gives clean, isolated frames at any size.

1. Select the frames you want. Shift-click for several, or click a page's
   background then <kbd>Ctrl</kbd>+<kbd>A</kbd> to take everything on it.
2. In the right sidebar, scroll to **Export** and hit **+**.
3. Set **2x** and **PNG**. 2x is the sweet spot — 3x mostly adds file size.
4. **Export**. Figma names each file after its frame, which is exactly what is
   wanted here: `Progress Tracking.png` is self-describing, `Screenshot
   2026-08-06 at 21.14.png` is not.
5. Drop the files in this folder.

If you would rather screenshot: zoom so one screen fills the window, and capture
the frame only, not the whole app.

## What happens with them

**Layout, composition, hierarchy, spacing rhythm** — read directly off the
image.

**Exact colours** — sampled from the pixels rather than eyeballed:

```bash
npm run colors -- design-imports
```

That prints a ranked palette per image with each colour's share of the frame and
a guess at its role, e.g.

```
med-home.png
  hex        share  role
  #FFFFFF    50.0%  surface / background
  #C8D8FF    27.6%  surface / background
  #2060FF     6.8%  accent
```

Flags: `--top 12` for how many colours, `--min 0.15` for the share threshold
below which a colour is treated as noise.

## What images cannot give

Font *names*, exact pixel spacing tokens, auto-layout rules, and component
structure. Those need the MCP (`get_design_context`) or a look in the file. In
practice this rarely matters — this app has its own type system and spacing
scale, and the point of a reference is composition, not literal reproduction.
