// js/level/manager.js — LevelMgr finite state machine
// Drives the stage flow through phases:
//   intro → wave → (repeat) → scrollSubboss → subboss → scrollBoss → boss → clear

class LevelMgr {
    constructor(stageIdx) {
        this.data        = STAGES[stageIdx];
        this.stageIdx    = stageIdx;
        this.phase       = 'intro';
        this.introT      = 2.8;
        this.waveIdx     = 0;
        this.clearT      = 0;
        this.locked      = false;   // camera locked during wave/boss
        this.trackedBoss = null;
        this.scrollGoal  = 0;
    }

    _spawnWave(enemies, breakables) {
        const wave = this.data.waves[this.waveIdx];
        wave.gang.forEach(([id, relX], i) => {
            const y = CFG.groundMin + 40 + Math.random() * (CFG.groundMax - CFG.groundMin - 50);
            const e = new Enemy(cam.x + W + 60 + i * 85, y, id);
            e.flankDir    = (i % 2 === 0) ? 1 : -1;
            e.engageDelay = 0.5 + i * 0.9 + Math.random() * 0.6;
            enemies.push(e);
        });
        this.locked = true;
    }

    _spawnObjects(breakables) {
        this.data.objects.forEach(([rx, ry]) => {
            breakables.push(new BreakableObj(cam.x + rx, ry));
        });
    }

    _allDead(enemies) {
        return enemies.every(e => e.isDone);
    }

    update(dt, player, enemies, breakables) {
        const alive = enemies.filter(e => !e.isDone);

        // ── INTRO ─────────────────────────────────────────────────────────────
        if (this.phase === 'intro') {
            this.introT -= dt;
            if (this.introT <= 0) {
                this.phase = 'wave';
                this._spawnWave(enemies, breakables);
                this._spawnObjects(breakables);
            }
            return;
        }

        // ── Camera scroll when unlocked ────────────────────────────────────────
        // Lerps toward a target slightly behind the player; exponential decay
        // gives a smooth "catch up" feel. cam.x never scrolls back left.
        if (!this.locked) {
            const target = Math.max(cam.x, player.x - 160);
            cam.x += (target - cam.x) * dt * 4;
        }

        // ── WAVE ──────────────────────────────────────────────────────────────
        if (this.phase === 'wave') {
            if (alive.length === 0) {
                this.waveIdx++;
                if (this.waveIdx < this.data.waves.length) {
                    this.phase      = 'scrollWave';
                    this.locked     = false;
                    this.scrollGoal = player.x + 500;
                } else {
                    this.phase      = 'scrollSubboss';
                    this.locked     = false;
                    this.scrollGoal = player.x + 600;
                }
            }
            return;
        }

        // ── SCROLL TO NEXT WAVE ───────────────────────────────────────────────
        if (this.phase === 'scrollWave') {
            if (player.x >= this.scrollGoal) {
                this.phase = 'wave';
                this._spawnWave(enemies, breakables);
            }
            return;
        }

        // ── SCROLL TO SUB-BOSS ────────────────────────────────────────────────
        if (this.phase === 'scrollSubboss') {
            if (player.x >= this.scrollGoal) {
                this.phase  = 'subboss';
                this.locked = true;
                const sb = new Enemy(cam.x + W - 100, 450, this.data.subboss);
                enemies.push(sb);
                _showBossHUD(this.data.subboss.toUpperCase().replace('_',' '), sb);
                this.trackedBoss = sb;
            }
            return;
        }

        // ── SUB-BOSS ──────────────────────────────────────────────────────────
        if (this.phase === 'subboss') {
            _updateBossBar(this.trackedBoss);
            if (alive.length === 0) {
                _hideBossHUD();
                this.phase      = 'scrollBoss';
                this.locked     = false;
                this.scrollGoal = player.x + 600;
            }
            return;
        }

        // ── SCROLL TO BOSS ────────────────────────────────────────────────────
        if (this.phase === 'scrollBoss') {
            if (player.x >= this.scrollGoal) {
                this.phase  = 'boss';
                this.locked = true;
                const b = new Enemy(cam.x + W - 110, 450, this.data.boss);
                enemies.push(b);
                _showBossHUD(this.data.boss.toUpperCase().replace('_',' '), b);
                this.trackedBoss = b;
            }
            return;
        }

        // ── BOSS ──────────────────────────────────────────────────────────────
        if (this.phase === 'boss') {
            _updateBossBar(this.trackedBoss);
            if (alive.length === 0) {
                _hideBossHUD();
                this.phase = 'clear';
                this.clearT = 3.0;
            }
            return;
        }

        // ── CLEAR ─────────────────────────────────────────────────────────────
        if (this.phase === 'clear') {
            this.clearT -= dt;
            if (this.clearT <= 0) {
                if (this.stageIdx < STAGES.length - 1) {
                    gameState = 'stageclear';
                    showOverlay(`STAGE ${this.stageIdx + 1} CLEAR!`, `Score: ${score}`);
                } else {
                    gameState = 'victory';
                    showOverlay('YOU WIN!', `Final Score: ${score}`);
                }
            }
        }
    }
}
