#!/usr/bin/env node
// scripts/checkLevelDesign.js - check a level design without a browser, with
// the same code SANDBOX TEST runs (scripts/lib/gameContext.js): the level
// map read from the art's layer names, the item catalog, then the design
// converted if it is a draft and validated against the map.
//
//   node scripts/checkLevelDesign.js <target> [--svg <file>] [--items <file>] [--layers] [--names]
//                                    [--matrix] [--brief <file>] [--json] [--verbose]
//   node scripts/checkLevelDesign.js --all [--matrix] [--json]
//
// <target> is one of:
//   a SANDBOX TEST key from config/debug/sandbox.json   design-9-conditions
//   a level name, for config/levels/<level>/            theStreets
//   a design file                                       config/debug/designs/8-crews.json
// A level or file that a sandbox test names is checked with that test's art,
// item catalog and interiors. Anything else needs --svg, unless it sits at
// config/levels/<level>/level-design.json beside assets/levels/<level>/.
//
//   --svg <file>    the level art (an SVG under assets/levels/<level>/)
//   --items <file>  the item catalog to read item names from
//   --layers        list the art's mapped layers by kind, with paths, and each
//                   interior's
//   --names         list every layer name in the art (what animate-layers and
//                   a pool's render can name)
//   --matrix        what every action does in every state, and the gaps: an
//                   action that led here and does nothing now, a state with no
//                   way on, a state never entered, a step that never fires
//                   (scripts/lib/levelMatrix.js)
//   --brief <file>  the level brief whose "Nothing on purpose" says which gaps
//                   are meant. By default config/levels/<level>/level-brief.md
//                   beside a level-design.json, or <design>.brief.md
//   --all           every sandbox test, one status line each
//   --vocabulary [file]  print every name the engine reads (the level-design
//                   skill's references/vocabulary.md), or write it to file
//   --json          the result as JSON
//   --verbose       also print what the game's code wrote to the console
//
// The status line reads as the sandbox's does:
//   <label>: ready, 9 regions, 1 warning, items: 0 warnings, design: 0 warnings
//
// Names only: what is where, and whether it can be reached, is not measured
// here. SANDBOX TEST checks that by playing.
//
// Exit codes: 0 no design warnings and, with --matrix, no gaps the brief does
// not mean; 1 otherwise (with --all, only a version 1 design's warnings
// count: a draft's are its conversion notes); 2 the check could not run.

'use strict';

const fs   = require('fs');
const path = require('path');
const { resolve, check, sandboxTests, openGaps } = require('./lib/levelCheck');
const { matrixMarkdown } = require('./lib/levelMatrix');
const { vocabularyMarkdown } = require('./lib/vocabularyDoc');
const { createGameContext } = require('./lib/gameContext');

const ROOT = path.resolve(__dirname, '..');

function usage(problem) {
    if (problem) console.error(`checkLevelDesign: ${problem}\n`);
    console.error([
        'usage: node scripts/checkLevelDesign.js <target> [--svg <file>] [--items <file>] [--layers] [--names]',
        '                                        [--matrix] [--brief <file>] [--json] [--verbose]',
        '       node scripts/checkLevelDesign.js --all [--matrix] [--json]',
        '       node scripts/checkLevelDesign.js --vocabulary [file]',
        '',
        '<target>: a SANDBOX TEST key (design-9-conditions), a level name (theStreets),',
        '          or a design file (config/debug/designs/8-crews.json)',
    ].join('\n'));
    process.exit(2);
}

function parseArgs(argv) {
    const opts = { target: null, svg: null, items: null, brief: null, layers: false, names: false, matrix: false,
                   all: false, json: false, verbose: false, vocabulary: false, vocabularyFile: null };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const value = () => {
            if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) usage(`${arg} needs a value`);
            return argv[++i];
        };
        if (arg === '--svg') opts.svg = value();
        else if (arg === '--items') opts.items = value();
        else if (arg === '--layers') opts.layers = true;
        else if (arg === '--names') opts.names = true;
        else if (arg === '--matrix') opts.matrix = true;
        else if (arg === '--brief') opts.brief = value();
        else if (arg === '--all') opts.all = true;
        else if (arg === '--vocabulary') {
            opts.vocabulary = true;
            if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.vocabularyFile = argv[++i];
        }
        else if (arg === '--json') opts.json = true;
        else if (arg === '--verbose') opts.verbose = true;
        else if (arg === '--help' || arg === '-h') usage();
        else if (arg.startsWith('--')) usage(`unknown option ${arg}`);
        else if (opts.target) usage(`one target at a time (got "${opts.target}" and "${arg}")`);
        else opts.target = arg;
    }
    if (opts.vocabulary) {
        if (opts.target || opts.all) usage('--vocabulary takes no target');
        return opts;
    }
    if (!opts.all && !opts.target) usage('name what to check');
    if (opts.all && opts.target) usage('--all checks every sandbox test; leave out the target');
    return opts;
}

// ── Printing ──────────────────────────────────────────────────────────────────
function printList(title, lines) {
    if (!lines.length) return;
    console.log(`  ${title}`);
    for (const line of lines) console.log(`    ${line}`);
}

