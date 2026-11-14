// js/ui/overlay.js - GameUI: what opens over the game and stops it
//
// One overlay is open at a time: the message window (what an item is, and
// whether to take it), a screen such as the item screen (open(controller)),
// and later the command line. While
// one is open the game does not update (game.js), key presses go to it rather
// than to the player (js/core/input.js), and P and Esc do not pause. Closing
// one clears the keys, so a key held through it does not walk the player off.
//
// The message window types its text out at CFG.textSpeed characters a second
// (any confirm key shows the rest at once), then asks, if it has a question,
// with choices picked by Left / Right and E, Enter, J or Space; Esc, K or
// Backspace picks the last choice (NO). With no question, a confirm key
// closes it. The mouse works too. With prefers-reduced-motion the text
// appears whole and nothing slides.

const GameUI = {
    current: null,     // the open overlay's state, or null
    _els:    null,

    isOpen() {
        return !!this.current;
    },

    // canOpenScreen - whether a screen the player opens (the item screen, the
    // command line) may open now: while playing, with a player who is on
    // stage, standing, not walking in or through a door, and nothing else open.
    canOpenScreen() {
        const p = typeof player !== 'undefined' ? player : null;
        return gameState === 'playing' && !!p?.inventory && !p.hidden && !p.script && p.hp > 0
            && !(typeof levelRuntime !== 'undefined' && levelRuntime?.fade)
            && !this.isOpen();
    },

    // open - make a screen the open overlay: a controller with kind,
    // key(e) (true when it used the key), update(dt) and hide(). The item
    // screen (js/ui/inventory-screen.js) is one. Whatever was open closes.
    open(controller) {
        if (this.current) this.close();
        this.current = { kind: controller.kind, controller };
    },

    // message - open the message window, or replace what it shows.
    //   text      what to say, typed out
    //   ask       a question shown once the text is out, with choices
    //   choices   ['YES', 'NO'], picked as 0, 1; none: confirm closes
    //   art       an item's Image, shown in a well beside the text
    //   onChoose  called with the choice (or -1 when closed without one),
    //             after the window has closed, so it may open another
    message({ text = '', ask = '', choices = [], art = null, onChoose = null } = {}) {
        if (this.current?.controller) this.close();
        const els = this._mount();
        const state = { kind: 'message', text: String(text), ask: String(ask), choices: [...choices],
                        selected: 0, shown: 0, onChoose };
        if (this._reducedMotion()) state.shown = state.text.length;
        this.current = state;
        els.art.hidden = !(art && art.src);
        if (art && art.src) els.artImg.src = art.src;
        els.root.classList.remove('hidden');
        // Restart the rise-in each time it opens.
        els.box.classList.remove('rise');
        void els.box.offsetWidth;
        els.box.classList.add('rise');
        this._render();
    },

    // update - called once a frame while open, for the typed-out text.
    update(dt) {
        const state = this.current;
        if (state?.controller) {
            state.controller.update(dt);
            return;
        }
        if (!state || state.kind !== 'message') return;
        if (state.shown < state.text.length) {
            state.shown = Math.min(state.text.length, state.shown + dt * Math.max(1, CFG.textSpeed || 40));
            this._render();
        }
    },

    // key - a key press while open (input.js). Returns whether it was used.
    key(e) {
        const state = this.current;
        if (state?.controller) return state.controller.key(e);
        if (!state || e.repeat) return true;
        const code = e.code;
        const confirm = ['KeyE', 'Enter', 'NumpadEnter', 'KeyJ', 'Space'].includes(code);
        const cancel  = ['Escape', 'KeyK', 'Backspace'].includes(code);
        const typing  = state.shown < state.text.length;
        if (confirm || cancel) {
            if (typing && confirm) {
                state.shown = state.text.length;
                this._render();
            } else if (state.choices.length) {
                this._choose(cancel ? state.choices.length - 1 : state.selected);
            } else {
                this._choose(-1);
            }
            return true;
        }
        if (!typing && state.choices.length && ['ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(code)) {
            state.selected = (state.selected + state.choices.length - 1) % state.choices.length;
            this._render();
        } else if (!typing && state.choices.length && ['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(code)) {
            state.selected = (state.selected + 1) % state.choices.length;
            this._render();
        }
        return true;
    },

    close() {
        const state = this.current;
        if (!state) return;
        this.current = null;
        if (state.controller) state.controller.hide();
        if (this._els) this._els.root.classList.add('hidden');
        for (const k in Keys) Keys[k] = false;
        clearJustPressed();
    },

    _choose(choice) {
        const onChoose = this.current?.onChoose;
        this.close();
        if (typeof onChoose === 'function') onChoose(choice);
    },

    _reducedMotion() {
        return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    _render() {
        const state = this.current;
        const els = this._els;
        if (!state || !els) return;
        const typing = state.shown < state.text.length;
        els.text.textContent = state.text.slice(0, Math.floor(state.shown));
        els.ask.textContent = typing ? '' : state.ask;
        els.ask.hidden = typing || !state.ask;
        els.choices.replaceChildren(...(typing ? [] : state.choices.map((label, i) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ui-choice' + (i === state.selected ? ' selected' : '');
            button.textContent = label;
            button.addEventListener('mouseenter', () => {
                if (this.current === state) {
                    state.selected = i;
                    this._render();
                }
            });
            button.addEventListener('click', event => {
                event.stopPropagation();
                if (this.current === state) this._choose(i);
            });
            return button;
        })));
        els.more.hidden = typing || state.choices.length > 0;
    },

    // _mount - the message window's elements, made the first time.
    _mount() {
        if (this._els) return this._els;
        const root = document.createElement('div');
        root.id = 'ui-message';
        root.className = 'ui-overlay hidden';
        root.innerHTML = `
            <div class="ui-message-box" role="dialog" aria-live="polite">
                <div class="ui-message-art"><img alt=""></div>
                <div class="ui-message-body">
                    <p class="ui-message-text"></p>
                    <p class="ui-message-ask"></p>
                    <div class="ui-message-choices"></div>
                    <span class="ui-message-more" aria-hidden="true">&#9660;</span>
                </div>
            </div>`;
        (document.getElementById('ui') || document.body).appendChild(root);
        const els = {
            root,
            box:     root.querySelector('.ui-message-box'),
            art:     root.querySelector('.ui-message-art'),
            artImg:  root.querySelector('.ui-message-art img'),
            text:    root.querySelector('.ui-message-text'),
            ask:     root.querySelector('.ui-message-ask'),
            choices: root.querySelector('.ui-message-choices'),
            more:    root.querySelector('.ui-message-more'),
        };
        // A click on the window with nothing to choose moves it on, like E.
        els.box.addEventListener('click', () => {
            const state = this.current;
            if (!state || state.choices.length) return;
            if (state.shown < state.text.length) {
                state.shown = state.text.length;
                this._render();
            } else {
                this._choose(-1);
            }
        });
        this._els = els;
        return els;
    },
};
