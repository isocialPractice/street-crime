// scripts/lib/skillChecks.js - checks that the level-design skill
// (skills/level-design/) says only what the engine does, run by
// scripts/checkLevelDesignVocab.js:
//
//   - SKILL.md names itself level-design and has a description agents can
//     read (at most 1024 characters, as the SKILL.md format allows);
//   - references/vocabulary.md is what the engine's tables write now;
//   - every trigger kind, condition source and layer prefix the skill's pages
//     name in backticks exists, as do the repository files they name, and
//     every option they give scripts/checkLevelDesign.js;
//   - every design in references/patterns.md, and the starter design in
//     templates/, is checked against a level made up for it
//     (scripts/lib/patternFixture.js) by the code SANDBOX TEST runs: no
//     warnings, and no gaps in the action matrix but the ones it says are
//     meant;
//   - the brief and sandbox test templates have what the skill fills in.
//
// A JSON block in patterns.md must say which it is, on the line before it:
//   <!-- checked -->
//   <!-- checked; meant: `exit:corner-shop` in `ambush`: why -->   (more after ";")
//   <!-- not checked: why -->

'use strict';

const fs   = require('fs');
const path = require('path');
const { ROOT, check } = require('./levelCheck');
const { createGameContext } = require('./gameContext');
const { vocabularyMarkdown, VOCABULARY_FILE, VOCABULARY_COMMAND } = require('./vocabularyDoc');
const { PATTERN_FIXTURE } = require('./patternFixture');

const SKILL_DIR = 'skills/level-design';
const CHECK_OPTIONS = ['--svg', '--items', '--layers', '--names', '--matrix', '--brief', '--all', '--vocabulary', '--json', '--verbose'];
const BRIEF_SECTIONS = ['The level', 'Places', 'People', 'Things', 'What happens', 'Again and again', 'Nothing on purpose', 'Test', 'Built as'];

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const exists = rel => fs.existsSync(path.join(ROOT, rel));

// The JSON blocks of a Markdown page, with the heading they sit under and
// the marker line before them.
function jsonBlocks(text) {
    const lines = text.split('\n');
    const blocks = [];
    let heading = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^#{2,4}\s/.test(line)) heading = line.replace(/^#+\s*/, '');
        if (line.trim() !== '```json') continue;
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '```') j++;
        let k = i - 1;
        while (k >= 0 && !lines[k].trim()) k--;
        blocks.push({ heading, line: i + 1, marker: k >= 0 ? lines[k].trim() : '', text: lines.slice(i + 1, j).join('\n') });
        i = j;
    }
    return blocks;
}

// checkFixtureDesign - one design against the made-up level: its warnings,
// and the matrix's gaps that meant (brief bullets) does not cover.
function checkFixtureDesign(text, meant = [], name = 'snippet') {
    const designPath = `${PATTERN_FIXTURE.level}${name}.json`;
    const briefText = meant.length ? `## Nothing on purpose\n\n${meant.map(m => `- ${m}`).join('\n')}\n` : null;
    const result = check({
        label: name, test: null, design: designPath, level: PATTERN_FIXTURE.level, scene: PATTERN_FIXTURE.scene,
        items: PATTERN_FIXTURE.items, enterables: {}, inventory: [],
    }, { matrix: true }, { files: { ...PATTERN_FIXTURE.files, [designPath]: text }, briefText });
    return {
        warnings: result.designWarnings,
        gaps: result.matrix ? result.matrix.gaps.map(g => g.text) : [],
        meant: result.matrix ? result.matrix.notes.filter(n => n.onPurpose).length : 0,
        status: result.status,
    };
}

