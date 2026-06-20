// ui.js — all the DOM: HUD, story modal, level-up cards, toasts, end screen.
import { SPELL_ORDER, SPELLS } from './spells.js';
import { TEMPLATES } from './recognizer.js';

const $ = (id) => document.getElementById(id);

// draw a template stroke onto a small canvas, with a green start dot + arrow
function drawTemplate(canvas, points) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, pad = 22;
  ctx.clearRect(0, 0, W, H);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const w = (maxX - minX) || 1, h = (maxY - minY) || 1;
  const s = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
  const X = (p) => ox + (p.x - minX) * s, Y = (p) => oy + (p.y - minY) * s;
  // stroke
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(155,123,255,0.35)'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(X(points[0]), Y(points[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(X(points[i]), Y(points[i]));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,205,255,0.95)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(X(points[0]), Y(points[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(X(points[i]), Y(points[i]));
  ctx.stroke();
  // start dot
  ctx.fillStyle = '#6ee7a0';
  ctx.beginPath(); ctx.arc(X(points[0]), Y(points[0]), 6, 0, Math.PI * 2); ctx.fill();
  // arrowhead at the end
  const a = points[points.length - 2] || points[0], b = points[points.length - 1];
  const ang = Math.atan2(Y(b) - Y(a), X(b) - X(a));
  ctx.fillStyle = '#ffcf5c';
  ctx.beginPath();
  ctx.moveTo(X(b), Y(b));
  ctx.lineTo(X(b) - 12 * Math.cos(ang - 0.4), Y(b) - 12 * Math.sin(ang - 0.4));
  ctx.lineTo(X(b) - 12 * Math.cos(ang + 0.4), Y(b) - 12 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}

export class UI {
  constructor() {
    this.game = null;
    this.el = {
      hud: $('hud'), hpFill: $('hp-fill'), hpLabel: $('hp-label'),
      manaFill: $('mana-fill'), manaLabel: $('mana-label'),
      xpFill: $('xp-fill'), xpLabel: $('xp-label'),
      timer: $('timer'), kills: $('kills'), sobriety: $('sobriety'),
      jobTracker: $('job-tracker'), jobDesc: $('job-desc'), jobFill: $('job-fill'),
      toastArea: $('toast-area'),
      story: $('story'), storySpeaker: $('story-speaker'), storyText: $('story-text'), storyNext: $('story-next'),
      levelup: $('levelup'), cards: $('upgrade-cards'),
      title: $('title'), btnStart: $('btn-start'), btnHow: $('btn-how'), howto: $('howto'), btnHowClose: $('btn-how-close'),
      end: $('end'), endTitle: $('end-title'), endStats: $('end-stats'), btnAgain: $('btn-again'),
      loading: $('loading'),
      bars: document.querySelector('.bars'), spellbook: $('spellbook'), castHint: $('cast-hint'),
      tavernHud: $('tavern-hud'), ruckusCount: $('ruckus-count'),
      btnGuide: $('btn-guide'), btnPause: $('btn-pause'), btnMute: $('btn-mute'),
      joystick: $('joystick'), joyKnob: $('joy-knob'), blackout: $('blackout'),
      glyphGuide: $('glyph-guide'), guideCards: $('guide-cards'), btnGuideClose: $('btn-guide-close'),
    };
    this.chips = {};
    document.querySelectorAll('.spell-chip').forEach((c) => { this.chips[c.dataset.spell] = c; });
    this._storyCb = null;
    this._storyLines = [];
    this._storyIdx = 0;
  }

  init(game) {
    this.game = game;
    this.el.btnStart.addEventListener('click', () => { game.audio.resume(); game.audio.play('click'); game.startGame(); });
    this.el.btnAgain.addEventListener('click', () => { game.audio.play('click'); game.startGame(); });
    this.el.btnHow.addEventListener('click', () => { game.audio.play('click'); this.el.howto.classList.toggle('hidden'); });
    this.el.btnHowClose.addEventListener('click', () => { game.audio.play('click'); this.el.howto.classList.add('hidden'); });
    this.el.storyNext.addEventListener('click', () => { game.audio.play('click'); this._storyAdvance(); });

    // tappable spell chips (works on desktop and mobile)
    for (const id of Object.keys(this.chips)) {
      this.chips[id].addEventListener('click', () => game.castById(id));
    }
    this.el.btnPause.addEventListener('click', () => { game.audio.play('click'); game.togglePause(); });
    this.el.btnMute.addEventListener('click', () => { game.toggleMute(); });
    this.el.btnGuide.addEventListener('click', () => { game.audio.play('click'); game.toggleGuide(); });
    this.el.btnGuideClose.addEventListener('click', () => { game.audio.play('click'); game.toggleGuide(); });
  }

