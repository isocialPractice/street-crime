// js/ui/viewer.js — Sprite Viewer mode
// Allows browsing all character sprites with per-state scale tuning.
// Scales are exported to characters.json and loaded at boot.

const viewerState = { charKey: 'CrimeGuy', globalScale: 1.0, selectedIdx: -1 };

// Build the canonical sprite list for the currently viewed character.
// Each entry: { label, stateKey, img }
function _viewerSprites() {
    const isPlayer = viewerState.charKey === '__player__';
    if (isPlayer) {
        return [
            { label:'idle1',    stateKey:'idle',        img: PLAYER.idle1       },
            { label:'idle2',    stateKey:'idle',        img: PLAYER.idle2       },
            { label:'walk0',    stateKey:'walk',        img: PLAYER.walk0       },
            { label:'walk4',    stateKey:'walk',        img: PLAYER.walk4       },
            { label:'run',      stateKey:'run',         img: PLAYER.run         },
            { label:'jump',     stateKey:'jump',        img: PLAYER.jump        },
            { label:'punch1',   stateKey:'punch1',      img: PLAYER.punch1      },
            { label:'punch2',   stateKey:'punch2',      img: PLAYER.punch2      },
            { label:'kick1',    stateKey:'kick1',       img: PLAYER.kick1       },
            { label:'kick2',    stateKey:'kick2',       img: PLAYER.kick2       },
            { label:'uppercut', stateKey:'uppercut',    img: PLAYER.upperCut    },
            { label:'runKick',  stateKey:'runningkick', img: PLAYER.runningKick },
            { label:'jumpKick', stateKey:'jumpkick',    img: PLAYER.jumpKick    },
            { label:'knockDwn', stateKey:'knockdown',   img: PLAYER.knockDown   },
        ];
    }
    const c = ENEMY_CHARS[viewerState.charKey];
    if (!c) return [];
    const list = [];
    if (c.idle)    list.push({ label:'idle',    stateKey:'idle',    img: c.idle    });
    if (c.walk)    list.push({ label:'walk',    stateKey:'walk',    img: c.walk    });
    if (c.punch)   list.push({ label:'punch',   stateKey:'attack',  img: c.punch   });
    if (c.punch2)  list.push({ label:'punch2',  stateKey:'attack',  img: c.punch2  });
    if (c.kick)    list.push({ label:'kick',    stateKey:'attack',  img: c.kick    });
    if (c.attack)  list.push({ label:'attack',  stateKey:'attack',  img: c.attack  });
    if (c.defeat)  list.push({ label:'defeat',  stateKey:'defeat',  img: c.defeat  });
    return list;
}

// Shared layout constants recomputed from sprite count each frame.
function _viewerLayout(count) {
    const HEADER = 32, FOOTER = 28;
    const cols = Math.min(count, 5);
    const rows = Math.ceil(count / cols);
    const cellW = Math.floor(W / cols);
    const cellH = Math.floor((H - HEADER - FOOTER) / rows);
    return { HEADER, FOOTER, cols, rows, cellW, cellH };
}

function startViewer() {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('debug-left-panel').classList.remove('hidden');
    buildViewerPanel();
    gameState = 'viewer';
    canvas.addEventListener('click', _viewerClickHandler);
}

function _viewerClickHandler(e) {
    if (gameState !== 'viewer') return;
    const rect   = canvas.getBoundingClientRect();
    const cx     = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const cy     = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const sprites = _viewerSprites();
    if (!sprites.length) return;
    const { HEADER, cellW, cellH, cols } = _viewerLayout(sprites.length);
    if (cy < HEADER) return;
    const col = Math.floor(cx / cellW);
    const row = Math.floor((cy - HEADER) / cellH);
    const idx = row * cols + col;
    if (idx < 0 || idx >= sprites.length) return;
    viewerState.selectedIdx = idx;
    _refreshViewerStatePanel(sprites[idx]);
}

function buildViewerPanel() {
    const panel = document.getElementById('debug-left-panel');
    const charOptions = ['<option value="__player__">PLAYER</option>',
        ...Object.keys(ENEMY_CHARS).map(k => `<option value="${k}">${k}</option>`)
    ].join('');
    panel.innerHTML = `
        <div id="dbg-title">SPRITE VIEWER</div>

        <div class="dbg-section">CHARACTER</div>
        <select class="dbg-enemy-select" id="viewer-char-select">${charOptions}</select>

        <div class="dbg-section">GLOBAL SCALE</div>
        <div class="dbg-row">
            <span class="dbg-label">Preview</span>
            <input type="range" class="dbg-slider" id="viewer-scale"
                   min="0.2" max="5.0" step="0.1" value="1.0">
            <span class="dbg-val" id="viewer-scale-val">1.0×</span>
        </div>

        <div class="dbg-section">SELECTED STATE</div>
        <div class="dbg-status" id="viewer-state-name" style="color:#ffd700;margin-bottom:6px">
            click a cell →
        </div>
        <div class="dbg-row" id="viewer-sx-row" style="display:none">
            <span class="dbg-label">Scale X</span>
            <input type="range" class="dbg-slider" id="viewer-sx"
                   min="0.05" max="5.0" step="0.05" value="1.0">
            <span class="dbg-val" id="viewer-sx-val">1.00</span>
        </div>
        <div class="dbg-row" id="viewer-sy-row" style="display:none">
            <span class="dbg-label">Scale Y</span>
            <input type="range" class="dbg-slider" id="viewer-sy"
                   min="0.05" max="5.0" step="0.05" value="1.0">
            <span class="dbg-val" id="viewer-sy-val">1.00</span>
        </div>

        <button class="dbg-spawn-btn" id="viewer-export"
                style="margin-top:14px">&#x2B07; Export characters.json</button>
        <div class="dbg-status" style="margin-top:8px;color:#555;line-height:1.5">
            Click cell to select.<br>
            Scales applied in-game<br>
            when characters.json loads.
        </div>
    `;

    document.getElementById('viewer-char-select').addEventListener('change', e => {
        viewerState.charKey    = e.target.value;
        viewerState.selectedIdx = -1;
        document.getElementById('viewer-state-name').textContent = 'click a cell →';
        document.getElementById('viewer-sx-row').style.display   = 'none';
        document.getElementById('viewer-sy-row').style.display   = 'none';
    });
    document.getElementById('viewer-scale').addEventListener('input', e => {
        viewerState.globalScale = parseFloat(e.target.value);
        document.getElementById('viewer-scale-val').textContent =
            viewerState.globalScale.toFixed(1) + '×';
    });
    document.getElementById('viewer-sx').addEventListener('input', _viewerScaleInput);
    document.getElementById('viewer-sy').addEventListener('input', _viewerScaleInput);
    document.getElementById('viewer-export').addEventListener('click', exportCharacters);
}

