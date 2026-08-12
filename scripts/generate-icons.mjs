/**
 * Generates every raster asset Expo needs from the single authored SVG mark.
 *
 * Run with: npm run icons
 *
 * Keeping this as a script rather than committing hand-exported PNGs means the
 * brand can be changed in one file and every size stays consistent.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const assets = join(root, 'assets');

const BG = '#0A0A0C';
const ACCENT = '#C9F24D';

const source = await readFile(join(assets, 'brand', 'logo.svg'), 'utf8');

/** The mark with every fill forced to a single flat colour. */
function monochrome(svg, color) {
  return svg
    .replace(/fill="url\(#top\)"/g, `fill="${color}"`)
    .replace(/fill="#C9F24D"/g, `fill="${color}"`)
    .replace(/opacity="[\d.]+"/g, '');
}

/** Renders an SVG string to a PNG at `size`, optionally over a solid colour. */
async function render(svg, size, { background } = {}) {
  const pipeline = sharp(Buffer.from(svg), { density: 384 }).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (background) {
    return pipeline.flatten({ background }).png().toBuffer();
  }
  return pipeline.png().toBuffer();
}

/** A plain solid-colour square, for the adaptive icon background layer. */
async function solid(size, color) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: color },
  })
    .png()
    .toBuffer();
}

const targets = [
  // Main app icon — opaque, iOS masks the corners itself.
  { file: 'icon.png', buffer: () => render(source, 1024, { background: BG }) },

  // Android adaptive icon. The foreground must be transparent and keep its
  // content inside the centre 66% safe zone; the launcher crops the rest.
  { file: 'android-icon-foreground.png', buffer: () => render(source, 1024) },
  { file: 'android-icon-background.png', buffer: () => solid(1024, BG) },
  { file: 'android-icon-monochrome.png', buffer: () => render(monochrome(source, '#FFFFFF'), 1024) },

  // Splash mark — transparent, drawn over the configured background colour.
  { file: 'splash-icon.png', buffer: () => render(source, 1024) },

  // Web favicon. Opaque so it reads against light and dark browser chrome.
  { file: 'favicon.png', buffer: () => render(source, 96, { background: BG }) },
];

await mkdir(assets, { recursive: true });

for (const target of targets) {
  const buffer = await target.buffer();
  await writeFile(join(assets, target.file), buffer);
  console.log(`${target.file.padEnd(32)} ${(buffer.length / 1024).toFixed(1)} KB`);
}

console.log(`\nGenerated ${targets.length} assets from assets/brand/logo.svg (accent ${ACCENT}).`);
