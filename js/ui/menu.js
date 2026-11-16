// js/ui/menu.js - lists of buttons driven by the keyboard and the mouse
//
// A menu is lists of buttons shown one at a time on one screen,
// answering to the mouse and the keyboard at the same time: up/down (or W/S)
// move the highlight, Enter or Space picks the highlighted entry, Left and
// Right (A, D) step a setting's value, and clicking or hovering a button works
// as well. The game's title and pause screens each have one (game.js), and so
// does the render view's pause screen (js/ui/render-view.js).
//
// The highlight is tracked here rather than through DOM focus on purpose. A
// focused <button> is activated by the browser on Enter as well, so driving the
// menu through focus would run the chosen entry twice on a single keypress.
//
// lists maps a name to { el, back, items }: el is the list's element id, back
// (optional) what BACK and Escape do there, and each item is { id, start } or,
// for a setting, { id, start, change(dir) }.
class Menu {
    constructor(lists) {
        this.lists = lists;
        this.list  = Object.keys(lists)[0];
        this.idx   = 0;
    }

    get items() { return this.lists[this.list].items; }

    select(i) {
        const items = this.items;
        this.idx = (i + items.length) % items.length;
        items.forEach((item, n) => document.getElementById(item.id)?.classList.toggle('selected', n === this.idx));
    }

    // show - one list shown, the others hidden, with selectId (or the list's
    // first entry) highlighted.
    show(name, selectId = null) {
        this.list = name;
        for (const [key, list] of Object.entries(this.lists)) {
            document.getElementById(list.el)?.classList.toggle('hidden', key !== name);
        }
        this.select(Math.max(0, this.items.findIndex(item => item.id === selectId)));
    }

    // back - what BACK does in the shown list; false when it has none.
    back() {
        const back = this.lists[this.list].back;
        if (!back) return false;
        back();
        return true;
    }

    // onKey - one keydown. escape false leaves Escape to the caller (pause
    // reads it in togglePause, where P and Escape are already handled).
    onKey(e, { escape = true } = {}) {
        switch (e.code) {
            case 'ArrowUp':   case 'KeyW': this.select(this.idx - 1); break;
            case 'ArrowDown': case 'KeyS': this.select(this.idx + 1); break;
            case 'Enter': case 'NumpadEnter': case 'Space':
                this.items[this.idx].start();
                // The press that picked an entry must not also reach the first
                // frame of what it started, or the player jumps or swings.
                if (typeof clearJustPressed === 'function') clearJustPressed();
                break;
            case 'ArrowLeft':  case 'KeyA':
            case 'ArrowRight': case 'KeyD': {
                const item = this.items[this.idx];
                if (!item.change) return;
                item.change(e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1);
                break;
            }
            case 'Escape':
                if (!escape || !this.back()) return;
                break;
            default: return;
        }
        e.preventDefault();
    }

    // wire - a click picks an entry; hovering one in the shown list highlights
    // it, so the mouse and the keyboard never disagree about the live one.
    wire() {
        for (const [name, list] of Object.entries(this.lists)) {
            list.items.forEach((item, n) => {
                const btn = document.getElementById(item.id);
                if (!btn) return;
                btn.addEventListener('click', () => { item.start(); if (typeof clearJustPressed === 'function') clearJustPressed(); });
                btn.addEventListener('mouseenter', () => { if (this.list === name) this.select(n); });
            });
        }
    }
}

// ── Settings entries ─────────────────────────────────────────────────────────
// The values each setting steps through, in order, and the elements that show
// the current one, on every SETTINGS list: the game's title and pause menus and
// the render view's pause menu (SETTINGS, js/core/config.js).
const SETTING_CHOICES = {
    difficulty: { values: Object.keys(DIFFICULTIES), label: v => DIFFICULTIES[v].label },
};

// changeSetting - step one setting dir places along its values, wrapping, and
// keep it for the next visit. It applies from the next run (startRunSettings).
function changeSetting(key, dir) {
    const { values } = SETTING_CHOICES[key];
    const i = values.indexOf(SETTINGS[key]);
    SETTINGS[key] = values[(((i < 0 ? 0 : i) + dir) % values.length + values.length) % values.length];
    saveSettings();
    showSettingValues();
}

function showSettingValues() {
    for (const [key, choice] of Object.entries(SETTING_CHOICES)) {
        document.querySelectorAll(`[data-setting="${key}"]`).forEach(el => { el.textContent = choice.label(SETTINGS[key]); });
    }
}