function _viewerScaleInput() {
    const sprites = _viewerSprites();
    const sel     = sprites[viewerState.selectedIdx];
    if (!sel) return;
    const sx = parseFloat(document.getElementById('viewer-sx').value);
    const sy = parseFloat(document.getElementById('viewer-sy').value);
    document.getElementById('viewer-sx-val').textContent = sx.toFixed(2);
    document.getElementById('viewer-sy-val').textContent = sy.toFixed(2);
    _setCharScale(viewerState.charKey, sel.stateKey, sx, sy);
}

function _refreshViewerStatePanel(sprite) {
    const sc = _charScale(viewerState.charKey, sprite.stateKey);
    document.getElementById('viewer-state-name').textContent =
        `${sprite.label}  [${sprite.stateKey}]`;
    const sxEl = document.getElementById('viewer-sx');
    const syEl = document.getElementById('viewer-sy');
    sxEl.value = sc.sx;
    syEl.value = sc.sy;
    document.getElementById('viewer-sx-val').textContent = sc.sx.toFixed(2);
    document.getElementById('viewer-sy-val').textContent = sc.sy.toFixed(2);
    document.getElementById('viewer-sx-row').style.display = 'flex';
    document.getElementById('viewer-sy-row').style.display = 'flex';
}

function exportCharacters() {
    const blob = new Blob([JSON.stringify(charScales, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'characters.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

function drawSpriteViewer() {
    ctx.clearRect(0, 0, W, H);
    const bg = BACKGROUNDS[0];
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, W, H);

    const sprites = _viewerSprites();
    if (!sprites.length) {
        ctx.fillStyle = '#888'; ctx.font = '16px monospace'; ctx.textAlign = 'center';
        ctx.fillText('No sprites for this character', W / 2, H / 2);
        _drawViewerHeader();
        return;
    }

    const { HEADER, cellW, cellH, cols } = _viewerLayout(sprites.length);
    const gsc = viewerState.globalScale;

    ctx.font = '10px monospace';
    sprites.forEach((s, i) => {
        const col    = i % cols;
        const row    = Math.floor(i / cols);
        const cellX  = col * cellW;
        const cellY  = HEADER + row * cellH;
        const cx     = cellX + cellW / 2;
        const cy     = cellY + cellH / 2;
        const isSelected = i === viewerState.selectedIdx;

        ctx.fillStyle = isSelected ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)';
        ctx.fillRect(cellX, cellY, cellW, cellH);
        ctx.strokeStyle = isSelected ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth   = isSelected ? 2 : 1;
        ctx.strokeRect(cellX, cellY, cellW, cellH);
        ctx.lineWidth   = 1;

        if (!s.img || !s.img.naturalWidth) {
            ctx.fillStyle = '#555'; ctx.textAlign = 'center';
            ctx.fillText(s.label, cx, cy);
            return;
        }

        const csc = _charScale(viewerState.charKey, s.stateKey);
        const dw  = s.img.naturalWidth  * gsc * csc.sx;
        const dh  = s.img.naturalHeight * gsc * csc.sy;

        ctx.save();
        ctx.beginPath();
        ctx.rect(cellX + 1, cellY + 1, cellW - 2, cellH - 2);
        ctx.clip();
        ctx.drawImage(s.img, cx - dw / 2, cellY + cellH - 18 - dh, dw, dh);
        ctx.restore();

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(cx - dw / 2, cellY + cellH - 18 - dh, dw, dh);
        ctx.setLineDash([]);

        const scTxt = (csc.sx === csc.sy)
            ? `×${csc.sx.toFixed(2)}`
            : `×${csc.sx.toFixed(2)},${csc.sy.toFixed(2)}`;
        ctx.fillStyle = isSelected ? '#ffd700' : 'rgba(255,215,0,0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(`${s.label}  ${scTxt}`, cx, cellY + cellH - 5);
    });

    _drawViewerHeader();
}

function _drawViewerHeader() {
    const isPlayer  = viewerState.charKey === '__player__';
    const charLabel = isPlayer ? 'PLAYER' : viewerState.charKey;
    ctx.fillStyle   = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, 32);
    ctx.fillStyle   = '#ffd700';
    ctx.font        = 'bold 14px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(`◈ SPRITE VIEWER  ·  ${charLabel}  ·  preview ×${viewerState.globalScale.toFixed(1)}`, W / 2, 21);
    ctx.fillStyle   = 'rgba(255,255,255,0.3)';
    ctx.font        = '10px monospace';
    ctx.textAlign   = 'right';
    ctx.fillText('ESC — title', W - 6, 21);
    ctx.textAlign   = 'left';
}