// The names a page gives in backticks that the engine must have.
function checkNames(rel, text, vocab, rules) {
    const problems = [];
    const kinds = new Set([...vocab.triggers.map, ...vocab.triggers.director, ...vocab.triggers.condition,
                           ...vocab.triggers.player, ...vocab.conditions.count, ...vocab.conditions.flag]);
    const labels = new Set(rules.labels);
    // Inline code only: fenced blocks are checked as designs or commands.
    const prose = text.replace(/^```[\s\S]*?^```/gm, '');
    for (const [, token] of prose.matchAll(/`([^`\n]+)`/g)) {
        const name = token.trim();
        const trigger = /^([a-z]+):([A-Za-z0-9][\w-]*)$/.exec(name);
        if (trigger && !kinds.has(trigger[1])) problems.push(`${rel}: \`${name}\` has kind "${trigger[1]}", which no trigger or condition has`);
        // A layer name: a prefix, then a lower-case name, a <placeholder>, or
        // nothing (the prefix itself). ALL_CAPS words are code constants.
        const layer = /^[A-Z][A-Z0-9_]*$/.test(name) ? null : /^([A-Z]{3,})[-_](.*)$/.exec(name);
        if (layer && !labels.has(layer[1])) problems.push(`${rel}: \`${name}\` starts with ${layer[1]}-, which is not a layer prefix`);
        if (layer && layer[1] === 'REQUIRE' && layer[2] && !layer[2].startsWith('<')) {
            const type = /^([a-z]+)[-_]/.exec(layer[2])?.[1];
            if (!rules.requireTypes.includes(type)) problems.push(`${rel}: \`${name}\`: REQUIRE- types are ${rules.requireTypes.join(', ')}`);
        }
        if (layer && layer[1] === 'ENTER' && layer[2] && !layer[2].startsWith('<')) {
            const type = /^([a-z]+)/.exec(layer[2])?.[1];
            if (!rules.enterTypes.includes(type)) problems.push(`${rel}: \`${name}\`: ENTER- types are ${rules.enterTypes.join(', ')}`);
        }
        const file = /^((?:js|config|docs|scripts|assets|skills)\/[^\s<>*]+?)(?::\d+)?$/.exec(name);
        if (file && !/[<>]/.test(file[1]) && !exists(file[1])) problems.push(`${rel}: names ${file[1]}, which does not exist`);
    }
    // Commands: every option given to the check script is one it has.
    for (const [, args] of text.matchAll(/node scripts\/checkLevelDesign\.js([^\n`]*)/g)) {
        for (const [option] of args.matchAll(/--[a-z]+/g)) {
            if (!CHECK_OPTIONS.includes(option)) problems.push(`${rel}: scripts/checkLevelDesign.js has no ${option}`);
        }
    }
    for (const [, script] of text.matchAll(/node (scripts\/[\w/.-]+\.js)/g)) {
        if (!exists(script)) problems.push(`${rel}: names ${script}, which does not exist`);
    }
    for (const [, name] of text.matchAll(/npm run ([\w:-]+)/g)) {
        const pkg = exists('package.json') ? JSON.parse(read('package.json')) : {};
        if (!pkg.scripts || !pkg.scripts[name]) problems.push(`${rel}: "npm run ${name}" has no script in package.json`);
    }
    return problems;
}

// checkSkill - every check above, as { problems, patterns }: patterns lists
// each checked design with its status.
function checkSkill() {
    const problems = [];
    const patterns = [];
    if (!exists(`${SKILL_DIR}/SKILL.md`)) return { problems: [`${SKILL_DIR}/SKILL.md is missing`], patterns };

    const game = createGameContext({ root: ROOT });
    const vocab = game.run('LEVEL_DESIGN_VOCAB');
    const rules = {
        labels: game.run('LEVEL_MAP_RULES.map(r => r.label)').filter(label => /^[A-Z]+$/.test(label)),
        requireTypes: game.run('LEVEL_MAP_REQUIRE_TYPES'),
        enterTypes: game.run('LEVEL_MAP_ENTER_TYPES'),
    };

    // SKILL.md's front matter.
    const skill = read(`${SKILL_DIR}/SKILL.md`);
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill);
    const field = key => (front ? new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(front[1])?.[1]?.trim().replace(/^'(.*)'$/, '$1') : null);
    if (field('name') !== 'level-design') problems.push(`${SKILL_DIR}/SKILL.md: front matter "name" must be level-design (the folder's name)`);
    const description = field('description');
    if (!description) problems.push(`${SKILL_DIR}/SKILL.md: front matter needs a "description"`);
    else if (description.length > 1024) problems.push(`${SKILL_DIR}/SKILL.md: the description is ${description.length} characters; the format allows 1024`);

    // The generated vocabulary.
    if (!exists(VOCABULARY_FILE) || read(VOCABULARY_FILE) !== vocabularyMarkdown(game)) {
        problems.push(`${VOCABULARY_FILE} is out of date; run ${VOCABULARY_COMMAND}`);
    }

    // Names on every page the skill reads.
    const pages = [`${SKILL_DIR}/SKILL.md`, ...fs.readdirSync(path.join(ROOT, SKILL_DIR, 'references'))
        .filter(name => name.endsWith('.md') && `${SKILL_DIR}/references/${name}` !== VOCABULARY_FILE)
        .map(name => `${SKILL_DIR}/references/${name}`), `${SKILL_DIR}/templates/level-brief.md`].filter(exists);
    for (const page of pages) problems.push(...checkNames(page, read(page), vocab, rules));

    // Every design in patterns.md, against the made-up level.
    const patternsFile = `${SKILL_DIR}/references/patterns.md`;
    if (exists(patternsFile)) {
        for (const block of jsonBlocks(read(patternsFile))) {
            const where = `${patternsFile}:${block.line} (${block.heading})`;
            const marker = /^<!--\s*(checked|not checked)(?::|;)?\s*(.*?)\s*-->$/.exec(block.marker);
            if (!marker) {
                problems.push(`${where}: say <!-- checked --> or <!-- not checked: why --> on the line before the JSON`);
                continue;
            }
            if (marker[1] === 'not checked') {
                if (!marker[2]) problems.push(`${where}: "not checked" needs a reason`);
                continue;
            }
            const meant = /^meant:\s*(.*)$/.exec(marker[2])?.[1].split(/;\s*(?=`)/).map(m => m.trim()).filter(Boolean) || [];
            try {
                JSON.parse(block.text);
            } catch (e) {
                problems.push(`${where}: not valid JSON (${e.message})`);
                continue;
            }
            const result = checkFixtureDesign(block.text, meant, `pattern-${block.line}`);
            patterns.push({ heading: block.heading, line: block.line, ...result });
            for (const warning of result.warnings) problems.push(`${where}: ${warning}`);
            for (const gap of result.gaps) problems.push(`${where}: gap: ${gap}`);
        }
    } else {
        problems.push(`${patternsFile} is missing`);
    }

    // The templates.
    const starter = `${SKILL_DIR}/templates/level-design.json`;
    if (exists(starter)) {
        const result = checkFixtureDesign(read(starter), [], 'starter');
        patterns.push({ heading: 'templates/level-design.json', line: 1, ...result });
        for (const warning of result.warnings) problems.push(`${starter}: ${warning}`);
        for (const gap of result.gaps) problems.push(`${starter}: gap: ${gap}`);
    } else {
        problems.push(`${starter} is missing`);
    }
    const testFile = `${SKILL_DIR}/templates/sandbox-test.json`;
    if (exists(testFile)) {
        try {
            const entries = Object.values(JSON.parse(read(testFile)));
            const known = new Set(['label', 'level', 'scene', ...[...read('js/ui/sandbox.js')
                .match(/const SANDBOX_TEST_DEFAULTS = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s{4}(\w+):/gm)].map(m => m[1])]);
            for (const entry of entries) {
                for (const key of Object.keys(entry)) if (!known.has(key)) problems.push(`${testFile}: "${key}" is not a sandbox test key`);
            }
        } catch (e) {
            problems.push(`${testFile}: not valid JSON (${e.message})`);
        }
    } else {
        problems.push(`${testFile} is missing`);
    }
    const briefFile = `${SKILL_DIR}/templates/level-brief.md`;
    if (exists(briefFile)) {
        const brief = read(briefFile);
        for (const section of BRIEF_SECTIONS) {
            if (!new RegExp(`^## ${section}$`, 'm').test(brief)) problems.push(`${briefFile}: no "## ${section}" section`);
        }
    } else {
        problems.push(`${briefFile} is missing`);
    }
    return { problems, patterns };
}

module.exports = { checkSkill, checkFixtureDesign, checkNames, jsonBlocks, BRIEF_SECTIONS };
