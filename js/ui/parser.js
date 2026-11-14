// js/ui/parser.js - the command line: typed commands, in the manner of the
// parser adventures
//
// Ctrl+I while playing (js/core/input.js) opens a one-line input across the
// bottom of the view; the game stops under it (GameUI). Enter runs the line,
// Esc clears it (and closes it when it is empty), Up and Down go back through
// the lines already run. The answer appears in a box above the line, with the
// command echoed; Enter, Esc or any action key closes it, and the game goes on.
//
//   look, l, examine, x, check, inspect   what lies within CFG.lookRange px
//                                         of the player's feet; with a word,
//                                         that thing (on screen, or carried)
//   talk, speak, ask, chat                to the nearest enemy within
//                                         CFG.talkRange px
//   use, apply <item> [on <thing>]        the item's USE, as on the item screen
//   take, get, grab, pick up <item>       an item in reach, without asking
//   inventory, inv, i, items              the item screen
//   help, ?                               the verbs
//
// Words such as "the", "a", "at", "to", "with" and "around" are dropped. What
// a thing is called is its layer name in words ("OBJECT-parking-gate-box" is a
// parking gate box), or what the level design's "look" says about it. LOOK
// reports "look:<name>" ("look:ground" when nothing is near) and TALK
// "talk:<group or enemy>", so a design can wait on them.

const COMMAND_VERBS = {
    look:      ['look', 'l', 'examine', 'x', 'check', 'inspect'],
    talk:      ['talk', 'speak', 'ask', 'chat'],
    use:       ['use', 'apply'],
    take:      ['take', 'get', 'grab', 'pick'],
    inventory: ['inventory', 'inv', 'i', 'items'],
    help:      ['help', '?'],
};
const COMMAND_FILLER   = ['the', 'a', 'an', 'at', 'to', 'with', 'around', 'up', 'some', 'my'];
const COMMAND_MAX      = 60;     // characters a line may hold
const COMMAND_HISTORY  = 20;     // lines kept for Up
const COMMAND_RUDE = ['Not worth it.', 'Back off.', 'Forget it. You are not worth the trouble.'];
const COMMAND_HELP = 'You can LOOK, LOOK <thing>, TALK, USE <item>, USE <item> ON <thing>, '
                   + 'TAKE <item>, INVENTORY and HELP.';

