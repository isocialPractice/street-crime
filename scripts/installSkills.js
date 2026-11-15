#!/usr/bin/env node
// scripts/installSkills.js - copy this repository's agent skills from skills/
// (the copy to edit and commit) to where each agent reads project skills:
//
//   claude    .claude/skills/<skill>/    Claude Code
//   copilot   .github/skills/<skill>/    GitHub Copilot (VS Code, Visual Studio, Copilot CLI)
//   codex     .agents/skills/<skill>/    Codex (VS Code's Copilot reads it too)
//
//   npm run skills -- <agent> [<agent> ...]   install for those agents ("all" for every one)
//   npm run skills                            install for the agents this checkout already has
//                                             (.claude/, .github/skills/ or .agents/); with none,
//                                             say how to choose
//   npm run skills:check [-- <agent> ...]     say which copies are missing, current, out of
//                                             date or edited; exit 1 for out of date or edited
//   npm run skills -- --remove <agent> ...    remove the copies this script installed
//
//   --force    replace or remove a copy that was edited after it was installed, or that this
//              script did not install
//   --dry-run  say what would happen, and change nothing
//
// Without npm: node scripts/installSkills.js <same arguments>.
//
// Each installed copy holds .installed.json: where it came from, when, and a
// hash of every file. That is how --check tells "the source changed" from
// "someone edited the copy", and why a folder of the same name that this
// script did not make is never replaced or removed without --force. Copies,
// not links: a link on Windows needs Developer Mode or an administrator.
//
// Every folder under skills/ that holds a SKILL.md is installed, so a second
// skill needs no change here.

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = 'skills';
const STAMP = '.installed.json';
const AGENTS = {
    claude:  { dir: '.claude/skills',  tool: 'Claude Code',    present: '.claude' },
    copilot: { dir: '.github/skills',  tool: 'GitHub Copilot', present: '.github/skills' },
    codex:   { dir: '.agents/skills',  tool: 'Codex',          present: '.agents' },
};

const rel = file => path.relative(ROOT, file).split(path.sep).join('/');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

function usage(problem) {
    if (problem) console.error(`installSkills: ${problem}\n`);
    console.error([
        'usage: npm run skills -- <agent> [<agent> ...]     install (agents: claude, copilot, codex, all)',
        '       npm run skills:check [-- <agent> ...]       which copies are missing, current, out of date or edited',
        '       npm run skills -- --remove <agent> ...      remove copies this script installed',
        '       options: --force, --dry-run',
        '',
        'Where each agent reads project skills:',
        ...Object.entries(AGENTS).map(([name, a]) => `  ${name.padEnd(8)} ${a.dir}/<skill>/   ${a.tool}`),
        '',
        `The skills to install are the folders under ${SOURCE}/ with a SKILL.md.`,
    ].join('\n'));
    process.exit(2);
}

function parseArgs(argv) {
    const opts = { agents: [], check: false, remove: false, force: false, dryRun: false };
    for (const arg of argv) {
        if (arg === '--check') opts.check = true;
        else if (arg === '--remove') opts.remove = true;
        else if (arg === '--force') opts.force = true;
        else if (arg === '--dry-run') opts.dryRun = true;
        else if (arg === '--help' || arg === '-h') usage();
        else if (arg.startsWith('-')) usage(`unknown option ${arg}`);
        else if (arg === 'all') opts.agents.push(...Object.keys(AGENTS));
        else if (AGENTS[arg]) opts.agents.push(arg);
        else usage(`"${arg}" is not an agent; use ${Object.keys(AGENTS).join(', ')} or all`);
    }
    if (opts.check && opts.remove) usage('--check and --remove do not go together');
    opts.agents = [...new Set(opts.agents)];
    return opts;
}

// Every file under dir, as repository-style paths relative to it, sorted.
function listFiles(dir) {
    const out = [];
    const walk = (at, prefix) => {
        for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
            const full = path.join(at, entry.name);
            const name = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(full, name);
            else if (entry.isFile() && name !== STAMP) out.push(name);
        }
    };
    if (fs.existsSync(dir)) walk(dir, '');
    return out.sort();
}

// A folder's files with their hashes, and one hash for all of them.
function fingerprint(dir) {
    const files = listFiles(dir).map(name => ({ path: name, sha256: sha(fs.readFileSync(path.join(dir, name))) }));
    return { files, sha256: sha(files.map(f => `${f.path}:${f.sha256}`).join('\n')) };
}

function skills() {
    const base = path.join(ROOT, SOURCE);
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'SKILL.md')))
        .map(entry => entry.name)
        .sort();
}

function readStamp(dir) {
    try {
        return JSON.parse(fs.readFileSync(path.join(dir, STAMP), 'utf8'));
    } catch (e) {
        return null;
    }
}

