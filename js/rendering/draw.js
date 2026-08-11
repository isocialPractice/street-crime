// js/rendering/draw.js — Main scene draw, title draw, and debug hitbox overlay

function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.save();
    // ctx.translate(shakeX, shakeY) shifts every subsequent draw call by the
    // shake offset so the entire scene vibrates together. The -10 margin on
    // clearRect ensures shake cannot reveal un-cleared pixels at the canvas edge.
    ctx.translate(cam.shakeX, cam.shakeY);
    ctx.clearRect(-10, -10, W + 20, H + 20);

    const stageData = (typeof getCurrentStageData === 'function') ? getCurrentStageData() : null;
    drawStageBackground(stageData);
    // Sky-side weather (moon, storm clouds, sky tone) sits between the stage
    // art and the characters. The matching front pass runs after the entities.
    drawWeatherSky(stageData);

    // Depth sort — all entities and objects use feet Y as the sort key so correct
    // painter's-algorithm layering is maintained. The +0.5 player bias keeps
    // the player drawn on top when exactly depth-matched with an enemy.
    const depthKey = item => {
        if (item === player)           return player.y + player.h + 0.5;
        if (item instanceof Enemy)     return item.y + item.h;
        /* BreakableObj */             return item.y;
    };
    [...enemies, player, ...breakables]
        .sort((a, b) => depthKey(a) - depthKey(b))
        .forEach(item => item.draw());

    pickups.forEach(p => p.draw());
    effects.forEach(f => f.draw());

    // Near-field weather (rain, splashes, lightning, heat haze) falls in front
    // of everything the depth sort just drew, but stays under the HUD overlays.
    drawWeatherFront();

    // Stage intro overlay
    if (levelMgr && levelMgr.phase === 'intro') {
        const a = Math.min(1, levelMgr.introT / 2.5);
        ctx.fillStyle = `rgba(0,0,0,${a * 0.65})`;
        ctx.fillRect(-10, -10, W + 20, H + 20);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 40px "Courier New"';
        ctx.fillText(levelMgr.data.name, W / 2, H / 2 - 20);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '18px "Courier New"';
        ctx.fillText('J/Z : PUNCH     K/X : KICK     SPACE : JUMP', W / 2, H / 2 + 25);
        ctx.fillText('SHIFT : RUN     ↑ + PUNCH : UPPERCUT     RUN + KICK : RUNNING KICK', W / 2, H / 2 + 50);
    }

    // Stage-clear flash
    if (levelMgr && levelMgr.phase === 'clear') {
        const t = 3.0 - levelMgr.clearT;
        if (Math.floor(t * 5) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,215,0,0.12)';
            ctx.fillRect(-10, -10, W + 20, H + 20);
        }
    }

    if (debugMode) drawDebug();

    ctx.restore();
}

function drawTitle() {
    ctx.clearRect(0, 0, W, H);
    const bg = BACKGROUNDS[0];
    if (bg && bg.complete) ctx.drawImage(bg, 0, 0, W, H);
}

