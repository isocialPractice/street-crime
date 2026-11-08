// docs/assets/site.js - the documentation site's two buttons, and nothing else.
//
//   Theme   cycles system, light, dark; the choice is remembered in this browser
//           (the layout applies it before the page paints)
//   Menu    on narrow screens, slides the side menu over the page; Escape, the
//           shaded page behind it, or choosing a page closes it
//
// The current page's menu entry is scrolled into view, for a long menu on a
// short screen.

(() => {
    const root = document.documentElement;

    // ── Theme ────────────────────────────────────────────────────────────────
    const KEY = 'sc-theme';
    const ORDER = ['auto', 'light', 'dark'];
    const LABEL = { auto: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };
    const themeButton = document.getElementById('theme-toggle');

    const readTheme = () => {
        try {
            const saved = localStorage.getItem(KEY);
            return ORDER.includes(saved) ? saved : 'auto';
        } catch (e) {
            return 'auto';
        }
    };
    const applyTheme = theme => {
        root.dataset.theme = theme;
        if (themeButton) {
            themeButton.textContent = LABEL[theme];
            themeButton.setAttribute('aria-label', `${LABEL[theme]}. Change theme`);
        }
    };

    applyTheme(readTheme());
    themeButton?.addEventListener('click', () => {
        const next = ORDER[(ORDER.indexOf(root.dataset.theme) + 1) % ORDER.length];
        try { localStorage.setItem(KEY, next); } catch (e) { /* not remembered, still applied */ }
        applyTheme(next);
    });

    // ── Menu on narrow screens ───────────────────────────────────────────────
    const menuButton = document.getElementById('menu-toggle');
    const menu = document.getElementById('menu');
    const scrim = document.getElementById('scrim');

    const setMenu = open => {
        document.body.classList.toggle('menu-open', open);
        menuButton?.setAttribute('aria-expanded', String(open));
        if (scrim) scrim.hidden = !open;
    };

    menuButton?.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
    scrim?.addEventListener('click', () => setMenu(false));
    menu?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
            setMenu(false);
            menuButton?.focus();
        }
    });

    // ── Current page ─────────────────────────────────────────────────────────
    menu?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
})();
