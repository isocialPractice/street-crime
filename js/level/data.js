// js/level/data.js — Stage definitions
// STAGES is the game's level definition table. Each stage is a plain object
// containing all the data LevelMgr needs to run that stage. Data-driven design
// means adding a new stage requires no changes to LevelMgr — just append here.
//
// waves: array of { gang: [[typeId, relativeX], ...] }
//   Each inner pair is [enemyTypeId, relX from camera when spawned].
// objects: [[relX, absY], ...]  — absY is the BOTTOM of the breakable sprite.

const STAGES = [
    {
        name: 'STAGE 1: THE STREETS',
        bgIdx: 0,
        waves: [
            { gang: [['crimeguy',350],['badgirl',600],['jammingjabber',850]] },
            { gang: [['tightromper',320],['sassygirl',570],['crimeguy',820],['jumpingjunkie',1070]] },
        ],
        subboss: 'squirrly',
        boss:    'maskedmayhem',
        objects: [[380,545],[670,555],[1050,535],[1540,550]],
    },
    {
        name: 'STAGE 2: THE DOCKS',
        bgIdx: 1,
        waves: [
            { gang: [['roadfighter',350],['stomper',620],['redrowronda',870]] },
            { gang: [['greenstomper',300],['soldier',550],['nastyknifer',800],['roadfighter',1050]] },
        ],
        subboss: 'greenjetter',
        boss:    'maskedmayhem',
        objects: [[340,550],[720,560],[1090,540],[1480,550]],
    },
    {
        name: 'STAGE 3: THE HIDEOUT',
        bgIdx: 2,
        waves: [
            { gang: [['ninja',350],['divamohawk',620],['slender',870]] },
            { gang: [['nunchuck',300],['hyjung',540],['lowgoblin',790],['ninja',1040]] },
        ],
        subboss: 'badblob',
        boss:    'kingbrute',
        objects: [[310,548],[660,562],[990,538],[1380,552]],
    },
];
