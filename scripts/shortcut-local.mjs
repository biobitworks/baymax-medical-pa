import { networkInterfaces } from 'node:os';

const interfaces = networkInterfaces();
const addresses = Object.entries(interfaces).flatMap(([name, entries]) => (entries ?? [])
  .filter(entry => entry.family === 'IPv4' && !entry.internal && !name.startsWith('utun'))
  .map(entry => ({ name, address: entry.address })));
if (!addresses.length) {
  console.error('Connect this Mac to Wi-Fi, then try again.');
  process.exitCode = 1;
} else {
  const preferred = addresses.find(entry => entry.name === 'en0') ?? addresses[0];
  const origin = `http://${preferred.address}:5173`;
  console.log(`Open Baymax on this Mac: ${origin}`);
  console.log(`Start the backend: APP_ORIGIN=${origin} npm run agent:dev`);
  console.log('Start the frontend in another terminal: npm run dev');
  console.log(`Shortcut sync address: ${origin}/health/apple/import`);
  console.log('Use the same Wi-Fi on the iPhone. A changing network address means updating the Shortcut address.');
}
