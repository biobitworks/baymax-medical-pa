/** Export only the public landing page and its explicitly listed demo assets. */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/build-project-site.mjs <output-directory>');
const output = resolve(process.argv[2]);
if (output === root || output === resolve(root, 'site')) throw new Error('Choose a separate export directory');
await mkdir(resolve(output, 'assets'), { recursive: true });
let html = await readFile(resolve(root, 'site/index.html'), 'utf8');
html = html.replaceAll('../public/icons/', 'assets/').replaceAll('../public/mascot/', 'assets/').replaceAll('../docs/media/', 'assets/').replaceAll('media/', 'assets/');
await writeFile(resolve(output, 'index.html'), html);
await writeFile(resolve(output, '.nojekyll'), '');
for (const name of ['care-plan', 'doctor-email', 'prescription-preview', 'mobile-care']) {
  await copyFile(resolve(root, `docs/media/${name}.gif`), resolve(output, `assets/${name}.gif`));
  await copyFile(resolve(root, `site/media/${name}.webp`), resolve(output, `assets/${name}.webp`));
}
for (const [source, name] of [['public/icons/icon-192.png', 'icon-192.png'], ['public/mascot/idle.webp', 'idle.webp']]) {
  await copyFile(resolve(root, source), resolve(output, `assets/${name}`));
}
console.log(`Project site exported to ${output}`);
