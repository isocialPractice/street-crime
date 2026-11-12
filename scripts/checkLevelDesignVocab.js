#!/usr/bin/env node
// scripts/checkLevelDesignVocab.js - check that LEVEL_DESIGN_VOCAB in
// js/level/level-design.js and config/schema/level-design.schema.json allow
// the same keys and values. The validator reads the first, editors read the
// second, and a word added to one but not the other would be accepted by one
// and flagged by the other. Run from the repo root:
//
//   node scripts/checkLevelDesignVocab.js
//
// Exits 0 when they agree, 1 with the differences listed when they do not.

const fs = require('fs'), vm = require('vm');
const ctx = vm.createContext({});
const V = vm.runInContext(fs.readFileSync('js/level/level-design.js', 'utf8') + '\n;LEVEL_DESIGN_VOCAB', ctx);
const S = JSON.parse(fs.readFileSync('config/schema/level-design.schema.json', 'utf8'));
const d = S.$defs, diffs = [];
const same = (label, a, b) => {
  const x = [...a].sort().join(','), y = [...b].sort().join(',');
  if (x !== y) diffs.push(`${label}: vocab [${x}] vs schema [${y}]`);
};
same('top keys', V.keys.top, Object.keys(S.properties));
same('restricted keys', V.keys.restricted, Object.keys(S.properties.restricted.additionalProperties.properties));
same('state keys', V.keys.state, Object.keys(d.state.properties));
same('player keys', V.keys.player, Object.keys(d.player.properties));
same('spawn keys', V.keys.spawn, Object.keys(d.spawnGroup.properties));
same('animate-layers keys', V.keys.animateLayer, Object.keys(d.animateLayer.properties));
same('pool entry keys', V.keys.poolEntry, Object.keys(d.poolEnemy.properties));
same('characters keys', V.keys.characters, Object.keys(d.state.properties.characters.properties));
same('next keys', V.keys.next, Object.keys(d.state.properties.next.items.properties));
same('svg', V.values.svg, d.state.properties.svg.enum);
same('player spawn', V.values.playerSpawn, d.player.properties.spawn.anyOf[0].enum);
same('player animation', V.values.animation, d.player.properties.animation.enum);
same('spawn animation', V.values.animation, d.spawnGroup.properties.animation.enum);
same('inventory', V.values.inventory, d.player.properties.inventory.enum);
same('health', V.values.health, d.player.properties.health.enum);
same('spawn type', V.values.spawnType, d.spawnGroup.properties.type.enum);
same('pick', V.values.pick, d.spawnGroup.properties.pick.enum);
same('ease', V.values.ease, d.animateLayer.properties.type.enum);
const kinds = /^\^\(([^)]+)\):/.exec(d.trigger.pattern)[1].split('|');
same('trigger kinds', [...V.triggers.map, ...V.triggers.director, ...V.triggers.condition], kinds);
if (V.version !== S.properties.version.const) diffs.push(`version: vocab ${V.version} vs schema ${S.properties.version.const}`);
console.log(diffs.length ? 'DIFFERENCES\n' + diffs.join('\n') : 'vocab and schema agree');
process.exit(diffs.length ? 1 : 0);
