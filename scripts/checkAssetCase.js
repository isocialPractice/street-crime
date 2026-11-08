#!/usr/bin/env node
// scripts/checkAssetCase.js - find file paths whose letter case does not match
// the file on disk.
//
// Windows and macOS find "badBar.svg" when asked for "BadBar.svg"; GitHub Pages,
// like any Linux server, does not. A path that works locally can therefore 404
// on the published site. Run from the repository root:
//
//   node scripts/checkAssetCase.js
//
// What it checks, against the real names in each folder:
//   - src and href in index.html
//   - every quoted assets/, config/ or js/ path in the game's JavaScript
//   - every such path in config/**/*.json (sandbox levels, scenes, interiors, designs)
//   - each enemy's art: ENEMY_DEFS "img" names, and every suffix in
//     config/enemy-assets.json resolved the way the loader does (literal file,
//     then the numbered run from _0), plus the player reactions enemies apply
//   - files whose case git has recorded differently from the disk, which a
//     case-only rename on Windows leaves behind and which deploy under the old name
//
// A path that names no file at all is not reported: the loaders probe for files
// that may not exist (frame runs, camelCase interiors), and say so themselves.
// Exits 1 when a mismatch is found.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const problems = [];
const checked = new Set();

// The real name of every entry in a folder, keyed by its lower-case name.
const folderCache = new Map();
function realNames(dir) {
    if (!folderCache.has(dir)) {
        const names = new Map();
        try {
            for (const name of fs.readdirSync(dir || '.')) names.set(name.toLowerCase(), name);
        } catch (e) { /* no such folder */ }
        folderCache.set(dir, names);
    }
    return folderCache.get(dir);
}

// checkPath - "exact" when every part of the path matches the disk's case,
// "case" (and a problem recorded) when a part differs only in case, "missing"
// when it names nothing.
function checkPath(p, where) {
    const parts = p.replace(/\\/g, '/').replace(/^\.\//, '').split('/').filter(Boolean);
    let dir = '';
    let fixed = [];
    let mismatch = false;
    for (const part of parts) {
        const real = realNames(dir).get(part.toLowerCase());
        if (!real) return 'missing';
        if (real !== part) mismatch = true;
        fixed.push(real);
        dir = dir ? `${dir}/${real}` : real;
    }
    if (mismatch) {
        const key = `${p}|${where}`;
        if (!checked.has(key)) {
            checked.add(key);
            problems.push(`${where}: "${p}" is "${fixed.join('/')}" on disk`);
        }
        return 'case';
    }
    return 'exact';
}

function walk(dir, test, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full, test, out);
        else if (test(full)) out.push(full);
    }
    return out;
}

const PATH_RE = /['"`]((?:assets|config|js)\/[^'"`$\s]+?\.(?:svg|json|js|css|png))['"`]/g;

// index.html
const index = fs.readFileSync('index.html', 'utf8');
for (const m of index.matchAll(/(?:src|href)="([^"#?:]+)"/g)) checkPath(m[1], 'index.html');

// The game's JavaScript
const scripts = ['game.js', 'assets.js', ...walk('js', f => f.endsWith('.js'))];
for (const file of scripts) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(PATH_RE)) checkPath(m[1], file);
}

// config/**/*.json: paths, and a sandbox test's level + scene + interiors + design
for (const file of walk('config', f => f.endsWith('.json'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(PATH_RE)) checkPath(m[1], file);
    let data;
    try { data = JSON.parse(text); } catch (e) { continue; }
    for (const [key, test] of Object.entries(data.tests || {})) {
        if (typeof test.level !== 'string') continue;
        const level = test.level.endsWith('/') ? test.level : `${test.level}/`;
        if (test.scene) checkPath(level + test.scene, `${file} tests.${key}.scene`);
        for (const interior of Object.values(test.enterables || {})) {
            if (typeof interior === 'string') checkPath(level + interior, `${file} tests.${key}.enterables`);
        }
    }
}

// Enemy art, resolved as js/sprites/enemies.js does
const ENEMY_DIR = 'assets/characters/enemy';
const enemyDefs = fs.readFileSync('js/entities/enemy.js', 'utf8');
for (const m of enemyDefs.matchAll(/img:\s*'([^']+)'/g)) {
    const img = m[1];
    const names = [...realNames(ENEMY_DIR).values()];
    const exact = names.some(n => n === `${img}.svg` || n.startsWith(`${img}_`));
    const loose = names.find(n => n.toLowerCase() === `${img}.svg`.toLowerCase()
                                 || n.toLowerCase().startsWith(`${img}_`.toLowerCase()));
    if (!exact && loose) problems.push(`js/entities/enemy.js: img "${img}" has files named like "${loose}"`);
}

const assetConfig = JSON.parse(fs.readFileSync('config/enemy-assets.json', 'utf8'));
const enemyFile = base => `${ENEMY_DIR}/${base}.svg`;
const checkSuffix = (enemy, suffix, animations, where) => {
    const base = suffix ? `${enemy}_${suffix}` : enemy;
    const literal = checkPath(enemyFile(base), where);
    if (literal !== 'missing') return;
    if (suffix && animations && Object.prototype.hasOwnProperty.call(animations, suffix)) return;
    checkPath(enemyFile(`${base}_0`), where);
};
const enemyEntries = { ...Object.fromEntries((assetConfig.wipEnemies || []).map(n => [n, {}])), ...assetConfig.enemies };
for (const [enemy, entry] of Object.entries(enemyEntries)) {
    const animations = { ...(assetConfig.defaults?.animations || {}), ...(entry.animations || {}) };
    for (const [state, anim] of Object.entries(animations)) {
        const where = `config/enemy-assets.json ${enemy}.${state}`;
        for (const suffix of anim.suffixes || []) checkSuffix(enemy, suffix, animations, where);
        for (const file of anim.files || []) checkPath(enemyFile(file), where);
    }
    for (const [key, value] of Object.entries(entry)) {
        const applied = /^apply([A-Za-z]+)$/.exec(key);
        if (applied && typeof value === 'string') {
            const base = `Player_${applied[1]}_${value}`;
            if (checkPath(enemyFile(base), `config/enemy-assets.json ${enemy}.${key}`) === 'missing') {
                checkPath(enemyFile(`${base}_0`), `config/enemy-assets.json ${enemy}.${key}`);
            }
        }
    }
}

// Names git recorded in a different case from the disk
try {
    const tracked = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
        .split('\n').filter(Boolean);
    for (const file of tracked) {
        if (checkPath(file, 'git index') === 'missing') continue;
    }
} catch (e) {
    console.warn('git is not available; skipped comparing git\'s names with the disk');
}

if (problems.length) {
    console.error(`${problems.length} path(s) differ from the disk only in case:`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
}
console.log('every checked path matches the case of its file on disk');
