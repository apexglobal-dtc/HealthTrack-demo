// Client-side PDF text extraction with pdf.js from cdnjs.
// Loading the worker as a plain script makes pdf.js run it on the main thread,
// which works inside sandboxed frames (Claude Artifacts) as well as normal pages.
const BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = () => reject(new Error('Could not load the PDF reader'));
    document.head.appendChild(s);
  });
}

let ready = null;
async function pdfjs() {
  if (!ready) ready = (async () => {
    await loadScript(BASE + 'pdf.min.js');
    await loadScript(BASE + 'pdf.worker.min.js');
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';
    return lib;
  })();
  return ready;
}

export async function pdfToText(file) {
  const lib = await pdfjs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, 15); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // group text items into lines by their y position
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], s: it.str });
    }
    const lines = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join('   '));
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n');
}
