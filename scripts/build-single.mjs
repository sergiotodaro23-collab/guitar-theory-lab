// Packs dist/ into one self-contained HTML file: scripts, styles and fonts inline.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const assets = join(dist, 'assets');
const files = readdirSync(assets);
// The entry script is the one index.html loads; other .js files are chunks loaded on demand (the NAM engine) and stay out.
const index = readFileSync(join(dist, 'index.html'), 'utf8');
const entry = /<script[^>]*src="[^"]*assets\/([^"]+\.js)"/.exec(index)?.[1] ?? files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
const js = readFileSync(join(assets, entry), 'utf8');
let css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8');

css = css.replace(/,?\s*url\([^)]*\.woff\)\s*format\(["']woff["']\)/g, '');
css = css.replace(/url\(([^)]*?([^/)]+\.woff2))\)/g, (_, __, name) => {
  const data = readFileSync(join(assets, name)).toString('base64');
  return `url(data:font/woff2;base64,${data})`;
});

const html = readFileSync(join(dist, 'index.html'), 'utf8')
  .replace(/<script[^>]*src=[^>]*><\/script>/, '')
  .replace(/<link[^>]*stylesheet[^>]*>/, () => `<style>${css}</style>`)
  .replace('</body>', () => `<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script></body>`);

writeFileSync(join(dist, 'guitar-theory-lab.html'), html);
console.log(`dist/guitar-theory-lab.html ${(html.length / 1024).toFixed(0)} KB`);
