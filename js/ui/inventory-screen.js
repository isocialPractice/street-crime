// js/ui/inventory-screen.js - the item screen: what the player carries, and
// what they can do with it
//
// I or Tab opens it while playing (js/core/input.js), never during a door's
// fade or the player's entrance; the game stops under it (GameUI). It works in
// the manner of the classic survival-horror status screen:
//
//   left    the player, their condition as a heartbeat trace and a word, and
//           what they are holding (FISTS until there are weapons)
//   right   the slots, two across, as many as the inventory has
//   bottom  the message line: the item under the cursor, its name in the
//           accent color and what checking it says, typed out
//
// Arrows or WASD move the cursor. E, Enter, J or Space on an item opens its
// commands: USE, CHECK, COMBINE. Esc, K or Backspace goes back one level and,
// from the slots, closes the screen, as I and Tab do from anywhere.
//
//   USE      what the item's "use" does (js/entities/items.js), said on the
//            message line. An item that acts on the world (a scatter, such as
//            the whistle) closes the screen first, so what it does is seen.
//   CHECK    the item large, turning slowly on its upright axis, its art on
//            the front and mirrored on the back; Left and Right turn it by hand
//   COMBINE  pick a second item (the first one's slot blinks): a recipe on
//            either side makes the result, in the first one's slot; picking
//            the first again cancels
//
// There is no drop: as in the genre's originals, what is carried stays carried.
// The mouse works too: hovering moves the cursor, a click selects, a second
// click or a click on a command confirms, a click outside the panel closes.
// With prefers-reduced-motion nothing rises or turns, the trace is drawn
// still, and text appears whole.

// Condition by health, highest first: the word, the heart rate the trace
// beats at, and its colors (the trace's, and the word's).
const ITEM_SCREEN_CONDITIONS = [
    { word: 'FINE',    above: 2 / 3, bpm: 60,  trace: '#4ade80', css: 'fine' },
    { word: 'CAUTION', above: 1 / 3, bpm: 90,  trace: '#ff8a2b', css: 'caution' },
    { word: 'DANGER',  above: -1,    bpm: 130, trace: '#e53e3e', css: 'danger' },
];
const ITEM_SCREEN_COMMANDS = ['USE', 'CHECK', 'COMBINE'];
const ITEM_SCREEN_COLUMNS  = 2;
const ITEM_SCREEN_SWEEP    = 110;   // trace px a second
const ITEM_SCREEN_TURN     = 40;    // CHECK's slow turn, degrees a second
const ITEM_SCREEN_HAND     = 22;    // degrees a Left or Right press turns it

// _itemScreenWave - one heartbeat as a height from -1 to 1, through a beat
// (phase 0 to 1): a small P wave, the sharp QRS spike, a rounded T wave.
function _itemScreenWave(p) {
    const bump = (a, b, h) => (p > a && p < b ? Math.sin((p - a) / (b - a) * Math.PI) * h : 0);
    return bump(0.08, 0.18, 0.12) + bump(0.22, 0.25, -0.12) + bump(0.25, 0.30, 1)
         + bump(0.30, 0.34, -0.3) + bump(0.44, 0.60, 0.22);
}