function printArt(art, indent = '') {
    const rows = [
        ['doors', art.doors.map(d => `${d.path}  ${d.type}${d.into ? `, into ${d.into}` : ''}${d.restricted ? ' (locked at first)' : ''}`)],
        ['enterables', art.enterables.map(e => `${e.id}${e.requires.length ? `  opens on ${e.requires.join(', ')}` : e.restricted ? '  opens when the design says' : ''}`)],
        ['objects', art.objects.map(o => `${o.id}${o.holds.length ? `  holds ${o.holds.join(', ')}` : '  (an interact area)'}`)],
        ['breakables', art.breakables.map(b => `${b.path}  break:${b.name}`)],
        ['items', art.items.map(i => `${i.path}  take:${i.name}`)],
        ['trigger areas', art.events.map(e => `${e.path}  event:${e.name}`)],
        ['animations', art.animations.map(a => `${a.id}  ${a.frames} frame${a.frames === 1 ? '' : 's'}`)],
        ['holes', art.holes],
        ['reserved', art.reserved.map(r => `${r.id}  (${r.label}-, planned)`)],
        ['moved by the design', art.moved.map(l => `${l.paths.join(', ')}  animate:${l.name}`)],
    ];
    for (const [title, lines] of rows) {
        if (!lines.length) continue;
        console.log(`${indent}  ${title}`);
        for (const line of lines) console.log(`${indent}    ${line}`);
    }
    console.log(`${indent}  ${art.nameCount} layer names in all${art.names ? ':' : ' (--names lists them)'}`);
    if (art.names) console.log(`${indent}    ${art.names.join(' ')}`);
}

function printResult(r, opts) {
    console.log(r.status);
    console.log(`  art     ${r.level}${r.scene}`);
    if (r.design) console.log(`  design  ${r.design}${r.test ? `  (SANDBOX TEST "${r.test}")` : ''}`);
    if (r.items) console.log(`  items   ${r.items}`);
    printList('map warnings', r.mapWarnings);
    printList('item warnings', r.itemWarnings);
    printList(r.migrated ? 'design warnings (a draft: converted, with these notes)' : 'design warnings', r.designWarnings);
    if (r.art && r.showLayers) {
        console.log('');
        console.log(`Layers in ${r.level}${r.scene}`);
        printArt(r.art);
        for (const inside of r.interiors || []) {
            console.log('');
            if (!inside.path) {
                console.log(`Inside ${inside.name}: no interior found`);
                continue;
            }
            console.log(`Inside ${inside.name} (${inside.path}): ${inside.regions} regions, ${inside.warnings.length} warning${inside.warnings.length === 1 ? '' : 's'}`);
            for (const text of inside.warnings) console.log(`    ${text}`);
            printArt(inside.art);
        }
    }
    if (r.matrix) {
        console.log('');
        const gaps = r.matrix.gaps.length;
        console.log(`## What every action does${r.brief ? ` (brief: ${r.brief})`
            : ` (no brief at ${r.briefLookedFor || 'the design\'s place'}, so nothing is marked as meant; --brief <file> names one)`}`);
        console.log(`${gaps} gap${gaps === 1 ? '' : 's'}, ${r.matrix.notes.filter(n => n.onPurpose).length} meant, from ${r.matrix.nodes} combinations of state and facts`);
        console.log('');
        process.stdout.write(matrixMarkdown(r.matrix));
    }
    if (opts.verbose && r.notes.length) printList('the game said', r.notes.map(n => `[${n.level}] ${n.text}`));
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.vocabulary) {
        const text = vocabularyMarkdown(createGameContext({ root: ROOT }));
        if (!opts.vocabularyFile) {
            process.stdout.write(text);
        } else {
            fs.writeFileSync(path.resolve(ROOT, opts.vocabularyFile), text, 'utf8');
            console.log(`wrote ${opts.vocabularyFile}`);
        }
        process.exit(0);
    }
    if (opts.all) {
        const tests = sandboxTests();
        const results = Object.entries(tests).map(([key, test]) => {
            const spec = resolve(key, { ...opts, items: null });
            try {
                return check(spec, opts);
            } catch (e) {
                return { ...spec, status: `${spec.label}: could not check: ${e.message}`, failed: true, designWarnings: [] };
            }
        });
        if (opts.json) console.log(JSON.stringify(results.map(({ notes, prepared, ...r }) => r), null, 2));
        else {
            for (const r of results) {
                const gaps = r.matrix ? `, gaps: ${openGaps(r)}${r.brief ? '' : ' (no brief)'}` : '';
                console.log(`${r.test}: ${r.status}${gaps}`);
            }
        }
        const bad = results.some(r => r.failed || (r.designWarnings.length && !r.migrated) || openGaps(r));
        if (!opts.json) console.log('\nChecked by layer name only; SANDBOX TEST checks where things are.');
        process.exit(results.some(r => r.failed) ? 2 : bad ? 1 : 0);
    }

    let spec;
    try {
        spec = resolve(opts.target, opts);
    } catch (e) {
        usage(e.message);
    }
    let result;
    try {
        result = check(spec, opts);
    } catch (e) {
        console.error(`checkLevelDesign: could not check ${opts.target}: ${e.stack || e.message}`);
        process.exit(2);
    }
    if (opts.json) {
        const { notes, ...rest } = result;
        console.log(JSON.stringify(opts.verbose ? result : rest, null, 2));
    } else {
        printResult(result, opts);
        console.log('\nChecked by layer name only; SANDBOX TEST checks where things are.');
    }
    process.exit(result.designWarnings.length || openGaps(result) ? 1 : 0);
}

main();
