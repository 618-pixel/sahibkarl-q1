#!/usr/bin/env node

import { cp, mkdir, rm, writeFile, readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const FALLBACK_URL = 'https://bczataxbagxkqnqspsje.supabase.co';
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_rpAj9mu7MBmZ5N9fQBT2Ng_3C5pnvDC';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjemF0YXhiYWd4a3FucXNwc2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyMDM1NjEsImV4cCI6MjExMDc3OTU2MX0.PfV21hpw2_P84pMFT9DhvL4AJTN_f6fsCQNgdBj_73A';

const COPY = ['index.html', 'manifest.webmanifest', 'assets'];

const REQUIRED_HTML_REFS = [
  'assets/css/styles.css',
  'assets/js/vendor/supabase.js',
  'assets/js/config.js',
  'assets/js/app.js',
  'assets/img/logo-mark.png',
  'assets/img/favicon-32.png'
];

const log = (msg) => process.stdout.write(`[build] ${msg}\n`);

function projectRefFromUrl(url) {
  const m = String(url || '').match(/^https?:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m ? m[1].toLowerCase() : '';
}

function projectRefFromJwt(key) {
  const parts = String(key || '').split('.');
  if (parts.length !== 3) return '';
  try {
    return String(JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))?.ref || '').toLowerCase();
  } catch {
    return '';
  }
}

const isSecret = (k) => /service_role/i.test(k) || String(k).startsWith('sb_secret_');
const isPublic = (k) => String(k || '').startsWith('sb_publishable_') || String(k || '').startsWith('eyJ');

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

async function collectJs(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor') continue;
      await collectJs(full, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function exportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s+(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  return names;
}

async function verifyModules(errors) {
  const files = await collectJs(path.join(ROOT, 'assets', 'js'));
  const exportsMap = new Map();

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    try {
      await execFileAsync(process.execPath, ['--check', file]);
    } catch (err) {
      const msg = String(err.stderr || err.message || '').split('\n').slice(0, 2).join(' ').trim();
      errors.push(`Sintaksis xətası (${path.relative(ROOT, file)}): ${msg}`);
      continue;
    }
    exportsMap.set(file, exportedNames(source));
  }

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(file), m[2]);
      const available = exportsMap.get(target);
      if (!available) {
        if (!(await exists(target))) errors.push(`Import hədəfi yoxdur: ${path.relative(ROOT, file)} → ${m[2]}`);
        continue;
      }
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (name && !available.has(name)) {
          errors.push(`"${name}" ${path.relative(ROOT, target)} faylında export olunmayıb (${path.relative(ROOT, file)})`);
        }
      }
    }
  }
  log(`${files.length} JS modulu yoxlanıldı`);
}

async function main() {
  log('başladı');

  const envUrl = String(process.env.SUPABASE_URL || '').trim();
  const rawPublishable = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const rawAnon = String(process.env.SUPABASE_ANON_KEY || '').trim();

  for (const [name, value] of [
    ['SUPABASE_PUBLISHABLE_KEY', rawPublishable],
    ['SUPABASE_ANON_KEY', rawAnon]
  ]) {
    if (!value) continue;
    if (isSecret(value)) throw new Error(`${name} gizli açar saxlayır — frontend üçün yalnız publik açar uyğundur.`);
    if (!isPublic(value)) throw new Error(`${name} publik açar formatında deyil.`);
  }

  const url = envUrl || FALLBACK_URL;
  const publishableKey = rawPublishable || (rawAnon ? '' : FALLBACK_PUBLISHABLE_KEY);
  const anonKey = rawAnon;
  const urlRef = projectRefFromUrl(url);

  if (!urlRef) throw new Error(`SUPABASE_URL yanlış formatdadır: "${url}". Gözlənilən: https://<ref>.supabase.co`);

  const anonRef = projectRefFromJwt(anonKey);
  if (anonRef && anonRef !== urlRef) {
    throw new Error(`Açar ref-i "${anonRef}" URL ref-i "${urlRef}" ilə uyğun deyil.`);
  }
  if (!isPublic(publishableKey) && !isPublic(anonKey)) {
    throw new Error('Supabase publik açarı tapılmadı.');
  }
  if (!envUrl || (!rawPublishable && !rawAnon)) {
    log('mühit dəyişənləri yoxdur — repodaki publik açarlar istifadə olunur');
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const rel of COPY) {
    if (!(await exists(path.join(ROOT, rel)))) throw new Error(`Məcburi fayl tapılmadı: ${rel}`);
    await cp(path.join(ROOT, rel), path.join(DIST, rel), { recursive: true });
  }
  log('statik fayllar köçürüldü');

  const config = `window.__RAHATHESAB_ENV__ = {
  SUPABASE_URL: ${JSON.stringify(url)},${publishableKey ? `\n  SUPABASE_PUBLISHABLE_KEY: ${JSON.stringify(publishableKey)},` : ''}${anonKey ? `\n  SUPABASE_ANON_KEY: ${JSON.stringify(anonKey)},` : ''}
  APP_NAME: 'RahatHesab',
  DEFAULT_CURRENCY: 'AZN'
};
`;
  await writeFile(path.join(DIST, 'assets', 'js', 'config.js'), config, 'utf8');
  log(`config.js yaradıldı (ref: ${urlRef})`);

  const errors = [];
  const html = await readFile(path.join(DIST, 'index.html'), 'utf8');

  if (/<script[^>]+src="https?:\/\//i.test(html)) errors.push('index.html xarici script yükləyir.');
  for (const ref of REQUIRED_HTML_REFS) {
    if (!html.includes(ref)) errors.push(`index.html daxilində istinad yoxdur: ${ref}`);
    if (!(await exists(path.join(DIST, ref)))) errors.push(`Build nəticəsində fayl yoxdur: ${ref}`);
  }

  const iconIds = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  const usedIcons = new Set();
  for (const file of await collectJs(path.join(ROOT, 'assets', 'js'))) {
    const source = await readFile(file, 'utf8');
    for (const m of source.matchAll(/icon\('([^']+)'/g)) usedIcons.add(m[1]);
    for (const m of source.matchAll(/iconName:\s*'([^']+)'/g)) usedIcons.add(m[1]);
    for (const m of source.matchAll(/icon:\s*'([^']+)'/g)) usedIcons.add(m[1]);
  }
  for (const id of usedIcons) {
    if (!iconIds.has(id)) errors.push(`İkon sprite-də yoxdur: #${id}`);
  }
  log(`${usedIcons.size} ikon istinadı yoxlanıldı`);

  const manifest = JSON.parse(await readFile(path.join(DIST, 'manifest.webmanifest'), 'utf8'));
  for (const ic of manifest.icons || []) {
    if (!(await exists(path.join(DIST, ic.src)))) errors.push(`Manifest ikonu yoxdur: ${ic.src}`);
  }

  if (!errors.length) await verifyModules(errors);

  if (errors.length) {
    errors.forEach((e) => process.stderr.write(`[build] XƏTA: ${e}\n`));
    throw new Error(`${errors.length} yoxlama uğursuz oldu`);
  }

  log('hazırdır → dist');
}

main().catch((err) => {
  process.stderr.write(`[build] DAYANDI: ${err.message}\n`);
  process.exit(1);
});