// What an installed copy is now: missing, foreign (not ours), edited (its
// files no longer match its stamp), stale (the source changed since), or
// current.
function standing(skill, agent) {
    const source = path.join(ROOT, SOURCE, skill);
    const target = path.join(ROOT, AGENTS[agent].dir, skill);
    if (!fs.existsSync(target)) return { state: 'missing', source, target };
    const stamp = readStamp(target);
    if (!stamp) return { state: 'foreign', source, target };
    const now = fingerprint(target);
    if (now.sha256 !== stamp.sha256) return { state: 'edited', source, target, stamp };
    if (fingerprint(source).sha256 !== stamp.sha256) return { state: 'stale', source, target, stamp };
    return { state: 'current', source, target, stamp };
}

const SAID = {
    missing: 'not installed',
    foreign: 'there, but not installed by this script (no .installed.json)',
    edited:  'edited since it was installed; move the changes into skills/ and reinstall, or use --force',
    stale:   'out of date: the source has changed since it was installed',
    current: 'current',
};

function copyTree(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of listFiles(from)) {
        const dest = path.join(to, ...name.split('/'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(from, ...name.split('/')), dest);
    }
}

function install(skill, agent, opts) {
    const s = standing(skill, agent);
    const where = rel(s.target);
    if ((s.state === 'foreign' || s.state === 'edited') && !opts.force) {
        console.log(`${agent.padEnd(8)} ${where}: not replaced: ${SAID[s.state]}`);
        return false;
    }
    if (s.state === 'current' && !opts.force) {
        console.log(`${agent.padEnd(8)} ${where}: already current`);
        return true;
    }
    const verb = s.state === 'missing' ? 'installed' : 'replaced';
    if (opts.dryRun) {
        console.log(`${agent.padEnd(8)} ${where}: would be ${verb}`);
        return true;
    }
    if (s.state !== 'missing') fs.rmSync(s.target, { recursive: true, force: true });
    copyTree(s.source, s.target);
    const print = fingerprint(s.target);
    fs.writeFileSync(path.join(s.target, STAMP), `${JSON.stringify({
        skill, agent, tool: AGENTS[agent].tool,
        source: `${SOURCE}/${skill}`, installed: new Date().toISOString(),
        by: 'scripts/installSkills.js', note: `generated: edit ${SOURCE}/${skill}/ and run npm run skills`,
        sha256: print.sha256, files: print.files,
    }, null, 2)}\n`);
    console.log(`${agent.padEnd(8)} ${where}: ${verb} (${print.files.length} files)`);
    return true;
}

function remove(skill, agent, opts) {
    const s = standing(skill, agent);
    const where = rel(s.target);
    if (s.state === 'missing') {
        console.log(`${agent.padEnd(8)} ${where}: not there`);
        return true;
    }
    if ((s.state === 'foreign' || s.state === 'edited') && !opts.force) {
        console.log(`${agent.padEnd(8)} ${where}: not removed: ${SAID[s.state]}`);
        return false;
    }
    if (opts.dryRun) {
        console.log(`${agent.padEnd(8)} ${where}: would be removed`);
        return true;
    }
    fs.rmSync(s.target, { recursive: true, force: true });
    console.log(`${agent.padEnd(8)} ${where}: removed`);
    return true;
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    const names = skills();
    if (!names.length) {
        console.error(`installSkills: no skills under ${SOURCE}/ (each is a folder with a SKILL.md)`);
        process.exit(2);
    }

    if (opts.check) {
        const agents = opts.agents.length ? opts.agents : Object.keys(AGENTS);
        let bad = false;
        for (const skill of names) {
            for (const agent of agents) {
                const s = standing(skill, agent);
                if (s.state === 'stale' || s.state === 'edited') bad = true;
                const at = s.stamp ? new Date(s.stamp.installed) : null;
                const day = at && !Number.isNaN(at.getTime())
                    ? `${at.getFullYear()}.${String(at.getMonth() + 1).padStart(2, '0')}.${String(at.getDate()).padStart(2, '0')}` : null;
                const when = day ? ` (installed ${day})` : '';
                console.log(`${agent.padEnd(8)} ${rel(s.target)}: ${SAID[s.state]}${s.state === 'current' ? when : ''}`);
            }
        }
        if (bad) console.log('\nnpm run skills -- <agent> brings a copy up to date.');
        process.exit(bad ? 1 : 0);
    }

    let agents = opts.agents;
    if (!agents.length) {
        agents = Object.keys(AGENTS).filter(agent => fs.existsSync(path.join(ROOT, AGENTS[agent].present)));
        if (!agents.length || opts.remove) usage(opts.remove ? 'name the agents to remove from'
            : 'this checkout has no agent folder yet (.claude/, .github/skills/ or .agents/); name the agents');
        console.log(`Agents found: ${agents.join(', ')}`);
    }
    let ok = true;
    for (const skill of names) {
        for (const agent of agents) ok = (opts.remove ? remove(skill, agent, opts) : install(skill, agent, opts)) && ok;
    }
    process.exit(ok ? 0 : 1);
}

main();
