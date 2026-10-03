// Static server for tests: serves the repo with the headers from vercel.json
// applied, so CSP / Trusted Types / COEP behave as they will in production.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=path.resolve(new URL('..', import.meta.url).pathname), PORT=+process.argv[2]||3200;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain','.json':'application/json'};
http.createServer((q,r)=>{
  const vj=JSON.parse(fs.readFileSync(ROOT+'/vercel.json','utf8'));
  let p=decodeURIComponent(new URL(q.url,'http://x').pathname);
  const hdr={};
  for(const h of vj.headers){ const re=new RegExp('^'+h.source.replace(/\(\.\*\)/g,'.*')+'$'); if(re.test(p)) for(const kv of h.headers) hdr[kv.key]=kv.value; }
  let f=path.join(ROOT,p==='/'?'index.html':p);
  if(!f.startsWith(ROOT+path.sep)&&f!==ROOT||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404,hdr); return r.end('nf'); }
  hdr['Content-Type']=hdr['Content-Type']||types[path.extname(f)]||'application/octet-stream';
  r.writeHead(200,hdr); fs.createReadStream(f).pipe(r);
}).listen(PORT);
