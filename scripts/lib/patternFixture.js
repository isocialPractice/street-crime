// scripts/lib/patternFixture.js - a small level that exists only in memory,
// with the placeholder names the level-design skill's patterns use, so every
// design in skills/level-design/references/patterns.md (and the starter in
// skills/level-design/templates/) can be checked by the same code SANDBOX
// TEST runs, without art on disk that the game would never load.
//
// The street:
//   ENTERABLE-corner-shop    open; inside: the key (counter), batteries (shelf)
//     shop-shutter           a layer a design can slide (animate-layers)
//   RESTRICTED-back-room     locked until the design opens it; inside: the
//                            flashlight (workbench)
//   RESTRICTED-storeroom     REQUIRE-item-key; inside: a bandage (locker) and
//                            OBJECT-safe, an interact area
//   OBJECT-front-grille      holds BREAKABLE-front-grille
//   OBJECT-newsstand         an interact area
//   EVENT-alley-mouth        a trigger area
//   OBJECT-bench             holds INVENTORY-whistle
//
// The items are the sandbox catalog's (config/debug/items.json), so a pattern
// can be tried in SANDBOX TEST as written.

'use strict';

const DIR = '.fixture/patterns/';

const svg = (width, body) => [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 600">`,
    `  <rect id="backdrop" width="${width}" height="600" fill="#1b2233"/>`,
    `  <polygon id="field" points="0,420 ${width},420 ${width},600 0,600" fill="#3a3f4b"/>`,
    ...body,
    '</svg>',
    '',
].join('\n');

const room = (body) => svg(800, body);

const FILES = {
    [`${DIR}level-patterns.svg`]: svg(1600, [
        '  <g id="ENTERABLE-corner-shop">',
        '    <rect x="100" y="200" width="300" height="220" fill="#5b6070"/>',
        '    <rect id="shop-shutter" x="180" y="250" width="140" height="160" fill="#8a8f9c"/>',
        '    <rect id="ENTER-building" x="200" y="300" width="100" height="120" fill="#050505"/>',
        '  </g>',
        '  <g id="RESTRICTED-back-room">',
        '    <rect x="500" y="200" width="250" height="220" fill="#5b6070"/>',
        '    <rect id="ENTER-building-2" data-name="ENTER-building" x="580" y="300" width="90" height="120" fill="#050505"/>',
        '  </g>',
        '  <g id="RESTRICTED-storeroom">',
        '    <rect x="850" y="200" width="250" height="220" fill="#5b6070"/>',
        '    <g id="REQUIRE-item-key"/>',
        '    <rect id="ENTER-building-3" data-name="ENTER-building" x="930" y="300" width="90" height="120" fill="#050505"/>',
        '  </g>',
        '  <g id="OBJECT-front-grille"><rect id="BREAKABLE-front-grille" x="1150" y="330" width="120" height="90" fill="#9aa0aa"/></g>',
        '  <g id="OBJECT-newsstand"><rect x="1300" y="340" width="80" height="80" fill="#b5651d"/></g>',
        '  <rect id="EVENT-alley-mouth" x="1450" y="430" width="100" height="160" fill="none"/>',
        '  <g id="OBJECT-bench"><rect x="1380" y="440" width="60" height="20" fill="#6b4f2a"/><rect id="INVENTORY-whistle" x="1400" y="430" width="20" height="10" fill="none"/></g>',
    ]),
    [`${DIR}enterables/corner-shop.svg`]: room([
        '  <g id="OBJECT-counter"><rect x="300" y="380" width="200" height="60" fill="#6b4f2a"/><rect id="INVENTORY-key" x="380" y="370" width="20" height="10" fill="none"/></g>',
        '  <g id="OBJECT-shelf"><rect x="600" y="300" width="120" height="140" fill="#6b4f2a"/><rect id="INVENTORY-batteries" x="640" y="430" width="20" height="10" fill="none"/></g>',
    ]),
    [`${DIR}enterables/back-room.svg`]: room([
        '  <g id="OBJECT-workbench"><rect x="400" y="380" width="200" height="60" fill="#6b4f2a"/><rect id="INVENTORY-flashlight" x="480" y="370" width="20" height="10" fill="none"/></g>',
    ]),
    [`${DIR}enterables/storeroom.svg`]: room([
        '  <g id="OBJECT-safe"><rect x="300" y="340" width="90" height="90" fill="#2c2f36"/></g>',
        '  <g id="OBJECT-locker"><rect x="550" y="300" width="80" height="140" fill="#4a5060"/><rect id="INVENTORY-bandage" x="580" y="430" width="20" height="10" fill="none"/></g>',
    ]),
};

const PATTERN_FIXTURE = {
    level: DIR,
    scene: 'level-patterns.svg',
    items: 'config/debug/items.json',
    files: FILES,
};

module.exports = { PATTERN_FIXTURE };
