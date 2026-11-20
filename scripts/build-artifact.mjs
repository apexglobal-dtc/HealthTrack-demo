// Builds the single-file browser demo (published as a Claude Artifact).
// Output: dist/healthtrack-demo.html  (no doctype/html/head/body: the Artifact host adds them)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => path.join(root, p);
mkdirSync(r('dist'), { recursive: true });

const res = await build({
  entryPoints: [r('src/platform/artifact/entry.jsx')],
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2020',
  jsx: 'automatic', loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(r('src/ui/styles.css'), 'utf8');
const asset = (f, mime) => `data:${mime};base64,${readFileSync(r('public/assets/' + f)).toString('base64')}`;
const assets = { 'genie.png': asset('genie.png', 'image/png'), 'logo.png': asset('logo.png', 'image/png'), 'splash.jpg': asset('splash.jpg', 'image/jpeg') };

const html = `<title>Health Track Demo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="ht-root"></div>
<script>window.__HT_ASSETS__=${JSON.stringify(assets)};</script>
<script>${js}</script>
`;
writeFileSync(r('dist/healthtrack-demo.html'), html);
console.log(`dist/healthtrack-demo.html  ${(html.length / 1024).toFixed(0)} KB`);
