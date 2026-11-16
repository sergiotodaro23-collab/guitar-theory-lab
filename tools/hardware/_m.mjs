import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const out = process.argv[2];
const server = spawn('npx', ['vite', 'preview', '--port', '4187', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
try {
  const b = await chromium.launch();
  for (const [w, h] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.goto('http://localhost:4187/', { waitUntil: 'networkidle' });
    if (w === 1440) { await p.getByTestId('rail-toggle').click(); await p.waitForTimeout(300); }
    await p.screenshot({ path: `${out}/closed-${w}x${h}.png` });
    await p.getByTestId('device-mixer').click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/extended-${w}x${h}.png` });
    await p.getByTestId('mixer-mode-compact').click();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/compact-${w}x${h}.png` });
    await p.close();
  }
  await b.close();
} finally { server.kill(); }