function _itemScreenRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(3)})`;
}

const ItemScreen = {
    kind:    'items',
    els:     null,
    mode:    'grid',     // 'grid' | 'menu' | 'combine' | 'check'
    cursor:  0,
    command: 0,
    first:   -1,         // the slot a COMBINE started from
    msg:     { name: '', text: '', shown: 0 },
    ecg:     { t: 0, x: 0, points: [] },
    turn:    { angle: 0, hand: 0, held: 0 },

    // canOpen - whether the screen may open now (GameUI.canOpenScreen).
    canOpen() {
        return GameUI.canOpenScreen();
    },

    open() {
        if (!this.canOpen()) return false;
        const els = this._mount();
        this.mode = 'grid';
        this.first = -1;
        this.command = 0;
        this.cursor = Math.max(0, Math.min(this.cursor, this._slots() - 1));
        GameUI.open(this);
        els.root.classList.remove('hidden');
        els.panel.classList.remove('rise');
        void els.panel.offsetWidth;
        els.panel.classList.add('rise');
        els.portrait.src = (typeof PLAYER !== 'undefined' && PLAYER.idle1?.src) || '';
        this.ecg = { t: 0, x: 0, points: [] };
        if (this._still()) this._fillTrace();
        this._describe();
        this._render();
        this._drawTrace();
        return true;
    },

    hide() {
        if (this.els) this.els.root.classList.add('hidden');
        this.mode = 'grid';
    },

    // ── Keys ──────────────────────────────────────────────────────────────────
    key(e) {
        const code = e.code;
        if ((code === 'KeyI' && !e.ctrlKey && !e.metaKey) || code === 'Tab') {
            if (!e.repeat) GameUI.close();
            return true;
        }
        const confirm = ['KeyE', 'Enter', 'NumpadEnter', 'KeyJ', 'Space'].includes(code);
        const back    = ['Escape', 'KeyK', 'Backspace'].includes(code);
        const dir = {
            ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
            ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
        }[code];
        if ((confirm || back) && e.repeat) return true;

        if (this.mode === 'grid' || this.mode === 'combine') {
            if (dir) this._move(dir);
            else if (confirm) this._pick(this.cursor);
            else if (back) {
                if (this.mode === 'combine') this._toGrid();
                else GameUI.close();
            }
        } else if (this.mode === 'menu') {
            if (dir && dir[1]) {
                this.command = (this.command + dir[1] + ITEM_SCREEN_COMMANDS.length) % ITEM_SCREEN_COMMANDS.length;
                this._render();
            } else if (confirm) {
                this._run(this.command);
            } else if (back) {
                this._toGrid();
            }
        } else if (this.mode === 'check') {
            if (dir && dir[0]) {
                this.turn.hand += dir[0] * ITEM_SCREEN_HAND;
                this.turn.held = 1.5;
                this._applyTurn();
            } else if (confirm || back) {
                this._toGrid();
            }
        }
        return true;
    },

    // ── Each frame ────────────────────────────────────────────────────────────
    update(dt) {
        const msg = this.msg;
        if (msg.shown < msg.text.length) {
            msg.shown = this._still() ? msg.text.length
                      : Math.min(msg.text.length, msg.shown + dt * Math.max(1, CFG.textSpeed || 40));
            this._renderMessage();
        }
        if (!this._still()) {
            this._stepTrace(dt);
            this._drawTrace();
            if (this.mode === 'check') {
                if (this.turn.held > 0) this.turn.held -= dt;
                else this.turn.angle += dt * ITEM_SCREEN_TURN;
                this._applyTurn();
            }
        }
    },

    // ── What the commands do ──────────────────────────────────────────────────
    _slots() {
        return player?.inventory?.slots || 8;
    },

    _entry(i) {
        return player?.inventory?.items[i] || null;
    },

    _move([dx, dy]) {
        const cols = ITEM_SCREEN_COLUMNS;
        const rows = Math.ceil(this._slots() / cols);
        const col = Math.max(0, Math.min(cols - 1, this.cursor % cols + dx));
        const row = Math.max(0, Math.min(rows - 1, Math.floor(this.cursor / cols) + dy));
        const next = row * cols + col;
        if (next < this._slots() && next !== this.cursor) {
            this.cursor = next;
            if (this.mode === 'grid') this._describe();
            this._render();
        }
    },

    // _pick - E on a slot: its commands, or, while combining, the second item.
    _pick(i) {
        const entry = this._entry(i);
        if (this.mode === 'combine') {
            if (i === this.first) {
                this._toGrid();
                return;
            }
            if (!entry) return;
            const a = this._entry(this.first)?.item;
            const result = itemCombine(player, a, entry.item);
            this.mode = 'grid';
            this.cursor = result.made ? Math.max(0, player.inventory.items.findIndex(slot => slot.item === result.made)) : this.first;
            this.first = -1;
            this._say(result.made ? itemName(result.made) : '', result.text);
            this._render();
            return;
        }
        if (!entry) {
            this._say('', 'Nothing there.');
            return;
        }
        this.mode = 'menu';
        this.command = 0;
        this._render();
    },

    _run(n) {
        const entry = this._entry(this.cursor);
        if (!entry) {
            this._toGrid();
            return;
        }
        const def = itemDef(entry.item);
        const name = itemName(entry.item);
        if (ITEM_SCREEN_COMMANDS[n] === 'USE') {
            // Something the world has to show: the screen goes first.
            if (def?.use?.scatter !== undefined) {
                GameUI.close();
                itemUse(player, entry.item);
                return;
            }
            const result = itemUse(player, entry.item);
            this.mode = 'grid';
            this.cursor = Math.min(this.cursor, this._slots() - 1);
            this._say(name, result.text);
            this._render();
        } else if (ITEM_SCREEN_COMMANDS[n] === 'CHECK') {
            this.mode = 'check';
            this.turn = { angle: 0, hand: 0, held: 0 };
            const src = itemArt(entry.item)?.src || '';
            this.els.checkFront.src = src;
            this.els.checkBack.src = src;
            this._applyTurn();
            this._say(name, def?.look || `A ${name}.`);
            this._render();
        } else {
            this.mode = 'combine';
            this.first = this.cursor;
            this._say('', `Combine the ${name} with what?`);
            this._render();
        }
    },

    _toGrid() {
        this.mode = 'grid';
        this.first = -1;
        this._describe();
        this._render();
    },

    // _describe - the message line for the item under the cursor.
    _describe() {
        const entry = this._entry(this.cursor);
        if (!entry) this._say('', '');
        else this._say(itemName(entry.item), itemDef(entry.item)?.look || '');
    },

    _say(name, text) {
        this.msg = { name, text, shown: this._still() ? text.length : 0 };
        this._renderMessage();
    },

    _condition() {
        const p = player;
        const share = p && p.maxHp ? p.hp / p.maxHp : 1;
        return ITEM_SCREEN_CONDITIONS.find(c => share > c.above) || ITEM_SCREEN_CONDITIONS[2];
    },

    _still() {
        return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    // ── The heartbeat trace ───────────────────────────────────────────────────
    // A line swept left to right, one pixel at a time, at the heart rate of
    // the player's condition; each pixel fades as the sweep moves on, so the
    // last beats trail behind the bright head.
    _stepTrace(dt) {
        const c = this.els.ecg;
        const e = this.ecg;
        const { bpm } = this._condition();
        const steps = Math.max(1, Math.round(dt * ITEM_SCREEN_SWEEP));
        for (let k = 0; k < steps; k++) {
            e.t += dt / steps;
            e.x = (e.x + 1) % c.width;
            e.points[e.x] = { y: this._traceY(e.t * bpm / 60 % 1), at: e.t };
        }
    },

    _traceY(phase) {
        const h = this.els.ecg.height;
        return h * 0.62 - _itemScreenWave(phase) * h * 0.46;
    },

    // _fillTrace - the whole width at once, for a trace drawn still.
    _fillTrace() {
        const c = this.els.ecg;
        const { bpm } = this._condition();
        const sweep = c.width / ITEM_SCREEN_SWEEP;
        this.ecg = { t: sweep, x: c.width - 1, points: [], still: true };
        for (let x = 0; x < c.width; x++) {
            const t = x / ITEM_SCREEN_SWEEP;
            this.ecg.points[x] = { y: this._traceY(t * bpm / 60 % 1), at: sweep };
        }
    },

    _drawTrace() {
        const c = this.els.ecg;
        const g = c.getContext('2d');
        const e = this.ecg;
        const cond = this._condition();
        g.clearRect(0, 0, c.width, c.height);
        g.fillStyle = '#0b1118';
        g.fillRect(0, 0, c.width, c.height);
        g.strokeStyle = 'rgba(90,150,130,0.12)';
        g.lineWidth = 1;
        for (let x = 0.5; x < c.width; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
        for (let y = 0.5; y < c.height; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
        const tail = c.width / ITEM_SCREEN_SWEEP;
        g.lineWidth = 2;
        g.lineCap = 'round';
        for (let x = 1; x < c.width; x++) {
            const a = e.points[x - 1];
            const b = e.points[x];
            if (!a || !b || x - 1 === e.x) continue;
            const age = e.still ? 0 : e.t - b.at;
            if (age >= tail * 0.95) continue;
            g.strokeStyle = _itemScreenRgba(cond.trace, 1 - age / tail);
            g.beginPath();
            g.moveTo(x - 1, a.y);
            g.lineTo(x, b.y);
            g.stroke();
        }
        const head = e.points[e.x];
        if (head && !e.still) {
            g.save();
            g.shadowColor = cond.trace;
            g.shadowBlur = 8;
            g.fillStyle = '#ffffff';
            g.beginPath();
            g.arc(e.x, head.y, 2.2, 0, Math.PI * 2);
            g.fill();
            g.restore();
        }
    },

    _applyTurn() {
        if (!this.els) return;
        this.els.checkTurn.style.transform = this._still() ? 'none'
            : `rotateY(${(this.turn.angle + this.turn.hand).toFixed(1)}deg)`;
    },

    // ── Drawing ───────────────────────────────────────────────────────────────
    _render() {
        const els = this.els;
        if (!els) return;
        const inv = player.inventory;
        const cond = this._condition();
        els.word.textContent = cond.word;
        els.word.className = `ui-cond-word ${cond.css}`;
        els.count.textContent = `${inv.items.length} / ${inv.slots} SLOTS`;
        els.root.dataset.mode = this.mode;

        els.grid.replaceChildren(...Array.from({ length: this._slots() }, (_, i) => {
            const entry = this._entry(i);
            const slot = document.createElement('button');
            slot.type = 'button';
            slot.tabIndex = -1;
            slot.className = 'ui-slot' + (i === this.cursor ? ' selected' : '')
                           + (i === this.first ? ' picked' : '') + (entry ? '' : ' empty');
            slot.setAttribute('aria-label', entry ? `${itemName(entry.item)}${entry.count > 1 ? `, ${entry.count}` : ''}` : 'empty');
            if (entry) {
                const art = itemArt(entry.item);
                if (art?.src) {
                    const img = document.createElement('img');
                    img.src = art.src;
                    img.alt = '';
                    slot.appendChild(img);
                } else {
                    slot.textContent = itemName(entry.item);
                }
                if (entry.count > 1) {
                    const count = document.createElement('span');
                    count.className = 'ui-count';
                    count.textContent = entry.count;
                    slot.appendChild(count);
                }
            }
            slot.addEventListener('mouseenter', () => {
                if ((this.mode === 'grid' || this.mode === 'combine') && this.cursor !== i) {
                    this.cursor = i;
                    if (this.mode === 'grid') this._describe();
                    this._render();
                }
            });
            // Hovering already selects, so the first click on a slot opens
            // its commands; another click on it leaves them open, and a click
            // on a different slot goes back to the slots, there.
            slot.addEventListener('click', event => {
                event.stopPropagation();
                if (this.mode === 'menu' && this.cursor === i) return;
                if (this.mode === 'menu' || this.mode === 'check') {
                    this.cursor = i;
                    this._toGrid();
                } else if (this.cursor === i) {
                    this._pick(i);
                } else {
                    this.cursor = i;
                    if (this.mode === 'grid') this._describe();
                    this._render();
                }
            });
            return slot;
        }));

        els.menu.hidden = this.mode !== 'menu';
        if (this.mode === 'menu') {
            const row = Math.floor(this.cursor / ITEM_SCREEN_COLUMNS);
            els.menu.style.top = `${row * 86}px`;
            els.menu.replaceChildren(...ITEM_SCREEN_COMMANDS.map((label, n) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.tabIndex = -1;
                button.className = 'ui-command' + (n === this.command ? ' selected' : '');
                button.textContent = label;
                button.addEventListener('mouseenter', () => {
                    if (this.command !== n) {
                        this.command = n;
                        this._render();
                    }
                });
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    this._run(n);
                });
                return button;
            }));
        }
        els.check.hidden = this.mode !== 'check';
        els.grid.hidden = this.mode === 'check';
        els.keys.textContent = {
            grid:    'ARROWS MOVE   E SELECT   ESC / I CLOSE',
            menu:    'UP / DOWN CHOOSE   E DO IT   ESC BACK',
            combine: 'PICK THE SECOND ITEM   E COMBINE   ESC CANCEL',
            check:   'LEFT / RIGHT TURN   E OR ESC BACK',
        }[this.mode];
        this._renderMessage();
    },

    _renderMessage() {
        if (!this.els) return;
        this.els.msgName.textContent = this.msg.name;
        this.els.msgName.hidden = !this.msg.name;
        this.els.msgText.textContent = this.msg.text.slice(0, Math.floor(this.msg.shown));
    },

    _mount() {
        if (this.els) return this.els;
        const root = document.createElement('div');
        root.id = 'ui-items';
        root.className = 'ui-overlay ui-items hidden';
        root.innerHTML = `
            <div class="ui-items-panel" role="dialog" aria-label="Status and items">
                <div class="ui-items-head">
                    <h2 class="ui-items-title">STATUS</h2>
                    <span class="ui-items-count"></span>
                </div>
                <div class="ui-items-body">
                    <div class="ui-items-status">
                        <div class="ui-portrait"><img alt=""></div>
                        <div class="ui-label">CONDITION</div>
                        <canvas class="ui-ecg" width="232" height="60"></canvas>
                        <div class="ui-cond-word"></div>
                        <div class="ui-label">HOLDING</div>
                        <div class="ui-holding">FISTS</div>
                    </div>
                    <div class="ui-items-right">
                        <div class="ui-items-grid"></div>
                        <div class="ui-items-menu" hidden></div>
                        <div class="ui-items-check" hidden>
                            <div class="ui-check-stage">
                                <div class="ui-check-turn">
                                    <img class="front" alt="">
                                    <img class="back" alt="">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="ui-items-message" aria-live="polite">
                    <p class="ui-msg-name"></p>
                    <p class="ui-msg-text"></p>
                </div>
                <div class="ui-items-keys"></div>
            </div>`;
        (document.getElementById('ui') || document.body).appendChild(root);
        const q = selector => root.querySelector(selector);
        this.els = {
            root,
            panel:      q('.ui-items-panel'),
            count:      q('.ui-items-count'),
            portrait:   q('.ui-portrait img'),
            ecg:        q('.ui-ecg'),
            word:       q('.ui-cond-word'),
            grid:       q('.ui-items-grid'),
            menu:       q('.ui-items-menu'),
            check:      q('.ui-items-check'),
            checkTurn:  q('.ui-check-turn'),
            checkFront: q('.ui-check-turn .front'),
            checkBack:  q('.ui-check-turn .back'),
            msgName:    q('.ui-msg-name'),
            msgText:    q('.ui-msg-text'),
            keys:       q('.ui-items-keys'),
        };
        // A click outside the panel closes the screen; one on the turning
        // item goes back to the slots.
        root.addEventListener('click', event => {
            if (event.target === root) GameUI.close();
        });
        this.els.check.addEventListener('click', event => {
            event.stopPropagation();
            this._toGrid();
        });
        return this.els;
    },
};