  // show only the unlocked spells in the spellbook + rebuild the guide
  setUnlocked(set) {
    for (const id of Object.keys(this.chips)) this.chips[id].classList.toggle('hidden', !set.has(id));
    this.buildGuide(set);
  }

  buildGuide(set) {
    if (!this.el.guideCards) return;
    this.el.guideCards.innerHTML = '';
    for (const id of SPELL_ORDER) {
      if (!set.has(id)) continue;
      const s = SPELLS[id];
      const card = document.createElement('div');
      card.className = 'guide-card';
      const cv = document.createElement('canvas');
      cv.width = 120; cv.height = 120; cv.className = 'guide-cv';
      drawTemplate(cv, TEMPLATES[s.gesture]);
      const label = document.createElement('div');
      label.className = 'guide-label';
      label.innerHTML = `<span class="guide-glyph">${s.glyph}</span> ${s.name} <span class="key">${s.key + 1}</span>`;
      card.appendChild(cv); card.appendChild(label);
      this.el.guideCards.appendChild(card);
    }
  }

  showGuide() { this.el.glyphGuide.classList.remove('hidden'); }
  hideGuide() { this.el.glyphGuide.classList.add('hidden'); }

  critToast() {
    const t = document.createElement('div');
    t.className = 'toast crit'; t.textContent = '✦ PERFECT — CRIT! ✦';
    this.el.toastArea.appendChild(t); setTimeout(() => t.remove(), 1700);
  }
  accuracyToast(acc) {
    const label = acc >= 0.92 ? 'Clean!' : acc >= 0.8 ? 'Nice' : acc >= 0.65 ? 'Sloppy…' : 'Messy!';
    const color = acc >= 0.92 ? '#6ee7a0' : acc >= 0.8 ? '#cde87a' : acc >= 0.65 ? '#ffcf5c' : '#ff9a6a';
    const t = document.createElement('div');
    t.className = 'toast acc'; t.textContent = label; t.style.color = color;
    this.el.toastArea.appendChild(t); setTimeout(() => t.remove(), 1100);
  }

  hideLoading() { this.el.loading.classList.add('hidden'); }

  // toggle which HUD bits show for the tavern vs the forest fight
  setPhase(phase, isTouch) {
    const tavern = phase === 'tavern';
    this.el.bars.classList.toggle('hidden', tavern);
    this.el.spellbook.classList.toggle('hidden', tavern);
    this.el.sobriety.classList.toggle('hidden', tavern);
    this.el.timer.classList.toggle('hidden', tavern);
    this.el.kills.classList.toggle('hidden', tavern);
    this.el.tavernHud.classList.toggle('hidden', !tavern);
    this.el.btnGuide.classList.toggle('hidden', tavern);
    if (tavern) {
      this.el.castHint.innerHTML = isTouch ? 'Drag the <b>left side</b> to stagger toward the <b>door</b>' : '<b>WASD</b> to stagger toward the glowing <b>door</b> — he\'s very drunk!';
    } else {
      this.el.castHint.innerHTML = isTouch ? 'Left side = move · <b>draw a glyph</b> on the right to cast · or tap a spell' : 'Hold <b>Right-Mouse</b> and draw a glyph · <b>WASD</b> move · mouse aim · keys <b>1–5</b>';
    }
  }

  fadeBlack(on) { this.el.blackout.classList.toggle('show', !!on); }

  bumpTavern(n) {
    this.el.ruckusCount.textContent = n;
    this.el.tavernHud.classList.remove('flash');
    void this.el.tavernHud.offsetWidth;
    this.el.tavernHud.classList.add('flash');
  }

  setMuteIcon(muted) { this.el.btnMute.textContent = muted ? '🔇' : '🔊'; }

  // position the on-screen joystick (called each frame)
  updateJoystick(input) {
    const joy = input.joy;
    if (joy.active && input.isTouch) {
      this.el.joystick.classList.remove('hidden');
      this.el.joystick.style.left = joy.ox + 'px';
      this.el.joystick.style.top = joy.oy + 'px';
      this.el.joyKnob.style.left = (50 + joy.dx * 38) + '%';
      this.el.joyKnob.style.top = (50 + joy.dz * 38) + '%';
    } else {
      this.el.joystick.classList.add('hidden');
    }
  }

  closeModals() {
    this.el.story.classList.add('hidden');
    this.el.levelup.classList.add('hidden');
    this.el.howto.classList.add('hidden');
    this.el.glyphGuide.classList.add('hidden');
  }

  setScreen(name) {
    this.el.title.classList.toggle('hidden', name !== 'title');
    this.el.end.classList.toggle('hidden', name !== 'end');
    this.el.hud.classList.toggle('hidden', !(name === 'play'));
  }