// commandWords - a layer or art name in words: "parking-gate-box" is
// "parking gate box", "badBar" is "bad bar", a numbered copy loses its
// number, and a recolored enemy ("CrimeGuy~left-vest=gray") is the enemy.
function commandWords(name) {
    return String(name ?? '').replace(/~.*$/, '').replace(/[-_]\d+$/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase().trim();
}

function _commandArticle(words) {
    return /^[aeiou]/.test(words) ? `an ${words}` : `a ${words}`;
}

// commandList - "a", "a and b", "a, b and c".
function commandList(names) {
    if (names.length < 2) return names[0] || '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function _commandSentence(text) {
    return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// commandThingName - what a thing near the player (LevelMapRuntime.nearby)
// is called: "a brass key", "a door to the import export warehouse", "the
// way out", "a parking gate box", "a broken parking gate arm", "a crime guy".
function commandThingName(thing) {
    switch (thing.kind) {
        case 'item':  return _commandArticle(itemName(thing.key).toLowerCase());
        case 'door':
            if (thing.type === 'exit') return 'the way out';
            return thing.enterable ? `a door to the ${commandWords(thing.enterable)}` : 'a door';
        case 'breakable':
            return _commandArticle(`${thing.broken ? 'broken ' : ''}${commandWords(thing.key)}`);
        case 'enemy': {
            const img = thing.ref?.def?.img || thing.key;
            return _commandArticle(commandWords(img));
        }
        default:      return _commandArticle(commandWords(thing.key));
    }
}

// commandParse - a typed line as { verb, words, on }: the verb's name (its
// first word, read through COMMAND_VERBS; the word itself when it is none of
// them, with known false), the words after it without the filler, and for
// USE the words after "on". Empty lines give a verb of ''.
function commandParse(line) {
    const tokens = String(line ?? '').toLowerCase().replace(/[^a-z0-9?\s-]/g, ' ').split(/\s+/).filter(Boolean);
    if (!tokens.length) return { verb: '', known: false, words: [], on: [] };
    const first = tokens[0];
    const verb = Object.keys(COMMAND_VERBS).find(name => COMMAND_VERBS[name].includes(first));
    const rest = tokens.slice(1).filter(word => !COMMAND_FILLER.includes(word));
    const onAt = rest.indexOf('on');
    return {
        verb:  verb || first,
        known: !!verb,
        words: onAt >= 0 ? rest.slice(0, onAt) : rest,
        on:    onAt >= 0 ? rest.slice(onAt + 1) : [],
    };
}

// _commandScore - how well typed words name something called by these
// names: 3 for exactly, 2 for one holding the words, 1 for the words holding
// one, 0 for none.
function _commandScore(words, names) {
    const phrase = words.join(' ');
    if (!phrase) return 0;
    let best = 0;
    for (const name of names.filter(Boolean).map(n => String(n).toLowerCase())) {
        if (name === phrase) best = Math.max(best, 3);
        else if (name.includes(phrase)) best = Math.max(best, 2);
        else if (phrase.includes(name)) best = Math.max(best, 1);
    }
    return best;
}

// _commandCarried - the carried item the words name best, or null.
function _commandCarried(p, words) {
    let best = null;
    let bestScore = 0;
    for (const slot of p?.inventory?.items || []) {
        const score = _commandScore(words, [slot.item, commandWords(slot.item), itemName(slot.item)]);
        if (score > bestScore) {
            best = slot.item;
            bestScore = score;
        }
    }
    return best;
}

// _commandThingWords - every name a thing near the player answers to.
function _commandThingWords(thing) {
    const name = commandThingName(thing).replace(/^(a|an|the) /, '');
    const extra = { door: ['door', thing.type === 'exit' ? 'exit' : 'door', 'way out'],
                    enemy: ['enemy', 'thug', 'him', 'her', 'them'], item: ['item'] }[thing.kind] || [];
    return [name, thing.key, commandWords(thing.key), ...extra];
}

// commandRun - what a typed line does, as { text } to say, or { after } for
// a command that closes the line first (INVENTORY, and a USE whose effect the
// world shows). p is the player, runtime the level map runtime, if any.
function commandRun(line, p, runtime = typeof levelRuntime !== 'undefined' ? levelRuntime : null) {
    const { verb, known, words, on } = commandParse(line);
    const looks = typeof levelDirector !== 'undefined' && levelDirector?.design?.look;
    const lookSaid = key => (looks && typeof looks[key] === 'string' && looks[key].trim() ? looks[key].trim() : null);
    const report = (kind, key) => {
        if (typeof levelMapEmit === 'function' && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(String(key))) levelMapEmit(kind, key);
    };

    if (!known) return { text: `You do not know how to ${verb}.` };
    if (verb === 'help') return { text: COMMAND_HELP };
    if (verb === 'inventory') return { after: () => ItemScreen.open() };

    if (verb === 'look') {
        if (!words.length || ['around', 'here', 'room', 'street'].includes(words.join(' '))) {
            const near = runtime ? runtime.nearby(p, CFG.lookRange) : [];
            if (!near.length) {
                report('look', 'ground');
                return { text: 'There seems to be ground here.' };
            }
            report('look', near[0].key);
            const names = [...new Set(near.map(commandThingName))];
            return { text: `There seems to be ${commandList(names)} here.` };
        }
        if (['ground', 'floor'].includes(words.join(' '))) {
            report('look', 'ground');
            return { text: 'Just the ground. It has seen better days.' };
        }
        const carried = _commandCarried(p, words);
        if (carried) {
            report('look', carried);
            return { text: itemDef(carried)?.look || `It is ${_commandArticle(itemName(carried).toLowerCase())}.` };
        }
        // Anything on screen, nearest first among the best named.
        const seen = runtime ? runtime.nearby(p, W) : [];
        let best = null;
        let bestScore = 0;
        for (const thing of seen) {
            const score = _commandScore(words, _commandThingWords(thing));
            if (score > bestScore) {
                best = thing;
                bestScore = score;
            }
        }
        if (!best) return { text: 'You do not see that here.' };
        report('look', best.key);
        const said = lookSaid(best.key) || (best.kind === 'door' && lookSaid(best.enterable));
        if (said) return { text: said };
        if (best.kind === 'item') return { text: itemDef(best.key)?.look || `It is ${commandThingName(best)}.` };
        if (best.kind === 'enemy') return { text: `${_commandSentence(commandThingName(best))}. They do not look friendly.` };
        return { text: `It is ${commandThingName(best)}.` };
    }

    if (verb === 'talk') {
        const enemy = (runtime ? runtime.nearby(p, CFG.talkRange) : []).find(thing => thing.kind === 'enemy');
        if (!enemy) return { text: 'There is nobody here to talk to.' };
        report('talk', enemy.key);
        const e = enemy.ref;
        if (e.fleeing || e.scattered) return { text: COMMAND_RUDE[Math.floor(Math.random() * COMMAND_RUDE.length)] };
        return { text: 'They are done talking.' };
    }

    if (verb === 'use') {
        if (!words.length) return { text: 'Use what?' };
        const id = _commandCarried(p, words);
        if (!id) return { text: 'You do not have that.' };
        const def = itemDef(id);
        // Something the world has to show: the line goes first.
        if (def?.use?.scatter !== undefined) return { after: () => itemUse(p, id) };
        if (!def?.use && on.length) return { text: `You cannot use the ${def.name} on that.` };
        return { text: itemUse(p, id).text };
    }

    if (verb === 'take') {
        const lying = (runtime ? runtime.nearby(p, CFG.lookRange) : []).filter(thing => thing.kind === 'item');
        if (!lying.length) return { text: words.length ? 'There is nothing like that here.' : 'There is nothing here to take.' };
        const pick = words.length
            ? lying.find(thing => _commandScore(words, [thing.key, itemName(thing.key)]) > 0)
            : lying[0];
        if (!pick) return { text: 'There is nothing like that here.' };
        return { text: itemTake(p, pick.ref).text };
    }
    return { text: `You do not know how to ${verb}.` };
}

// ── The line on screen ────────────────────────────────────────────────────────
const CommandLine = {
    kind:    'command',
    els:     null,
    mode:    'typing',     // 'typing' | 'answer'
    line:    '',
    history: [],
    back:    -1,           // where Up has got to in history, -1 for the new line
    answer:  { echo: '', text: '', shown: 0 },

    open() {
        if (!GameUI.canOpenScreen()) return false;
        const els = this._mount();
        this.mode = 'typing';
        this.line = '';
        this.back = -1;
        GameUI.open(this);
        els.root.classList.remove('hidden');
        this._render();
        return true;
    },

    hide() {
        if (this.els) this.els.root.classList.add('hidden');
        this.mode = 'typing';
        this.line = '';
    },

    key(e) {
        if (e.ctrlKey && e.code === 'KeyI') {
            if (!e.repeat) GameUI.close();
            return true;
        }
        if (this.mode === 'answer') {
            const done = ['Enter', 'NumpadEnter', 'Escape', 'KeyE', 'KeyJ', 'KeyK', 'Space', 'Backspace'].includes(e.code);
            if (done && !e.repeat) {
                const a = this.answer;
                if (a.shown < a.text.length && e.code !== 'Escape') {
                    a.shown = a.text.length;
                    this._render();
                } else {
                    GameUI.close();
                }
            }
            return true;
        }
        if (e.code === 'Escape') {
            if (!e.repeat) {
                if (this.line) this.line = '';
                else GameUI.close();
                this._render();
            }
            return true;
        }
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            if (!e.repeat) this._submit();
            return true;
        }
        if (e.code === 'Backspace') {
            this.line = this.line.slice(0, -1);
            this._render();
            return true;
        }
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            if (!this.history.length) return true;
            this.back = e.code === 'ArrowUp' ? Math.min(this.history.length - 1, this.back + 1) : this.back - 1;
            if (this.back < 0) {
                this.back = -1;
                this.line = '';
            } else {
                this.line = this.history[this.history.length - 1 - this.back];
            }
            this._render();
            return true;
        }
        if (typeof e.key === 'string' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
            && this.line.length < COMMAND_MAX) {
            this.line += e.key;
            this._render();
        }
        return true;
    },

    update(dt) {
        const a = this.answer;
        if (this.mode === 'answer' && a.shown < a.text.length) {
            a.shown = this._still() ? a.text.length : Math.min(a.text.length, a.shown + dt * Math.max(1, CFG.textSpeed || 40));
            this._render();
        }
    },

    // _submit - run the line. An empty one closes; one that opens something
    // else, or acts on the world, closes the line first.
    _submit() {
        const line = this.line.trim();
        this.line = '';
        this.back = -1;
        if (!line) {
            GameUI.close();
            return;
        }
        if (this.history[this.history.length - 1] !== line) {
            this.history.push(line);
            if (this.history.length > COMMAND_HISTORY) this.history.shift();
        }
        const result = commandRun(line, player);
        if (result.after) {
            GameUI.close();
            result.after();
            return;
        }
        this.mode = 'answer';
        this.answer = { echo: line, text: result.text, shown: this._still() ? result.text.length : 0 };
        this._render();
    },

    _still() {
        return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    _render() {
        const els = this.els;
        if (!els) return;
        const answering = this.mode === 'answer';
        els.answer.hidden = !answering;
        els.echo.textContent = `> ${this.answer.echo}`;
        els.text.textContent = this.answer.text.slice(0, Math.floor(this.answer.shown));
        els.line.textContent = answering ? '' : this.line;
        els.caret.hidden = answering;
        els.bar.classList.toggle('answering', answering);
    },

    _mount() {
        if (this.els) return this.els;
        const root = document.createElement('div');
        root.id = 'ui-command';
        root.className = 'ui-overlay ui-cmdline hidden';
        root.innerHTML = `
            <div class="ui-cmd-answer" role="status" aria-live="polite" hidden>
                <p class="ui-cmd-echo"></p>
                <p class="ui-cmd-text"></p>
            </div>
            <div class="ui-cmd-bar" role="textbox" aria-label="Command">
                <span class="ui-cmd-prompt">&gt;</span><span class="ui-cmd-line"></span><span class="ui-cmd-caret"></span>
            </div>`;
        (document.getElementById('ui') || document.body).appendChild(root);
        const q = selector => root.querySelector(selector);
        this.els = {
            root, answer: q('.ui-cmd-answer'), echo: q('.ui-cmd-echo'), text: q('.ui-cmd-text'),
            bar: q('.ui-cmd-bar'), line: q('.ui-cmd-line'), caret: q('.ui-cmd-caret'),
        };
        // A click on the answer moves it on, as Enter does.
        this.els.answer.addEventListener('click', () => {
            if (this.mode !== 'answer') return;
            if (this.answer.shown < this.answer.text.length) {
                this.answer.shown = this.answer.text.length;
                this._render();
            } else {
                GameUI.close();
            }
        });
        return this.els;
    },
};
