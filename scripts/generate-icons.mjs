import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
// A simple vector face matches the existing Baymax mascot and brand mark.
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="0" fill="#e8eee3"/>
<ellipse cx="256" cy="274" rx="155" ry="109" fill="#fff" stroke="#d3ddce" stroke-width="5"/>
<path d="M199 267H313" stroke="#263c32" stroke-width="9"/>
<circle cx="196" cy="267" r="19" fill="#263c32"/><circle cx="316" cy="267" r="19" fill="#263c32"/>
</svg>`);
await mkdir('public/icons', { recursive: true });
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['maskable-512', 512], ['apple-touch-icon', 180]]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}.png`);
}