  // ---- HUD ----
  updateHUD(game) {
    this.updateJoystick(game.input);
    if (game.phase === 'tavern') return; // tavern shows its own minimal HUD
    const s = game.stats, w = game.wizard;
    const hpPct = Math.max(0, w.hp / s.hpMax) * 100;
    this.el.hpFill.style.width = hpPct + '%';
    this.el.hpLabel.textContent = `HP ${Math.ceil(Math.max(0, w.hp))}/${Math.round(s.hpMax)}`;
    const manaPct = Math.max(0, w.mana / s.manaMax) * 100;
    this.el.manaFill.style.width = manaPct + '%';
    this.el.manaLabel.textContent = `Mana ${Math.floor(w.mana)}/${Math.round(s.manaMax)}`;
    const xpPct = (game.xp / game.xpNeed) * 100;
    this.el.xpFill.style.width = xpPct + '%';
    this.el.xpLabel.textContent = `Lv ${game.level}`;

    const m = Math.floor(game.elapsed / 60), sec = Math.floor(game.elapsed % 60);
    this.el.timer.textContent = `${m}:${sec.toString().padStart(2, '0')}`;
    this.el.kills.textContent = `☠ ${game.kills}`;
    const wob = s.wobble;
    const label = wob <= 0.6 ? '🍵 Tipsy' : (wob <= 1.15 ? '🍺 Sloshed' : '🥴 Hammered');
    this.el.sobriety.textContent = label;

    for (const id of SPELL_ORDER) {
      const chip = this.chips[id];
      if (!chip) continue;
      const frac = game.spells.cooldownFrac(id);
      const poor = w.mana < SPELLS[id].mana;
      chip.classList.toggle('cooling', frac > 0.04 || poor);
    }
  }

  flashSpell(id) {
    const chip = this.chips[id];
    if (!chip) return;
    chip.classList.add('flash');
    setTimeout(() => chip.classList.remove('flash'), 160);
  }

  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    this.el.toastArea.appendChild(t);
    setTimeout(() => t.remove(), 1700);
  }

  // floating damage / pickup number at screen coords (capped so big AoE
  // hits don't flood the DOM with hundreds of nodes)
  floatNumber(x, y, text, color = '#fff') {
    this._floatCount = this._floatCount || 0;
    if (this._floatCount > 36) return;
    this._floatCount++;
    const d = document.createElement('div');
    d.className = 'floatnum';
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.color = color;
    document.body.appendChild(d);
    setTimeout(() => { d.remove(); this._floatCount--; }, 800);
  }

  // ---- Jobs ----
  showJob(title, desc) {
    this.el.jobTracker.classList.remove('hidden');
    this.el.jobTracker.querySelector('.job-title').textContent = title;
    this.el.jobDesc.textContent = desc;
    this.el.jobFill.style.width = '0%';
  }
  updateJob(done, need) { this.el.jobFill.style.width = (done / need * 100) + '%'; }
  hideJob() { this.el.jobTracker.classList.add('hidden'); }

  // ---- Story ----
  showStory(speaker, lines, onDone) {
    this._storyLines = lines.slice();
    this._storyIdx = 0;
    this._storyCb = onDone || null;
    this.el.storySpeaker.textContent = speaker;
    this.el.storyText.textContent = this._storyLines[0] || '';
    this.el.story.classList.remove('hidden');
  }
  _storyAdvance() {
    this._storyIdx++;
    if (this._storyIdx >= this._storyLines.length) {
      this.el.story.classList.add('hidden');
      const cb = this._storyCb; this._storyCb = null;
      if (cb) cb();
    } else {
      this.el.storyText.textContent = this._storyLines[this._storyIdx];
    }
  }

  // ---- Level up ----
  showLevelUp(choices, onPick) {
    this.el.cards.innerHTML = '';
    choices.forEach((u) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-icon">${u.icon}</div>
        <div class="card-name">${u.name}</div>
        <div class="card-desc">${u.desc}</div>
        <div class="card-tag">${u.tag}</div>`;
      card.addEventListener('click', () => {
        this.game.audio.play('click');
        this.el.levelup.classList.add('hidden');
        onPick(u);
      });
      this.el.cards.appendChild(card);
    });
    this.el.levelup.classList.remove('hidden');
  }

  // ---- End ----
  showEnd(win, info) {
    this.el.endTitle.textContent = win ? 'You Survived the Night!' : 'The Wizard Passed Out';
    this.el.endStats.innerHTML = `
      <div>Time staggered: <b>${info.time}</b></div>
      <div>Foes vanquished: <b>${info.kills}</b></div>
      <div>Level reached: <b>${info.level}</b></div>
      <div>Chores done: <b>${info.chores}</b></div>
      <div style="margin-top:8px;color:var(--ink-dim)">${win ? 'The landlady is, grudgingly, impressed.' : 'Tomorrow he\'ll blame the goblins.'}</div>`;
    this.el.end.classList.remove('hidden');
  }
}