function drawDebug() {
    if (!CFG.showHitboxes) {
        _updateDebugStatus();
        return;
    }
    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';

    const stageData = (typeof getCurrentStageData === 'function') ? getCurrentStageData() : null;
    const field = stageFieldPolygon(stageData);
    if (field?.length) {
        ctx.beginPath();
        ctx.moveTo(field[0].x - cam.x, field[0].y);
        for (let i = 1; i < field.length; i++) {
            ctx.lineTo(field[i].x - cam.x, field[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,210,255,0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,210,255,0.78)';
        ctx.setLineDash([8, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0,210,255,0.95)';
        ctx.textAlign = 'left';
        ctx.fillText('FIELD', field[0].x - cam.x + 8, Math.max(14, field[0].y - 10));
    }

    // ── Player hitbox ──────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(80,160,255,0.85)';
    ctx.strokeRect(player.screenX, player.drawY, player.w, player.h);
    ctx.fillStyle = 'rgba(80,160,255,0.18)';
    ctx.fillRect(player.screenX, player.drawY, player.w, player.h);
    ctx.fillStyle = 'rgba(80,160,255,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(player.state, player.screenX + player.w / 2, player.drawY - 4);

    // ── Player attack reach ────────────────────────────────────────────────
    if (player.busy && !['hurt','knockdown','knockedUp'].includes(player.state)) {
        const RANGE  = { punch1:CFG.punchRange, punch2:CFG.punchRange,
                         kick1:CFG.kickRange,   kick2:CFG.kickRange,
                         uppercut:CFG.uppercutRange, runningkick:CFG.runningKickRange,
                         jumpkick:CFG.jumpKickRange };
        const range  = RANGE[player.state] || CFG.punchRange;
        const front  = player.facing === 1 ? player.screenX + player.w : player.screenX;
        const hx1    = player.facing === 1 ? front - CFG.collisionBodyOverlap : front - range;
        const hx2    = player.facing === 1 ? front + range                    : front + CFG.collisionBodyOverlap;
        const hy     = player.drawY + player.h * 0.15;
        const hh     = player.h * 0.7;
        ctx.strokeStyle = 'rgba(255,230,0,0.9)';
        ctx.setLineDash([3,3]);
        ctx.strokeRect(hx1, hy, hx2 - hx1, hh);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,230,0,0.08)';
        ctx.fillRect(hx1, hy, hx2 - hx1, hh);
    }

    // ── Object collision zone (player break reach) ────────────────────────
    if (player.busy && !['hurt','knockdown','knockedUp'].includes(player.state)) {
        const obfront = player.facing === 1 ? player.screenX + player.w : player.screenX;
        const obhx1   = player.facing === 1 ? obfront - CFG.objCollisionOverlap : obfront - CFG.objCollisionRange;
        const obhx2   = player.facing === 1 ? obfront + CFG.objCollisionRange   : obfront + CFG.objCollisionOverlap;
        const obDepthY = player.y + player.h;
        const obsy     = obDepthY - CFG.objCollisionDepthTol - cam.shakeY;
        ctx.strokeStyle = 'rgba(0,255,150,0.7)';
        ctx.setLineDash([2,4]);
        ctx.strokeRect(obhx1, obsy, obhx2 - obhx1, CFG.objCollisionDepthTol * 2);
        ctx.setLineDash([]);
    }

    // ── Breakable object blocking zones ───────────────────────────────────
    // Orange = sprite bounds; shaded band = expanded feet-based blocking zone.
    const expand = CFG.objBlockDepthExpand;
    breakables.forEach(obj => {
        if (obj.broken) return;
        const sx = obj.x - cam.x;
        // Sprite outline
        ctx.strokeStyle = 'rgba(255,165,0,0.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, obj.y - obj.h, obj.w, obj.h);
        // Blocking depth zone (expanded on both sides)
        const blockTop    = obj.y - obj.h - expand;
        const blockBottom = obj.y + expand;
        ctx.fillStyle = 'rgba(255,165,0,0.10)';
        ctx.fillRect(sx - 4, blockTop, obj.w + 8, blockBottom - blockTop);
        ctx.strokeStyle = 'rgba(255,165,0,0.55)';
        ctx.setLineDash([4,4]);
        ctx.strokeRect(sx - 4, blockTop, obj.w + 8, blockBottom - blockTop);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,165,0,0.85)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BLOCK', sx + obj.w / 2, blockTop - 2);
    });

    // ── Enemy hitboxes + attack reach ──────────────────────────────────────
    enemies.forEach(e => {
        const isDead = e.dead;
        ctx.strokeStyle = isDead ? 'rgba(120,120,120,0.5)' : 'rgba(255,60,60,0.85)';
        ctx.strokeRect(e.screenX, e.drawY, e.w, e.h);
        if (!isDead) {
            ctx.fillStyle = 'rgba(255,60,60,0.08)';
            ctx.fillRect(e.screenX, e.drawY, e.w, e.h);
        }
        ctx.fillStyle = isDead ? '#888' : '#f55';
        ctx.textAlign = 'center';
        ctx.fillText(`${e.state}  ${e.hp}hp`, e.screenX + e.w / 2, e.drawY - 4);

        if (e.state === 'attack' && !isDead) {
            const efront = e.facing === 1 ? e.screenX + e.w : e.screenX;
            const ehx1   = e.facing === 1 ? efront - 10                    : efront - CFG.enemyAtkCheckDist;
            const ehx2   = e.facing === 1 ? efront + CFG.enemyAtkCheckDist : efront + 10;
            ctx.strokeStyle = 'rgba(255,80,80,0.7)';
            ctx.setLineDash([3,3]);
            ctx.strokeRect(ehx1, e.drawY + e.h * 0.1, ehx2 - ehx1, e.h * 0.8);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,80,80,0.07)';
            ctx.fillRect(ehx1, e.drawY + e.h * 0.1, ehx2 - ehx1, e.h * 0.8);
        }
    });

    // ── DEBUG label ────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,215,0,0.75)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DEBUG', 6, 14);

    ctx.restore();
    _updateDebugStatus();
}
