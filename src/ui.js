// ui.js — all the DOM: HUD, story modal, level-up cards, toasts, results,
// and the tavern shop panels (skill tree / cauldron / room / manager).
import { SPELL_ORDER, SPELLS } from './spells.js';
import { TEMPLATES } from './recognizer.js';
import * as meta from './meta.js';
import { STAGES } from './story.js';

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
      btnSettings: $('btn-settings'), btnCredits: $('btn-credits'),
      slots: $('slots'), slotsRow: $('slots-row'), slotsBack: $('slots-back'),
      settings: $('settings'), settingsClose: $('settings-close'), setVol: $('set-vol'), setMute: $('set-mute'), setShake: $('set-shake'), setErase: $('set-erase'),
      credits: $('credits'), creditsClose: $('credits-close'),
      waveWrap: $('wave-wrap'), wavePips: $('wave-pips'),
      minigame: $('minigame'), mgBoard: $('mg-board'), mgScore: $('mg-score'), mgTimer: $('mg-timer'), mgTitle: $('mg-title'), mgSub: $('mg-sub'),
      end: $('end'), endTitle: $('end-title'), endStats: $('end-stats'), btnAgain: $('btn-again'),
      loading: $('loading'),
      bars: document.querySelector('.bars'), spellbook: $('spellbook'), castHint: $('cast-hint'),
      gold: $('gold'), wave: $('wave'), banner: $('banner'), interactPrompt: $('interact-prompt'), btnInteract: $('btn-interact'),
      shop: $('shop'), shopTitle: $('shop-title'), shopGold: $('shop-gold'), shopBody: $('shop-body'), shopClose: $('shop-close'),
      tavernHud: $('tavern-hud'), ruckusCount: $('ruckus-count'),
      btnGuide: $('btn-guide'), btnPause: $('btn-pause'), btnMute: $('btn-mute'),
      joystick: $('joystick'), joyKnob: $('joy-knob'), blackout: $('blackout'),
      glyphGuide: $('glyph-guide'), guideCards: $('guide-cards'), btnGuideClose: $('btn-guide-close'),
    };
    this.chips = {}; // rebuilt per run from the loadout
    this._storyCb = null;
    this._storyLines = [];
    this._storyIdx = 0;
  }

  init(game) {
    this.game = game;
    this.el.btnStart.addEventListener('click', () => { game.audio.resume(); game.audio.play('click'); this.showSlots(); });
    this.el.btnAgain.addEventListener('click', () => { game.audio.play('click'); game.enterTavern(); });
    this.el.btnHow.addEventListener('click', () => { game.audio.play('click'); this.el.howto.classList.toggle('hidden'); });
    this.el.btnHowClose.addEventListener('click', () => { game.audio.play('click'); this.el.howto.classList.add('hidden'); });
    this.el.btnSettings.addEventListener('click', () => { game.audio.resume(); game.audio.play('click'); this.showSettings(); });
    this.el.btnCredits.addEventListener('click', () => { game.audio.play('click'); this.el.credits.classList.remove('hidden'); });
    this.el.creditsClose.addEventListener('click', () => { game.audio.play('click'); this.el.credits.classList.add('hidden'); });
    this.el.slotsBack.addEventListener('click', () => { game.audio.play('click'); this.el.slots.classList.add('hidden'); });
    this.el.slotsRow.addEventListener('click', (e) => {
      const b = e.target.closest('[data-slot]'); if (!b) return;
      const i = parseInt(b.dataset.slot, 10);
      if (b.dataset.erase) { meta.eraseSlot(i); game.audio.play('hiccup'); this._renderSlots(); }
      else { game.audio.play('click'); meta.useSlot(i); this.el.slots.classList.add('hidden'); game.startGame(); }
    });
    this.el.settingsClose.addEventListener('click', () => { game.audio.play('click'); this.el.settings.classList.add('hidden'); });
    this.el.setVol.addEventListener('input', () => { game.audio.resume(); game.audio.setVolume(this.el.setVol.value / 100); });
    this.el.setMute.addEventListener('change', () => { game.audio.setMuted(this.el.setMute.checked); this.setMuteIcon(game.audio.muted); });
    this.el.setShake.addEventListener('change', () => { game.shakeEnabled = this.el.setShake.checked; });
    this.el.setErase.addEventListener('click', () => { meta.eraseSlot(meta.currentSlot()); game.audio.play('hiccup'); this.toast('Save slot erased'); });
    this.el.storyNext.addEventListener('click', () => { game.audio.play('click'); this._storyAdvance(); });
    this.el.btnPause.addEventListener('click', () => { game.audio.play('click'); game.togglePause(); });
    this.el.btnMute.addEventListener('click', () => { game.toggleMute(); });
    this.el.btnGuide.addEventListener('click', () => { game.audio.play('click'); game.toggleGuide(); });
    this.el.btnGuideClose.addEventListener('click', () => { game.audio.play('click'); game.toggleGuide(); });
    this.el.btnInteract.addEventListener('click', () => game.interact());
    this.el.shopClose.addEventListener('click', () => { game.audio.play('click'); game.closeShop(); });
    // shop buttons are delegated (the body is re-rendered on every action)
    this.el.shopBody.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) this._shopAction(b.dataset.act, b.dataset.id, b.dataset.slot);
    });
  }

  // build the spellbook from the 3 equipped spells (keys 1..3) + rebuild guide
  setLoadout(loadout) {
    this.el.spellbook.innerHTML = '';
    this.chips = {};
    loadout.forEach((id, i) => {
      const s = SPELLS[id]; if (!s) return;
      const chip = document.createElement('div');
      chip.className = 'spell-chip'; chip.dataset.spell = id;
      chip.innerHTML = `<span class="glyph">${s.glyph}</span><span class="name">${s.name}</span><span class="key">${i + 1}</span>`;
      chip.addEventListener('click', () => this.game.castById(id));
      this.el.spellbook.appendChild(chip);
      this.chips[id] = chip;
    });
    this.buildGuide(loadout);
  }

  setGold(n) { if (this.el.gold) this.el.gold.textContent = `🪙 ${n}`; if (this.el.shopGold) this.el.shopGold.textContent = `🪙 ${n}`; }

  buildGuide(loadout) {
    if (!this.el.guideCards) return;
    const ids = Array.isArray(loadout) ? loadout : [...loadout];
    this.el.guideCards.innerHTML = '';
    ids.forEach((id, i) => {
      const s = SPELLS[id]; if (!s) return;
      const card = document.createElement('div');
      card.className = 'guide-card';
      const cv = document.createElement('canvas');
      cv.width = 120; cv.height = 120; cv.className = 'guide-cv';
      drawTemplate(cv, TEMPLATES[s.gesture]);
      const label = document.createElement('div');
      label.className = 'guide-label';
      label.innerHTML = `<span class="guide-glyph">${s.glyph}</span> ${s.name} <span class="key">${i + 1}</span>`;
      card.appendChild(cv); card.appendChild(label);
      this.el.guideCards.appendChild(card);
    });
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

  // toggle which HUD bits show for the tavern hub vs the forest fight
  setPhase(phase, isTouch) {
    const tavern = phase === 'tavern';
    this.el.bars.classList.toggle('hidden', tavern);
    this.el.spellbook.classList.toggle('hidden', tavern);
    this.el.sobriety.classList.toggle('hidden', tavern);
    this.el.timer.classList.toggle('hidden', tavern);
    this.el.waveWrap.classList.toggle('hidden', tavern);
    this.el.kills.classList.toggle('hidden', tavern);
    this.el.tavernHud.classList.add('hidden');
    this.el.btnGuide.classList.toggle('hidden', tavern);
    if (!tavern) { this.el.interactPrompt.classList.add('hidden'); this.el.btnInteract.classList.add('hidden'); }
    if (tavern) {
      this.el.castHint.innerHTML = isTouch ? 'Drag the <b>left side</b> to wander · tap glowing stations to use them' : 'Walk up to glowing stations and press <b>E</b> · head to the <b>door</b> to start a run';
    } else {
      this.el.castHint.innerHTML = isTouch ? 'Left = move · <b>draw a glyph</b> on the right to cast · or tap a spell' : 'Hold <b>Right-Mouse</b> and draw a glyph · <b>WASD</b> move · keys <b>1–3</b> · 📖 guide';
    }
  }

  // hub prompt: show what the wizard can interact with
  updatePrompt(station, isTouch) {
    if (station) {
      this.el.interactPrompt.classList.remove('hidden');
      this.el.interactPrompt.innerHTML = isTouch ? `Tap ✋ to use <b>${station.label}</b>` : `Press <b>E</b> to use <b>${station.label}</b>`;
      this.el.btnInteract.classList.toggle('hidden', !isTouch);
      this.el.btnInteract.textContent = station.type === 'door' ? '🚪 Leave' : '✋ Use';
    } else {
      this.el.interactPrompt.classList.add('hidden');
      this.el.btnInteract.classList.add('hidden');
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
    if (game.phase === 'tavern') { // hub: show gold + interaction prompt only
      this.updatePrompt(game.state === 'play' ? game.nearStation : null, game.input.isTouch);
      return;
    }
    const s = game.stats, w = game.wizard;
    const hpPct = Math.max(0, w.hp / s.hpMax) * 100;
    this.el.hpFill.style.height = hpPct + '%';
    this.el.hpLabel.textContent = `${Math.ceil(Math.max(0, w.hp))}${w.shield > 0 ? '+' + Math.ceil(w.shield) : ''}`;
    const manaPct = Math.max(0, w.mana / s.manaMax) * 100;
    this.el.manaFill.style.height = manaPct + '%';
    this.el.manaLabel.textContent = `${Math.floor(w.mana)}`;
    const xpPct = (game.xp / game.xpNeed) * 100;
    this.el.xpFill.style.width = xpPct + '%';
    this.el.xpLabel.textContent = `Lv ${game.level}`;

    const mm = Math.floor(game.elapsed / 60), ss = Math.floor(game.elapsed % 60);
    this.el.timer.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
    const d = game.director;
    if (d && d.active) {
      this.el.waveWrap.classList.remove('hidden');
      this.el.wave.textContent = d.state === 'boss' ? '👑 BOSS' : `Wave ${d.wave}/${d.total}`;
      this._renderPips(d);
    } else this.el.waveWrap.classList.add('hidden');
    this.el.kills.textContent = `☠ ${game.kills}`;
    const wob = s.wobble;
    const label = wob <= 0.6 ? '🍵 Tipsy' : (wob <= 1.15 ? '🍺 Sloshed' : '🥴 Hammered');
    this.el.sobriety.textContent = label;

    for (const id of Object.keys(this.chips)) {
      const chip = this.chips[id];
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

  // ---- Results / loot ----
  showResults(win, info) {
    this.el.endTitle.textContent = win ? `${info.stage} — Cleared!` : 'The Wizard Passed Out';
    const L = info.loot;
    const row = (label, v) => v ? `<div class="loot-row"><span>${label}</span><b>+${v}🪙</b></div>` : '';
    this.el.endStats.innerHTML = `
      <div class="end-summary">${info.stage} · Wave ${info.wave} · ⏱ ${info.time} · ☠ ${info.kills} · Lv ${info.level}</div>
      <div class="loot-box">
        ${row('Survival', L.base)}${row('Foes slain', L.kill)}${row('Waves', L.wave)}${row('Victory', L.win)}
        <div class="loot-row loot-total"><span>Loot earned</span><b>+${L.total}🪙</b></div>
      </div>
      <div class="loot-purse">Purse: <b>${info.gold}🪙</b></div>
      ${info.questDone ? '<div style="color:var(--xp);font-weight:800">✓ Quest complete! Claim it from the Manager.</div>' : ''}
      <div style="margin-top:6px;color:var(--ink-dim)">${win ? 'Spend your loot at the tavern, then pick your next haunt!' : 'Dust yourself off and try again — you keep your loot.'}</div>`;
    this.el.btnAgain.textContent = '▸ Return to the Tavern';
    this.el.end.classList.remove('hidden');
  }

  comboToast(name) {
    const t = document.createElement('div');
    t.className = 'toast crit'; t.textContent = `⚡ COMBO: ${name}!`;
    this.el.toastArea.appendChild(t); setTimeout(() => t.remove(), 1700);
  }

  _renderPips(d) {
    if (this._pipTotal !== d.total) {
      this._pipTotal = d.total; this.el.wavePips.innerHTML = '';
      for (let i = 0; i < d.total; i++) { const p = document.createElement('div'); p.className = 'pip'; this.el.wavePips.appendChild(p); }
    }
    const pips = this.el.wavePips.children;
    const filled = d.state === 'boss' ? d.total : d.wave;
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < filled);
  }

  // ---- save slots ----
  showSlots() { this._renderSlots(); this.el.slots.classList.remove('hidden'); }
  _renderSlots() {
    this.el.slotsRow.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = meta.slotSummary(i);
      const card = document.createElement('div');
      card.className = 'slot-card';
      card.innerHTML = s.exists
        ? `<div class="slot-name">Slot ${i + 1}</div><div class="slot-info">🪙 ${s.gold} · ${s.spells} spells${s.tavern ? ' · 🍺 owner' : ''}</div>
           <button class="shop-btn big" data-slot="${i}">Continue</button>
           <button class="shop-btn" data-slot="${i}" data-erase="1">Erase</button>`
        : `<div class="slot-name">Slot ${i + 1}</div><div class="slot-info">— empty —</div><button class="shop-btn big" data-slot="${i}">New Game</button>`;
      this.el.slotsRow.appendChild(card);
    }
  }

  // ---- settings ----
  showSettings() {
    this.el.setVol.value = Math.round(this.game.audio.volume * 100);
    this.el.setMute.checked = this.game.audio.muted;
    this.el.setShake.checked = this.game.shakeEnabled !== false;
    this.el.settings.classList.remove('hidden');
  }

  // ---- mini-game: serve drinks ----
  showMinigame(durationS, onDone) {
    this._mgScore = 0; this._mgDone = onDone; this._mgEnd = performance.now() + durationS * 1000;
    this.el.mgScore.textContent = '0';
    this.el.mgBoard.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div'); slot.className = 'mg-slot'; slot.dataset.i = i;
      slot.addEventListener('click', () => this._mgServe(slot));
      this.el.mgBoard.appendChild(slot);
    }
    this.el.minigame.classList.remove('hidden');
    clearInterval(this._mgTick); clearInterval(this._mgFill);
    this._mgTick = setInterval(() => {
      const left = Math.max(0, (this._mgEnd - performance.now()) / 1000);
      this.el.mgTimer.textContent = `${left.toFixed(1)}s`;
      if (left <= 0) this._mgFinish();
    }, 100);
    this._mgFill = setInterval(() => {
      const slots = [...this.el.mgBoard.children].filter(s => !s.classList.contains('full'));
      if (slots.length) { const s = slots[Math.floor(Math.random() * slots.length)]; s.classList.add('full'); s.textContent = '🍺'; }
    }, 700);
  }
  _mgServe(slot) {
    if (!slot.classList.contains('full')) return;
    slot.classList.remove('full'); slot.textContent = '';
    this._mgScore++; this.el.mgScore.textContent = this._mgScore;
    this.game.audio.play('xp');
  }
  _mgFinish() {
    clearInterval(this._mgTick); clearInterval(this._mgFill);
    this.el.minigame.classList.add('hidden');
    const cb = this._mgDone; this._mgDone = null;
    if (cb) cb(this._mgScore);
  }

  bannerWave(w, total, isBoss) {
    const el = this.el.banner;
    el.classList.remove('boss');
    el.innerHTML = isBoss ? '<b>FINAL WAVE</b>' : `Wave <b>${w}</b> <span class="banner-sub">of ${total}</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  bossBanner(name) {
    const el = this.el.banner;
    el.classList.add('boss');
    el.innerHTML = `<b>${name}</b><br><span class="banner-sub">approaches…</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  // ---- Shop panels (skill tree / cauldron / room / manager) ----
  openShop(kind, game) {
    this._shopKind = kind;
    this._shopGame = game;
    this.setGold(meta.gold());
    this._renderShop();
    this.el.shop.classList.remove('hidden');
  }
  closeShop() { this.el.shop.classList.add('hidden'); }

  _shopAction(act, id, slot) {
    const g = this._shopGame;
    if (act === 'startrun') { g.startRun(id); return; }
    let ok = false;
    if (act === 'unlock') ok = meta.unlockSpell(id);
    else if (act === 'upgrade') ok = meta.upgradeSpell(id);
    else if (act === 'equip') ok = meta.toggleEquip(id);
    else if (act === 'learn') ok = meta.learnCombo(id);
    else if (act === 'buyroom') ok = meta.buyRoom();
    else if (act === 'buydecor') ok = meta.buyDecor(id);
    else if (act === 'rest') ok = meta.rest();
    else if (act === 'buygear') ok = meta.buyEquip(slot, id);
    else if (act === 'gear') ok = meta.equipItem(slot, id);
    else if (act === 'collect') { const r = meta.collectTavern(); ok = r > 0; if (ok) g.ui.toast(`Collected ${r}🪙`); }
    else if (act === 'tavup') ok = meta.buyTavernUpgrade(id);
    else if (act === 'claim') { const r = meta.claimQuest(); ok = r > 0; if (ok) g.ui.toast(`Quest reward: +${r}🪙`); }
    if (g) g.audio.play(ok ? 'click' : 'hiccup');
    this.setGold(meta.gold());
    this._renderShop();
  }

  _renderShop() {
    const kind = this._shopKind;
    const titles = { skilltree: '✦ Spell Table', cauldron: '🜲 Cauldron', room: '🛏 Your Room', manager: '🍺 Tavern Manager', wardrobe: '🎽 Wardrobe', stage: '🗺 Choose a Stage', ledger: '📒 Tavern Ledger' };
    this.el.shopTitle.textContent = titles[kind] || 'Tavern';
    let html = '';
    if (kind === 'skilltree') html = this._renderSkillTree();
    else if (kind === 'cauldron') html = this._renderCauldron();
    else if (kind === 'room') html = this._renderRoom();
    else if (kind === 'manager') html = this._renderManager();
    else if (kind === 'wardrobe') html = this._renderWardrobe();
    else if (kind === 'stage') html = this._renderStages();
    else if (kind === 'ledger') html = this._renderLedger();
    this.el.shopBody.innerHTML = html;
  }

  _renderLedger() {
    if (!meta.tavernOwned()) return '<p class="shop-sub">Old Tomas\'s ledger. You just <b>work</b> here for now — avenge him (clear a stage) and the Tipsy Toad becomes yours to run.</p>';
    const bank = meta.tavernBank(), cap = meta.tavernCap(), rate = meta.tavernRate();
    let h = `<p class="shop-sub">Your tavern earns <b>${rate}🪙/min</b> even while you\'re away (banked up to <b>${cap}🪙</b>).</p>
      <div class="loot-box" style="max-width:340px;margin:0 auto 14px">
        <div class="loot-row"><span>Banked coin</span><b>${bank} / ${cap}🪙</b></div>
        <div class="shop-acts"><button class="shop-btn big" data-act="collect" ${bank > 0 ? '' : 'disabled'}>Collect ${bank}🪙</button></div>
      </div>
      <div class="shop-grid">`;
    for (const u of meta.TAVERN_UPGRADES) {
      const lvl = meta.tavernUpgradeLevel(u.id), cost = meta.tavernUpgradeCost(u.id);
      h += `<div class="shop-card"><div class="shop-name">${u.name} <span class="lvtag">Lv${lvl}</span></div><div class="shop-desc">${u.desc}</div><div class="shop-acts"><button class="shop-btn" data-act="tavup" data-id="${u.id}" ${meta.canAfford(cost) ? '' : 'disabled'}>Buy ${cost}🪙</button></div></div>`;
    }
    h += '</div>';
    return h;
  }

  _renderStages() {
    let h = '<p class="shop-sub">Pick where to haunt. Each stage has 5 waves and a boss. Bring your best 3 spells!</p><div class="shop-grid">';
    for (const id of Object.keys(STAGES)) {
      const s = STAGES[id];
      h += `<div class="shop-card">
        <div class="shop-name">${s.name}</div>
        <div class="shop-desc">Boss: ${s.bossName}</div>
        <div class="shop-acts"><button class="shop-btn big" data-act="startrun" data-id="${id}">Venture ▸</button></div></div>`;
    }
    h += '</div>';
    return h;
  }

  _renderWardrobe() {
    let h = '<p class="shop-sub">Buy and equip gear — bonuses apply on your next run.</p>';
    for (const slot of meta.EQUIP_SLOTS) {
      h += `<div class="ward-slot"><div class="ward-slot-name">${slot.toUpperCase()}</div><div class="shop-grid">`;
      for (const it of meta.EQUIPMENT[slot]) {
        const owned = meta.ownsEquip(it.id);
        const on = meta.equippedId(slot) === it.id;
        const mods = Object.entries(it.mods).map(([k, v]) => `${v > 0 ? '+' : ''}${k === 'cooldownMult' ? Math.round(v * 100) + '% CD' : k === 'damageMult' ? Math.round(v * 100) + '% dmg' : v + ' ' + k}`).join(', ') || 'plain';
        let act;
        if (on) act = '<button class="shop-btn on" disabled>✓ Worn</button>';
        else if (owned) act = `<button class="shop-btn" data-act="gear" data-slot="${slot}" data-id="${it.id}">Wear</button>`;
        else act = `<button class="shop-btn" data-act="buygear" data-slot="${slot}" data-id="${it.id}" ${meta.canAfford(it.cost) ? '' : 'disabled'}>Buy ${it.cost}🪙</button>`;
        h += `<div class="shop-card ${owned ? '' : 'locked'}"><div class="shop-name">${it.name}</div><div class="shop-desc">${mods}</div><div class="shop-acts">${act}</div></div>`;
      }
      h += '</div></div>';
    }
    return h;
  }

  _renderSkillTree() {
    const eq = meta.getLoadout();
    let h = '<p class="shop-sub">Unlock & upgrade spells, then equip up to <b>3</b> (these are your run loadout).</p><div class="shop-grid">';
    for (const id of meta.SPELL_LIST) {
      const m = meta.SPELL_META[id];
      const owned = meta.owns(id);
      const lvl = meta.spellLevel(id);
      const equipped = eq.includes(id);
      let action = '';
      if (!owned) {
        action = `<button class="shop-btn" data-act="unlock" data-id="${id}" ${meta.canAfford(m.unlock) ? '' : 'disabled'}>Unlock ${m.unlock}🪙</button>`;
      } else {
        const up = lvl >= meta.MAX_LEVEL ? `<button class="shop-btn" disabled>MAX</button>` :
          `<button class="shop-btn" data-act="upgrade" data-id="${id}" ${meta.canAfford(meta.levelCost(lvl)) ? '' : 'disabled'}>Lv${lvl}→${lvl + 1} · ${meta.levelCost(lvl)}🪙</button>`;
        const eqBtn = `<button class="shop-btn ${equipped ? 'on' : ''}" data-act="equip" data-id="${id}">${equipped ? '✓ Equipped' : 'Equip'}</button>`;
        action = up + eqBtn;
      }
      h += `<div class="shop-card ${owned ? '' : 'locked'}">
        <div class="shop-glyph">${m.glyph}</div>
        <div class="shop-name">${m.name}${owned ? ` <span class="lvtag">Lv${lvl}</span>` : ''}</div>
        <div class="shop-acts">${action}</div></div>`;
    }
    h += '</div>';
    return h;
  }

  _renderCauldron() {
    let h = '<p class="shop-sub">Brew <b>combos</b>: cast the two glyphs in quick succession in a run (both must be equipped) to unleash them.</p><div class="shop-grid">';
    for (const id of meta.COMBO_LIST) {
      const c = meta.COMBO_META[id];
      const learned = meta.learned(id);
      const haveParts = meta.owns(c.a) && meta.owns(c.b);
      const ga = SPELLS[c.a].glyph, gb = SPELLS[c.b].glyph;
      let action;
      if (learned) action = '<button class="shop-btn on" disabled>✓ Learned</button>';
      else if (!haveParts) action = '<button class="shop-btn" disabled>Need both spells</button>';
      else action = `<button class="shop-btn" data-act="learn" data-id="${id}" ${meta.canAfford(c.cost) ? '' : 'disabled'}>Learn ${c.cost}🪙</button>`;
      h += `<div class="shop-card ${learned ? '' : 'locked'}">
        <div class="shop-glyph">${ga}+${gb}</div>
        <div class="shop-name">${c.name}</div>
        <div class="shop-desc">${c.desc}</div>
        <div class="shop-acts">${action}</div></div>`;
    }
    h += '</div>';
    return h;
  }

  _renderRoom() {
    if (!meta.roomOwned()) {
      return `<p class="shop-sub">A room of your own — rest before a run and decorate it.</p>
        <div class="shop-acts"><button class="shop-btn big" data-act="buyroom" ${meta.canAfford(meta.ROOM_COST) ? '' : 'disabled'}>Buy Room · ${meta.ROOM_COST}🪙</button></div>`;
    }
    let h = `<p class="shop-sub">Rest for a <b>+30 max HP</b> bonus on your next run, and buy decorations.</p>
      <div class="shop-acts"><button class="shop-btn big ${meta.isRested() ? 'on' : ''}" data-act="rest" ${meta.isRested() ? 'disabled' : ''}>${meta.isRested() ? '✓ Rested' : 'Rest (sleep)'}</button></div>
      <div class="shop-grid">`;
    for (const d of meta.DECOR) {
      const owned = meta.ownsDecor(d.id);
      h += `<div class="shop-card ${owned ? '' : 'locked'}">
        <div class="shop-name">${d.name}</div>
        <div class="shop-acts">${owned ? '<button class="shop-btn on" disabled>✓ Placed</button>' : `<button class="shop-btn" data-act="buydecor" data-id="${d.id}" ${meta.canAfford(d.cost) ? '' : 'disabled'}>Buy ${d.cost}🪙</button>`}</div></div>`;
    }
    h += '</div>';
    return h;
  }

  _renderManager() {
    const q = meta.currentQuest();
    const done = meta.questDone();
    return `<p class="shop-sub">"Evenin'. Mind the furniture. Here's a bit of work if you want coin…"</p>
      <div class="quest-box">
        <div class="quest-title">📜 Bounty</div>
        <div class="quest-text">${q.text}</div>
        <div class="quest-reward">Reward: <b>${q.reward}🪙</b></div>
        <div class="shop-acts">${done
          ? '<button class="shop-btn big on" data-act="claim">✓ Claim reward</button>'
          : '<button class="shop-btn big" disabled>Complete it in a run</button>'}</div>
      </div>`;
  }
}
