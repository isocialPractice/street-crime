// scripts/lib/vocabularyDoc.js - the level-design skill's vocabulary page,
// skills/level-design/references/vocabulary.md, written from the engine's own
// tables so the skill can never offer a name the engine does not have:
// LEVEL_DESIGN_VOCAB and LEVEL_DESIGN_SPAWN_ALIASES (js/level/level-design.js),
// LEVEL_MAP_RULES, LEVEL_MAP_REQUIRE_TYPES and LEVEL_MAP_ENTER_TYPES
// (js/level/level-map.js). Only what those tables hold goes in; what a
// name means is the job of the skill's other references.

'use strict';

const VOCABULARY_FILE = 'skills/level-design/references/vocabulary.md';
const VOCABULARY_COMMAND = `node scripts/checkLevelDesign.js --vocabulary ${VOCABULARY_FILE}`;

const code = text => `\`${text}\``;
const codes = list => list.map(code).join(', ');

// vocabularyMarkdown - the page, from a game context (createGameContext).
function vocabularyMarkdown(game) {
    const V = game.run('LEVEL_DESIGN_VOCAB');
    const aliases = game.run('LEVEL_DESIGN_SPAWN_ALIASES');
    const rules = game.run('LEVEL_MAP_RULES.map(r => ({ kind: r.kind, label: r.label, restricted: !!r.restricted }))');
    const requireTypes = game.run('LEVEL_MAP_REQUIRE_TYPES');
    const enterTypes = game.run('LEVEL_MAP_ENTER_TYPES');

    const lines = [
        '# Level design vocabulary',
        '',
        'Every name the engine reads, and nothing else: written from `LEVEL_DESIGN_VOCAB`',
        '(`js/level/level-design.js`) and `LEVEL_MAP_RULES` (`js/level/level-map.js`) by',
        '',
        '```sh',
        VOCABULARY_COMMAND,
        '```',
        '',
        'Do not edit it by hand: `node scripts/checkLevelDesignVocab.js` fails while it is out',
        'of date. A name that is not here is either planned (see `patterns.md`) or a typo.',
        '',
        '## Layer names (the art)',
        '',
        'Matched case-sensitively, with `-` or `_` after the prefix. Illustrator\'s `-<n>`',
        'copies (`ENTER-building-2`) match their base name in a layer path.',
        '',
        '| Layer | Kind |',
        '| --- | --- |',
    ];
    for (const rule of rules) {
        const name = rule.label === 'negative-space' ? 'negative-space'
                   : rule.label === 'REQUIRE' ? 'REQUIRE-<type>-<name>'
                   : rule.label === 'ENTER' ? 'ENTER-<type>'
                   : rule.label === 'ANIMATE' ? 'ANIMATE-<asset>'
                   : rule.label === 'INVENTORY' ? 'INVENTORY-<item>'
                   : `${rule.label}-<name>`;
        const kind = rule.kind === 'reserved' ? 'reserved: recognised, warned about, planned'
                   : rule.restricted ? 'enterable, locked at first'
                   : rule.kind === 'hotspot' ? 'door (hotspot)' : rule.kind;
        lines.push(`| ${code(name)} | ${kind} |`);
    }
    lines.push(
        '',
        `\`REQUIRE-<type>\` types: ${codes(requireTypes)}. \`ENTER-<type>\` types: ${codes(enterTypes)}.`,
        '',
        '## Design file keys',
        '',
        '| Object | Keys |',
        '| --- | --- |',
        `| the file | ${codes(V.keys.top)} |`,
        `| a state | ${codes(V.keys.state)} |`,
        `| a state's \`player\` | ${codes(V.keys.player)} |`,
        `| a spawn (a state's \`spawn\` entry) | ${codes(V.keys.spawn)} |`,
        `| a group under \`groups\` > \`<type>\` | ${codes(V.keys.group)} |`,
        `| a \`pool\` entry written as an object | ${codes(V.keys.poolEntry)} |`,
        `| a \`next\` step | ${codes(V.keys.next)} |`,
        `| a \`restricted\` entry | ${codes(V.keys.restricted)} |`,
        `| a case that follows a condition | ${codes(V.keys.caseCondition)} |`,
        `| an \`animate-layers\` move | ${codes(V.keys.animateLayer)} |`,
        `| a state's \`characters\` (reserved: planned) | ${codes(V.keys.characters)} |`,
        '',
        `Also read: ${Object.entries(aliases).map(([from, to]) => `${code(from)} as ${code(to)}`).join(', ')}.`,
        '',
        '## Values',
        '',
        '| Key | Values |',
        '| --- | --- |',
    );
    const valueKeys = {
        svg: '`svg`', playerSpawn: '`player.spawn`', animation: '`player.animation`, a spawn\'s `animation`',
        inventory: '`player.inventory`', health: '`player.health`', spawnType: 'a spawn\'s `type`, a group\'s type',
        pick: '`pick`', order: '`order`', then: '`then`', spawnFrom: '`from` (besides a layer path)',
        restrictedType: 'a `restricted` entry\'s `type`', reset: '`reset` list kinds', resetAll: '`reset` (all of it)',
        ease: 'an `animate-layers` move\'s `type`',
    };
    for (const [key, value] of Object.entries(V.values)) {
        const list = Array.isArray(value) ? value : [value];
        const where = valueKeys[key] || code(key);
        const extra = key === 'playerSpawn' ? ', or a layer path' : key === 'order' ? ', or a list of pool entry names'
                    : key === 'reset' ? ' (as `<kind>:<name>`)' : '';
        lines.push(`| ${where} | ${codes(list)}${extra} |`);
    }
    lines.push(
        '',
        '## Conditions',
        '',
        'A case can follow a condition: `{ "condition": "<source>[:<name>] [<op> <whole number>]" }`.',
        '',
        '| | |',
        '| --- | --- |',
        `| sources that count | ${codes(V.conditions.count)} (no op: at least 1) |`,
        `| sources that are true or false | ${codes(V.conditions.flag)} |`,
        `| ops | ${codes(V.conditions.ops)} |`,
        '',
        '## Triggers',
        '',
        'What `on` and `until` name, as `<kind>:<key>`.',
        '',
        '| Reported by | Kinds |',
        '| --- | --- |',
        `| the level map | ${codes(V.triggers.map)} |`,
        `| the director | ${codes(V.triggers.director)} |`,
        `| the player | ${codes(V.triggers.player)} |`,
        `| conditions (true while they hold) | ${codes(V.triggers.condition)} |`,
        '',
        `Kinds whose key is an item in the catalog: ${codes(V.itemTriggers)}.`,
        '',
        '## Reports',
        '',
        `What the director reports, for checklists: ${codes(V.reports)}.`,
        '',
        `Format version: ${code(String(V.version))}.`,
        '',
    );
    return lines.join('\n');
}

module.exports = { vocabularyMarkdown, VOCABULARY_FILE, VOCABULARY_COMMAND };
