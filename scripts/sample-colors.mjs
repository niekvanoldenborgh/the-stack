/**
 * Extract a palette from an exported design image.
 *
 * Run with: npm run colors -- <file-or-folder> [--top 12] [--min 0.2]
 *
 * A screenshot on its own only gives layout — you still have to eyeball the
 * colours, and eyeballed hexes are how a design gets "nearly" reproduced. This
 * reads the actual pixels, so an exported frame yields exact values.
 *
 * Colours are quantised to a small grid before counting, because anti-aliasing
 * and image compression smear every flat fill across dozens of near-identical
 * values that would otherwise dominate the list as noise.
 */
import { readdir, stat } from 'node:fs/promises';
import { extname, join, basename } from 'node:path';

import sharp from 'sharp';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const topN = Number(args[args.indexOf('--top') + 1]) || 12;
const minShare = Number(args[args.indexOf('--min') + 1]) || 0.15;
const inset = args.includes('--inset') ? Number(args[args.indexOf('--inset') + 1]) || 0.1 : 0;

if (!target) {
  console.error(
    'usage: node scripts/sample-colors.mjs <file-or-folder> [--top 12] [--min 0.15] [--inset 0.1]',
  );
  process.exit(2);
}

/** Round each channel to the nearest step so near-identical shades merge. */
const STEP = 8;
const quantise = (v) => Math.min(255, Math.round(v / STEP) * STEP);
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

/** Relative luminance, for sorting light-to-dark and flagging text colours. */
function luminance(r, g, b) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Rough saturation, used to separate accents from greys. */
function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

async function samplePalette(file) {
  let pipeline = sharp(file);

  // A phone screenshot of a design tool is mostly not the design — there is an
  // OS status bar and an app toolbar above the mockup and a nav bar below, all
  // of which are usually the opposite brightness to the artboard and would
  // otherwise dominate the palette. Trim proportionally, taking more off the
  // top where the chrome is deepest.
  if (inset > 0) {
    const meta = await sharp(file).metadata();
    const left = Math.round(meta.width * inset);
    const top = Math.round(meta.height * inset * 1.3);
    const bottom = Math.round(meta.height * inset * 0.7);
    pipeline = pipeline.extract({
      left,
      top,
      width: meta.width - left * 2,
      height: meta.height - top - bottom,
    });
  }

  // Downsample: a 2340px screenshot has millions of pixels and the palette is
  // identical at 420px, so this is far faster for the same answer.
  const { data, info } = await pipeline
    .resize(420, null, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Map();
  const total = info.width * info.height;

  for (let i = 0; i < data.length; i += info.channels) {
    const r = quantise(data[i]);
    const g = quantise(data[i + 1]);
    const b = quantise(data[i + 2]);
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const r = (key >> 16) & 255;
      const g = (key >> 8) & 255;
      const b = key & 255;
      return {
        hex: hex(r, g, b),
        share: (count / total) * 100,
        luminance: luminance(r, g, b),
        saturation: saturation(r, g, b),
      };
    })
    .filter((c) => c.share >= minShare)
    .sort((a, b) => b.share - a.share)
    .slice(0, topN);
}

async function collect(path) {
  const info = await stat(path);
  if (!info.isDirectory()) return [path];
  const entries = await readdir(path);
  return entries
    .filter((e) => ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(e).toLowerCase()))
    .map((e) => join(path, e));
}

const files = await collect(target);
if (files.length === 0) {
  console.error(`No images found at ${target}`);
  process.exit(1);
}

for (const file of files) {
  const palette = await samplePalette(file);
  console.log(`\n${basename(file)}`);
  console.log('  ' + 'hex'.padEnd(9) + 'share'.padStart(7) + '  role');
  for (const colour of palette) {
    // Surfaces dominate by area; accents are saturated but sparse.
    const role =
      colour.share > 25
        ? 'surface / background'
        : colour.saturation > 0.35
          ? 'accent'
          : colour.luminance > 0.6
            ? 'light text / fill'
            : colour.luminance < 0.15
              ? 'dark text / fill'
              : 'neutral';
    console.log(`  ${colour.hex.padEnd(9)}${colour.share.toFixed(1).padStart(6)}%  ${role}`);
  }
}

console.log(`\n${files.length} image${files.length === 1 ? '' : 's'} sampled.`);
