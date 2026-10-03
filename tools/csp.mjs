#!/usr/bin/env node
// Recomputes the Content-Security-Policy hashes for the inline <script> and
// <style> in index.html and writes the policy to:
//   • the <meta http-equiv="Content-Security-Policy"> in index.html
//   • the Content-Security-Policy header in vercel.json (adds frame-ancestors)
// Run after ANY edit to index.html:   node tools/csp.mjs
// `node tools/csp.mjs --check` exits 1 if the files are out of date (for CI).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url);
const htmlPath = new URL('index.html', root), vercelPath = new URL('vercel.json', root);
let html = readFileSync(htmlPath, 'utf8');

const one = (re, what) => {
  const all = [...html.matchAll(re)];
  if (all.length !== 1) throw new Error(`expected exactly one inline ${what}, found ${all.length}`);
  return all[0][1];
};
const sha = s => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const script = one(/<script>([\s\S]*?)<\/script>/g, '<script>');
const style  = one(/<style>([\s\S]*?)<\/style>/g, '<style>');

export const policy = (header) => [
  "default-src 'none'",
  `script-src ${sha(script)}`,
  `style-src ${sha(style)}`,
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types default",
  ...(header ? ["frame-ancestors 'none'", "upgrade-insecure-requests"] : []),
].join('; ');

const meta = policy(false), head = policy(true);
const newHtml = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/, `$1${meta}$2`);
const vj = JSON.parse(readFileSync(vercelPath, 'utf8'));
const all = vj.headers.find(h => h.source === '/(.*)');
const cur = all.headers.find(h => h.key === 'Content-Security-Policy');
if (cur) cur.value = head; else all.headers.unshift({ key: 'Content-Security-Policy', value: head });
const newVj = JSON.stringify(vj, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const stale = newHtml !== html || newVj !== readFileSync(vercelPath, 'utf8');
  console.log(stale ? 'CSP hashes are STALE — run: node tools/csp.mjs' : 'CSP hashes up to date');
  process.exit(stale ? 1 : 0);
}
writeFileSync(htmlPath, newHtml);
writeFileSync(vercelPath, newVj);
console.log('script', sha(script), '\nstyle ', sha(style));
