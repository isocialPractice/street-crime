// js/level/sequence.js — Level order
// config/levels.json says which levels a run is made of and where each one
// comes from:
//
//   { "sequence": { "level-1": "svg-scenes", "level-2": "svg-scenes" } }
//
// The key is the level's place in the run; the value is its source.
//
//   "svg-scenes"  the built-in table. level-N is the Nth entry of STAGES in
//                 js/level/data.js, in the order they are written there, so
//                 adding a stage there adds a level here.
//   anything else a folder under assets/levels/ holding a hand-built level.
//                 Loading one is not written yet, and the game says so rather
//                 than stopping with no explanation.
//
// Naming a level the game cannot produce is the mistake worth catching: adding
// "level-4" does not create a fourth stage, and without this the run would
// just stop after the third with nothing said. See levelSequenceGap.

// The value that means "take this level from STAGES".
const LEVEL_SOURCE_STAGES = 'svg-scenes';

const LEVEL_KEY_RE = /^level-(\d+)$/;

function _readLevelSequenceFile() {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'config/levels.json', false);
        xhr.send();
        const parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        return (parsed.sequence && typeof parsed.sequence === 'object') ? parsed.sequence : {};
    } catch (e) {
        console.warn('[levels] Could not load config/levels.json', e);
        return {};
    }
}

// _buildLevelSequence - the sequence as a map of level number to source.
//
// A key that is not "level-<number>", or a value that is not a name, is
// dropped with a warning rather than ignored silently: a typo there would
// otherwise quietly shorten the game by one level and look like a bug
// somewhere else entirely.
function _buildLevelSequence(raw) {
    const levels = new Map();
    for (const [key, value] of Object.entries(raw)) {
        const match = LEVEL_KEY_RE.exec(key);
        if (!match || Number(match[1]) < 1) {
            console.warn('[levels] Ignoring "%s": keys read "level-<number>", counting from 1', key);
            continue;
        }
        if (typeof value !== 'string' || !value.trim()) {
            console.warn('[levels] Ignoring "%s": its value should name a source, "%s" or a folder',
                         key, LEVEL_SOURCE_STAGES);
            continue;
        }
        levels.set(Number(match[1]), value.trim());
    }
    return levels;
}

const LEVEL_SEQUENCE = _buildLevelSequence(_readLevelSequenceFile());

// levelSource - what level N is built from, or null when the run ends before
// it. With no sequence configured at all the run is simply the stages as
// written, which is what the game did before the file existed.
function levelSource(levelNo) {
    if (!LEVEL_SEQUENCE.size) return STAGES[levelNo - 1] ? LEVEL_SOURCE_STAGES : null;
    return LEVEL_SEQUENCE.get(levelNo) || null;
}

// levelSequenceGap - why level N cannot be played, or null when it can be.
//
// Returns the two lines the overlay shows. Both name the file to edit and the
// two ways out, because the person reading it has just been stopped mid-run by
// a configuration file and the useful thing is to say which one and what to
// change in it.
function levelSequenceGap(levelNo) {
    const source = levelSource(levelNo);
    if (!source) return null;                       // the run simply ends here
    if (source === LEVEL_SOURCE_STAGES) {
        if (STAGES[levelNo - 1]) return null;       // there is a stage to play
        return {
            title: `LEVEL ${levelNo} IS MISSING`,
            detail: `config/levels.json asks for level ${levelNo} from "${LEVEL_SOURCE_STAGES}", `
                  + `but js/level/data.js defines ${STAGES.length}. `
                  + `Add a stage to STAGES, or drop "level-${levelNo}" from the sequence.`,
        };
    }
    return {
        title: `LEVEL ${levelNo} IS NOT BUILT YET`,
        detail: `config/levels.json points level ${levelNo} at assets/levels/${source}/, `
              + `and loading a level from a folder is not written yet. `
              + `Set it to "${LEVEL_SOURCE_STAGES}" to use a stage from js/level/data.js instead.`,
    };
}
