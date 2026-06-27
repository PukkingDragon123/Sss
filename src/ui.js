// ui.js — all the DOM: HUD, story modal, level-up cards, toasts, results,
// and the tavern shop panels (skill tree / cauldron / room / manager).
import * as THREE from 'three';
import { SPELL_ORDER, SPELLS } from './spells.js';
import { TEMPLATES } from './recognizer.js';
import * as meta from './meta.js';
import { STAGES, STAGE_ORDER } from './story.js';
import { ARTIFACTS, artifactById, UPGRADES } from './upgrades.js';

const $ = (id) => document.getElementById(id);

// world-map regions: position on the map, look, danger tier & loot blurb
const STAGE_MAP = {
  forest:    { x: 12, y: 60, icon: '🌲', tone: '#6ee7a0', danger: 1, loot: 'Common–Rare gear · 🪙' },
  cave:      { x: 26, y: 47, icon: '🦇', tone: '#c9a24a', danger: 2, loot: 'Rare gear · potions · 🪙🪙' },
  graveyard: { x: 41, y: 58, icon: '⚰️', tone: '#8fa0c8', danger: 3, loot: 'Rare–Epic gear · 🪙🪙' },
  swamp:     { x: 54, y: 45, icon: '🐊', tone: '#7fae5a', danger: 4, loot: 'Epic gear · 🪙🪙' },
  frost:     { x: 68, y: 55, icon: '❄️', tone: '#bfe6ff', danger: 5, loot: 'Epic gear · 🪙🪙🪙' },
  inferno:   { x: 82, y: 41, icon: '🔥', tone: '#ff7a3a', danger: 6, loot: 'Epic–Legendary · 🪙🪙🪙' },
  clockwork: { x: 67, y: 24, icon: '🤖', tone: '#5fe0ff', danger: 7, loot: 'Legendary gear · 🪙🪙🪙' },
  void:      { x: 48, y: 12, icon: '🌌', tone: '#b68fff', danger: 8, loot: 'Legendary hoard · 🪙🪙🪙🪙' },
};

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
      manaFill: $('mana-fill'), manaLabel: $('mana-label'), manaFoam: $('mana-foam'),
      xpFill: $('xp-fill'), xpLabel: $('xp-label'),
      drunkWrap: $('drunk-wrap'), drunkFill: $('drunk-fill'),
      nausea: $('nausea'), btnDrink: $('btn-drink'), btnBuild: $('btn-build'),
      drinkBar: $('drink-bar'), drinkBarFill: $('drink-bar-fill'),
      loadscene: $('loadscene'), loadsceneText: $('loadscene-text'),
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
      bossBar: $('boss-bar'), bossBarName: $('boss-bar-name'), bossBarFill: $('boss-bar-fill'),
      minigame: $('minigame'), mgScore: $('mg-score'), mgTitle: $('mg-title'), mgSub: $('mg-sub'),
      mgOrder: $('mg-order'), mgCanvas: $('mg-canvas'), mgPour: $('mg-pour'), mgServe: $('mg-serve'),
      mgAccept: $('mg-accept'), mgServed: $('mg-served'), mgTotal: $('mg-total'), mgQuit: $('mg-quit'),
      mgLeft: $('mg-left'), mgRight: $('mg-right'),
      end: $('end'), endTitle: $('end-title'), endStats: $('end-stats'), btnAgain: $('btn-again'),
      loading: $('loading'),
      bars: document.querySelector('.bars'), spellbook: $('spellbook'), castHint: $('cast-hint'),
      gold: $('gold'), gems: $('gems'), clock: $('clock'), wave: $('wave'), banner: $('banner'), interactPrompt: $('interact-prompt'), btnInteract: $('btn-interact'),
      shop: $('shop'), shopTitle: $('shop-title'), shopGold: $('shop-gold'), shopGems: $('shop-gems'), shopBody: $('shop-body'), shopClose: $('shop-close'),
      tavernHud: $('tavern-hud'), ruckusCount: $('ruckus-count'),
      abilityTray: $('ability-tray'),
      wispBubble: $('wisp-bubble'), wispText: $('wisp-text'),
      questTracker: $('quest-tracker'), qtGoalText: $('qt-goal-text'), qtFill: $('qt-fill'), qtStep: $('qt-step'), qtBounty: $('qt-bounty'),
      archetypePick: $('archetype-pick'), archRow: $('arch-row'), archGo: $('arch-go'),
      pathChoice: $('path-choice'), pathDoors: $('path-doors'), pathTitle: $('path-title'), pathSub: $('path-sub'), pathBoss: $('path-boss'),
      eventModal: $('event-modal'), eventIcon: $('event-icon'), eventTitle: $('event-title'), eventPrompt: $('event-prompt'),
      eventOpts: $('event-opts'), eventSkill: $('event-skill'), skillCanvas: $('skill-canvas'), skillStop: $('skill-stop'),
      artReveal: $('art-reveal'), artRevealIcon: $('art-icon'), artRevealName: $('art-name'), artRevealDesc: $('art-desc'), artClaim: $('art-claim'),
      worldHud: $('world-hud'), worldDetail: $('world-detail'),
      btnGuide: $('btn-guide'), btnPause: $('btn-pause'), btnMute: $('btn-mute'),
      btnQuests: $('btn-quests'), btnInv: $('btn-inv'),
      questPanel: $('quest-panel'), qpBody: $('qp-body'), qpClose: $('qp-close'),
      buildPreview: $('build-preview'), bpCanvas: $('bp-canvas'), bpLabel: $('bp-label'), bpRotate: $('bp-rotate'),
      comboHud: $('combo-hud'), comboN: $('combo-n'),
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
    if (this.el.btnQuests) this.el.btnQuests.addEventListener('click', () => { game.audio.play('click'); this.toggleQuestPanel(game); });
    if (this.el.btnInv) this.el.btnInv.addEventListener('click', () => { game.audio.play('click'); this.openInventory(game); });
    if (this.el.qpClose) this.el.qpClose.addEventListener('click', () => { game.audio.play('click'); this.el.questPanel.classList.remove('show'); });
    if (this.el.questPanel) this.el.questPanel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'paydebt') {
        const p = meta.payDebt(meta.gold());
        if (p > 0) { this.toast(`💰 Paid ${p} gold off the debt`); this.setGold(meta.gold()); if (meta.debt() <= 0) game.onDebtCleared(); }
        else this.wispSay('No gold to pay with yet. Work the bar or finish a bounty.', { tone: 'warn' });
      } else if (act === 'claim') {
        const res = meta.claimQuest();
        if (res && res.reward > 0) { this.toast(`Bounty reward: +${res.reward} gold`); this.setGold(meta.gold()); if (res.unlocked) this.wispSay(`🔓 Unlocked the ${meta.FEATURE_LABELS[res.unlocked]}. Build it up in your room!`, { big: true, ms: 4200 }); }
      }
      this.renderQuestPanel(game);
    });
    this.el.btnGuideClose.addEventListener('click', () => { game.audio.play('click'); game.toggleGuide(); });
    this.el.btnInteract.addEventListener('click', () => game.interact());
    if (this.el.btnDrink) this.el.btnDrink.addEventListener('click', () => game.drink());
    if (this.el.btnBuild) this.el.btnBuild.addEventListener('click', () => game.openBuild());
    this.el.shopClose.addEventListener('click', () => { game.audio.play('click'); game.closeShop(); });
    if (this.el.bpRotate) this.el.bpRotate.addEventListener('click', () => { game.audio.play('click'); this._buildRot = ((this._buildRot || 0) + Math.PI / 2) % (Math.PI * 2); this.burstFX(this.el.bpRotate, 'sparkle', 5); });
    // shop buttons are delegated (the body is re-rendered on every action)
    this.el.shopBody.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) this._shopAction(b.dataset.act, b.dataset.id, b.dataset.slot);
    });
    // path doors: pick one to enter (combat resumes beyond it)
    if (this.el.pathDoors) this.el.pathDoors.addEventListener('click', (e) => {
      const d = e.target.closest('[data-door]'); if (!d) return;
      game.audio.play('click'); game.choosePath(parseInt(d.dataset.door, 10));
    });
    // choice-event options + skill-trial stop
    if (this.el.eventOpts) this.el.eventOpts.addEventListener('click', (e) => {
      const b = e.target.closest('[data-opt]'); if (!b || b.disabled) return;
      game.resolveEvent(parseInt(b.dataset.opt, 10));
    });
    if (this.el.skillStop) this.el.skillStop.addEventListener('click', () => this.stopSkill());
    if (this.el.artClaim) this.el.artClaim.addEventListener('click', () => { game.audio.play('click'); const cb = this._artRevealDone; this._artRevealDone = null; this.el.artReveal.classList.add('hidden'); if (cb) cb(); });
    // world-map HUD: Venture / Back buttons (region selection itself is 3D clicks)
    if (this.el.worldDetail) this.el.worldDetail.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      if (b.dataset.act === 'venture') this.game.ventureSelected();
      else if (b.dataset.act === 'back') { this.game.audio.play('click'); this.game.closeWorldMap(); }
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

  setGold(n) { if (this.el.gold) this.el.gold.textContent = `🪙 ${n}`; if (this.el.shopGold) this.el.shopGold.textContent = `🪙 ${n}`; this.setGems(meta.gems()); }

  // ---- the quest log side panel (debt + bounty + the learn-the-ropes checklist) ----
  toggleQuestPanel(game) {
    const p = this.el.questPanel; if (!p) return;
    if (p.classList.contains('show')) { p.classList.remove('show'); return; }
    this.renderQuestPanel(game); p.classList.add('show');
  }
  openInventory(game) { this._libTab = 'inventory'; if (game._openShop) game._openShop('library'); else this.openShop('library', game); }
  renderQuestPanel(game) {
    const body = this.el.qpBody; if (!body) return;
    const debt = meta.debt(), total = meta.DEBT_TOTAL || 1, paid = Math.max(0, total - debt);
    const q = meta.currentQuest(), done = meta.questDone(), prog = meta.tutorialProgress();
    let h = `<div class="qp-card"><h4>⚜ Main Quest: The Tavern Debt</h4>
      <p class="qp-sub">Pay Barkeep Tomas back and the Tipsy Toad is yours.</p>
      <div class="debt-bar"><div class="debt-fill" style="width:${100 * paid / total}%"></div></div>
      <div class="qp-progress">${paid} / ${total} gold paid</div>`;
    h += debt > 0
      ? `<div class="shop-acts" style="margin-top:8px"><button class="shop-btn" data-act="paydebt" ${meta.gold() > 0 ? '' : 'disabled'}>Pay ${Math.min(meta.gold(), debt)} gold</button></div></div>`
      : `<div class="qp-progress" style="color:var(--xp)">Debt cleared. The Toad is yours!</div></div>`;
    h += `<div class="qp-card"><h4>📌 Bounty</h4>
      <p class="qp-sub">${q ? q.text + ' (reward ' + q.reward + ' gold)' : 'No bounty right now.'}</p>
      <div class="shop-acts"><button class="shop-btn ${done ? 'on' : ''}" data-act="claim" ${done ? '' : 'disabled'}>${done ? 'Claim reward' : 'In progress'}</button></div></div>`;
    h += `<div class="qp-card"><h4>🧭 Learn the Ropes</h4>
      <p class="qp-sub">Try every part of the realm. The wisp will guide you.</p><div class="qp-tasklist">`;
    for (const t of meta.tutorialChecklist()) h += `<div class="qp-task ${t.done ? 'done' : ''}"><span class="tick">${t.done ? '✓' : '○'}</span><span>${t.text}</span></div>`;
    h += `</div><div class="qp-progress">${prog.done} / ${prog.total} mechanics tried</div></div>`;
    body.innerHTML = h;
  }
  setGems(n) { if (this.el.gems) this.el.gems.textContent = `💎 ${n}`; if (this.el.shopGems) this.el.shopGems.textContent = `💎 ${n}`; }
  setClock(day) { if (this.el.clock) this.el.clock.textContent = `☀️ Day ${day}`; }

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

  // ---- channeled drink progress bar ----
  showDrinkBar() { if (this.el.drinkBar) { this.el.drinkBarFill.style.width = '0%'; this.el.drinkBar.classList.remove('hidden'); } }
  setDrinkProg(f) { if (this.el.drinkBarFill) this.el.drinkBarFill.style.width = Math.round(f * 100) + '%'; }
  hideDrinkBar() { if (this.el.drinkBar) this.el.drinkBar.classList.add('hidden'); }

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

  // drunk nausea: fade a swimming, blurry vignette in proportion to how sloshed
  // the spirit is. Lives over the canvas but under the menus.
  _updateNausea(game) {
    const el = this.el.nausea; if (!el) return;
    const d = Math.min(1.25, (game.drunkenness || 0) + (game._drunkSurge || 0) * 0.6);
    const active = (game.state === 'play' || game.state === 'paused' || game.storyShowing) && d > 0.02;
    el.style.opacity = active ? Math.min(0.92, 0.18 + d * 0.7).toFixed(3) : '0';
    el.style.setProperty('--n', d.toFixed(3));
  }

  // toggle which HUD bits show for the bar / room / world map / fight
  setPhase(phase, isTouch) {
    const arena = phase === 'arena', world = phase === 'world', tavern = phase === 'tavern', room = phase === 'room';
    const hub = tavern || room || world;
    this.el.bars.classList.toggle('hidden', hub);        // vitals only in the fight
    this.el.spellbook.classList.toggle('hidden', !arena);
    this.el.sobriety.classList.toggle('hidden', !arena);
    this.el.timer.classList.toggle('hidden', !arena || isTouch);  // calmer fight HUD on phones
    this.el.kills.classList.toggle('hidden', !arena || isTouch);
    if (this.el.clock) this.el.clock.classList.toggle('hidden', arena); // clock shows in the hubs
    this.el.waveWrap.classList.add('hidden');
    if (this.el.bossBar) this.el.bossBar.classList.add('hidden');
    this.el.tavernHud.classList.add('hidden');
    this.el.btnGuide.classList.toggle('hidden', !arena);
    if (this.el.btnQuests) this.el.btnQuests.classList.toggle('hidden', !(tavern || room)); // quest log + satchel in the hub
    if (this.el.btnInv) this.el.btnInv.classList.toggle('hidden', !(tavern || room));
    if (this.el.questPanel && !(tavern || room)) this.el.questPanel.classList.remove('show');
    if (this.el.btnDrink) this.el.btnDrink.classList.toggle('hidden', !arena); // drink only in the fight
    if (this.el.drinkBar && !arena) this.el.drinkBar.classList.add('hidden');
    if (this.el.btnBuild) this.el.btnBuild.classList.toggle('hidden', !room);  // build only in your room
    if (this.el.abilityTray) this.el.abilityTray.classList.toggle('hidden', !arena || !this.el.abilityTray.innerHTML);
    if (this.el.drunkWrap) this.el.drunkWrap.classList.toggle('hidden', !arena);
    if (!arena) this.hideCombo();   // never let the combo counter linger outside a fight
    if (this.el.questTracker) { this.el.questTracker.classList.toggle('hidden', !(tavern || room)); this._qtSig = null; } // main-quest tracker in the hub
    if (!world) this.hideWorldHud();
    if (!arena && !world) { this.el.interactPrompt.classList.add('hidden'); this.el.btnInteract.classList.add('hidden'); }
    if (tavern) this.el.castHint.innerHTML = isTouch ? 'Wander to a <b>table</b> for an order, pour at the <b>bar</b>, carry it back · 🪜 room · 🚪 venture' : 'Take an order at a <b>table</b>, pour at the <b>bar</b>, carry it back to <b>serve</b> for tips · <b>🚪</b> venture · <b>🪜</b> room · press <b>E</b>';
    else if (room) this.el.castHint.innerHTML = isTouch ? 'Tap <b>🔨 Build</b> to place stations & furniture · tap a station to use it' : 'Press <b>🔨 Build</b> to craft & place stations · walk to one and press <b>E</b> to use it · stairs to go down';
    else if (world) this.el.castHint.innerHTML = isTouch ? 'Tap a <b>region</b> to scout it · then <b>Venture</b>' : 'Click a <b>region</b> to scout it · then <b>Venture</b>';
    else this.el.castHint.innerHTML = isTouch ? 'Left = move · <b>draw a glyph</b> on the right to cast · 🍺 hold to chug (fills mana)' : 'Hold <b>Right-Mouse</b> and draw a glyph · <b>WASD</b> move · <b>Q</b> to chug (fills mana) · keys <b>1–3</b>';
  }

  showLoadScene(text) { if (this.el.loadscene) { if (this.el.loadsceneText) this.el.loadsceneText.textContent = text || 'Loading…'; this.el.loadscene.classList.remove('hidden'); } }
  hideLoadScene() { if (this.el.loadscene) this.el.loadscene.classList.add('hidden'); }

  // update the map's hovered-node info bar
  // ---- the 3D world map HUD: a side panel that scouts the selected region ----
  _wmOrder() { return STAGE_ORDER.filter(id => STAGE_MAP[id] && STAGES[id]); }
  _wmUnlocked(id) { const o = this._wmOrder(), i = o.indexOf(id); return i === 0 || meta.stageCleared(o[i - 1]); }
  showWorldHud(game, id) {
    if (!this.el.worldDetail) return;
    const s = STAGES[id], m = STAGE_MAP[id];
    const order = this._wmOrder(), idx = order.indexOf(id);
    const unlocked = this._wmUnlocked(id), cleared = meta.stageCleared(id);
    const access = cleared ? '<span class="wm-done-t">✓ Conquered</span>' : unlocked ? '<span class="wm-open-t">Open — ready to venture</span>' : `🔒 Clear <b>${STAGES[order[idx - 1]].name}</b> first`;
    this.el.worldDetail.innerHTML = `
      <div class="wmd-head"><span class="wmd-ico" style="color:${m.tone};filter:drop-shadow(0 0 8px ${m.tone})">${unlocked ? m.icon : '🔒'}</span>
        <div><div class="wmd-name" style="color:${m.tone}">${s.name}</div>
        <div class="wmd-sub">Region ${idx + 1} of ${order.length} · 👑 ${s.bossName}</div></div></div>
      <div class="wmd-rows">
        <div class="wmd-row"><span>Danger</span><b>${'💀'.repeat(m.danger)}</b></div>
        <div class="wmd-row"><span>Access</span><b>${access}</b></div>
        <div class="wmd-row"><span>Loot</span><b>${m.loot}</b></div>
      </div>
      <button class="btn big wmd-venture" data-act="venture" ${unlocked ? '' : 'disabled'}>${unlocked ? '▸ Venture here' : '🔒 Locked'}</button>
      <button class="btn wmd-back" data-act="back">◂ Back to the bar</button>`;
    this.el.worldHud.classList.remove('hidden');
  }
  hideWorldHud() { if (this.el.worldHud) this.el.worldHud.classList.add('hidden'); }

  // ---- acquired abilities + artifacts: a stacking tray, top-left ----
  setAbilities(abilities, artifacts) {
    const tray = this.el.abilityTray; if (!tray) return;
    abilities = abilities || []; artifacts = artifacts || [];
    if (!abilities.length && !artifacts.length) { tray.innerHTML = ''; tray.classList.add('hidden'); return; }
    let h = '<div class="abil-label">Abilities</div><div class="abil-row">';
    for (const a of artifacts) h += `<div class="abil art" title="✦ ARTIFACT — ${a.name}"><span class="abil-ico">${a.icon}</span></div>`;
    for (const a of abilities) h += `<div class="abil" title="${a.name}${a.count > 1 ? ` ×${a.count}` : ''}"><span class="abil-ico">${a.icon}</span>${a.count > 1 ? `<span class="abil-x">${a.count}</span>` : ''}</div>`;
    h += '</div>';
    tray.innerHTML = h;
    tray.classList.toggle('hidden', !(this.game && this.game.phase === 'arena'));
  }

  // ---- Slay-the-Spire-style fork: pick the LEFT or RIGHT door; each previews its node ----
  showPathChoice(game, opts) {
    const { bossNext, stage, nodes, artifact, cur, total } = opts;
    this.el.pathTitle.textContent = bossNext ? 'The Boss Lair Awaits' : 'Choose Your Path';
    this.el.pathSub.innerHTML = bossNext
      ? 'Beyond either door waits the boss — and the relic it guards. Pick your way in:'
      : `Two ways through the dark forest — <b>left or right</b>. ${total ? `Step ${cur}/${total}. ` : ''}Each door shows what waits…`;
    if (bossNext && artifact) {
      this.el.pathBoss.classList.remove('hidden');
      this.el.pathBoss.innerHTML = `👑 <b>${stage.bossName}</b> guards a relic — clear the lair to claim <span class="pb-art">✦ ${artifact.name}</span>`;
    } else this.el.pathBoss.classList.add('hidden');
    this.el.pathDoors.innerHTML = '';
    this._pathDoors = [];
    const sides = ['◂ LEFT', 'RIGHT ▸'];
    nodes.forEach((n, i) => {
      const door = document.createElement('div'); door.className = 'path-door'; door.dataset.door = i;
      const side = document.createElement('div'); side.className = 'door-side'; side.textContent = sides[i] || 'Enter';
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 150; cv.className = 'door-art';
      const lurk = document.createElement('div'); lurk.className = 'door-lurk'; lurk.textContent = n.lurk || '👁 something lurks within…';
      const node = document.createElement('div'); node.className = 'door-reward';
      node.innerHTML = `<span class="door-ico">${n.icon}</span><div class="door-rw-txt"><div class="door-name">${n.name}</div><div class="door-desc">${n.desc}</div></div>`;
      const btn = document.createElement('button'); btn.className = 'btn big door-go'; btn.textContent = (n.type === 'combat' || n.type === 'elite') ? 'Enter ▸' : 'Go ▸';
      door.appendChild(side); door.appendChild(cv); door.appendChild(lurk); door.appendChild(node); door.appendChild(btn);
      this.el.pathDoors.appendChild(door);
      this._pathDoors.push(this._makeDoorArt(cv, i, bossNext || n.type === 'elite'));
    });
    this.el.pathChoice.classList.remove('hidden');
    if (!this._pathLoopBound) this._pathLoopBound = this._pathLoop.bind(this);
    cancelAnimationFrame(this._pathRaf); this._pathT = 0;
    this._pathRaf = requestAnimationFrame(this._pathLoopBound);
  }
  hidePathChoice() {
    this.el.pathChoice.classList.add('hidden');
    cancelAnimationFrame(this._pathRaf); this._pathDoors = null;
  }
  _makeDoorArt(cv, idx, boss) {
    const W = cv.width, H = cv.height;
    const trees = [];
    const n = 8 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) trees.push({ x: Math.random() * W, w: 20 + Math.random() * 30, h: 55 + Math.random() * 80 });
    trees.sort((a, b) => a.h - b.h); // shorter ones drawn behind
    const creatures = [];
    const cn = boss ? 1 : 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < cn; i++) creatures.push({ x: 44 + Math.random() * (W - 88), y: H * 0.5 + Math.random() * H * 0.3, phase: Math.random() * 6.28, blink: Math.random() * 3, sep: boss ? 9 : 5 + Math.random() * 3, sz: boss ? 3.6 : 1.8 + Math.random() * 1.1 });
    return { canvas: cv, ctx: cv.getContext('2d'), trees, creatures, boss };
  }
  _pathLoop() {
    if (!this._pathDoors) return;
    this._pathT += 0.016;
    for (const d of this._pathDoors) this._drawDoorArt(d, this._pathT);
    this._pathRaf = requestAnimationFrame(this._pathLoopBound);
  }
  _drawDoorArt(d, t) {
    const ctx = d.ctx, W = d.canvas.width, H = d.canvas.height;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (d.boss) { sky.addColorStop(0, '#1a0608'); sky.addColorStop(1, '#070203'); }
    else { sky.addColorStop(0, '#0a1018'); sky.addColorStop(1, '#04060b'); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // moon glow
    const mg = ctx.createRadialGradient(W * 0.5, H * 0.12, 3, W * 0.5, H * 0.12, 90);
    mg.addColorStop(0, d.boss ? 'rgba(210,90,70,0.5)' : 'rgba(150,170,210,0.45)'); mg.addColorStop(1, 'transparent');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
    // tree silhouettes (layered pines)
    for (const tr of d.trees) {
      const baseY = H + 4, depth = tr.h / 135;
      ctx.fillStyle = `rgb(${Math.round(4 + depth * 8)},${Math.round(8 + depth * 10)},${Math.round(5 + depth * 7)})`;
      for (let s = 0; s < 3; s++) {
        const hh = tr.h * (1 - s * 0.26), ww = tr.w * (1 - s * 0.18), cy = baseY - tr.h * 0.5 * s;
        ctx.beginPath(); ctx.moveTo(tr.x, cy - hh); ctx.lineTo(tr.x - ww / 2, cy); ctx.lineTo(tr.x + ww / 2, cy); ctx.closePath(); ctx.fill();
      }
    }
    // creeping mist
    ctx.save(); ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * 1.3);
    ctx.fillStyle = '#7fa0b0'; ctx.fillRect(0, H * 0.7, W, H * 0.3); ctx.restore();
    // lurking red eyes
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const c of d.creatures) {
      const period = 2.8 + c.blink; const bc = (t + c.phase * 0.5) % period;
      let open = 1; if (bc > period - 0.16) open = Math.max(0, (period - bc) / 0.16);
      const pulse = 0.55 + 0.45 * Math.sin(t * 3 + c.phase);
      for (const dx of [-c.sep, c.sep]) {
        const ex = c.x + dx, ey = c.y;
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 14 + pulse * 8);
        g.addColorStop(0, `rgba(255,40,26,${0.85 * open})`); g.addColorStop(0.5, `rgba(220,20,16,${0.4 * open})`); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 18 + pulse * 6, 0, 6.28); ctx.fill();
        ctx.fillStyle = `rgba(255,${Math.round(120 + pulse * 80)},90,${open})`;
        ctx.beginPath(); ctx.ellipse(ex, ey, c.sz, c.sz * (0.4 + 0.6 * open), 0, 0, 6.28); ctx.fill();
      }
    }
    ctx.restore();
    // vignette frame
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, W, H);
  }

  // ---- choice event (Slay-the-Spire dilemma) ----
  showChoiceEvent(game, ev) {
    this.el.eventIcon.textContent = ev.icon || '❓';
    this.el.eventTitle.textContent = ev.title || 'A Mystery';
    this.el.eventPrompt.textContent = ev.prompt || '';
    this.el.eventSkill.classList.add('hidden');
    this.el.eventOpts.classList.remove('hidden');
    this.el.eventOpts.innerHTML = '';
    ev.opts.forEach((o, i) => {
      const afford = !o.minGems || meta.gems() >= o.minGems;
      const b = document.createElement('button');
      b.className = 'btn event-opt'; b.dataset.opt = i; if (!afford) b.disabled = true;
      b.innerHTML = `<span class="eo-label">${o.label}</span><span class="eo-tip">${afford ? (o.tip || '') : 'not enough 💎'}</span>`;
      this.el.eventOpts.appendChild(b);
    });
    this.el.eventModal.classList.remove('hidden');
  }
  // ---- skill event: stop the sweeping marker on the green mark ----
  showSkillEvent(game) {
    this.el.eventIcon.textContent = '✶';
    this.el.eventTitle.textContent = 'Trial of Nerve';
    this.el.eventPrompt.textContent = 'Stop the sweeping marker as close to the golden mark as you can. The steadier your hand, the richer the prize.';
    this.el.eventOpts.classList.add('hidden');
    this.el.eventSkill.classList.remove('hidden');
    this.el.eventModal.classList.remove('hidden');
    this._skill = { pos: 0, dir: 1, speed: 1.15, target: 0.30 + Math.random() * 0.40, stopped: false };
    if (!this._skillLoopBound) this._skillLoopBound = this._skillLoop.bind(this);
    cancelAnimationFrame(this._skillRaf);
    this._skillRaf = requestAnimationFrame(this._skillLoopBound);
  }
  stopSkill() {
    const s = this._skill; if (!s || s.stopped) return;
    s.stopped = true; cancelAnimationFrame(this._skillRaf);
    const quality = Math.max(0, 1 - Math.abs(s.pos - s.target) / 0.5); // 1 = bang on
    this._drawSkill(); // freeze the final frame
    setTimeout(() => this.game.resolveSkill(quality), 350);
  }
  _skillLoop() {
    const s = this._skill; if (!s || s.stopped) return;
    s.pos += s.dir * s.speed * 0.016;
    if (s.pos >= 1) { s.pos = 1; s.dir = -1; } else if (s.pos <= 0) { s.pos = 0; s.dir = 1; }
    this._drawSkill();
    this._skillRaf = requestAnimationFrame(this._skillLoopBound);
  }
  _drawSkill() {
    const s = this._skill, cv = this.el.skillCanvas; if (!s || !cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, pad = 16, bw = W - pad * 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(pad, H / 2 - 12, bw, 24);
    // target zone
    const tx = pad + s.target * bw, half = 0.09 * bw;
    const g = ctx.createLinearGradient(tx - half, 0, tx + half, 0);
    g.addColorStop(0, 'rgba(110,231,160,0)'); g.addColorStop(0.5, 'rgba(110,231,160,.8)'); g.addColorStop(1, 'rgba(110,231,160,0)');
    ctx.fillStyle = g; ctx.fillRect(tx - half, H / 2 - 16, half * 2, 32);
    ctx.strokeStyle = '#6ee7a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, H / 2 - 18); ctx.lineTo(tx, H / 2 + 18); ctx.stroke();
    // marker
    const mx = pad + s.pos * bw;
    ctx.fillStyle = s.stopped ? '#ffcf5c' : '#fff';
    ctx.beginPath(); ctx.moveTo(mx, H / 2 - 20); ctx.lineTo(mx - 7, H / 2 - 30); ctx.lineTo(mx + 7, H / 2 - 30); ctx.closePath(); ctx.fill();
    ctx.fillRect(mx - 2, H / 2 - 18, 4, 36);
    // rails
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.strokeRect(pad, H / 2 - 12, bw, 24);
  }
  hideEvent() {
    cancelAnimationFrame(this._skillRaf); this._skill = null;
    if (this.el.eventModal) this.el.eventModal.classList.add('hidden');
  }

  // ---- the end-of-level artifact reveal: a dramatic, glowing relic screen ----
  showArtifactReveal(a, onDone) {
    this._artRevealDone = onDone || null;
    if (this.el.artRevealIcon) this.el.artRevealIcon.textContent = a ? a.icon : '✦';
    if (this.el.artRevealName) this.el.artRevealName.textContent = a ? a.name : 'A Relic';
    if (this.el.artRevealDesc) this.el.artRevealDesc.textContent = a ? a.desc : '';
    const o = this.el.artReveal; if (!o) { if (onDone) onDone(); return; }
    o.classList.remove('hidden');
    o.classList.remove('show'); void o.offsetWidth; o.classList.add('show'); // restart the entrance
    if (this.game && this.game.audio) this.game.audio.play('win');
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

  // opening rampage objective (reuses the tavern HUD banner)
  showRampage(done, total) {
    if (!this.el.tavernHud) return;
    this.el.tavernHud.classList.remove('hidden');
    const obj = this.el.tavernHud.querySelector('.tavern-obj'); if (obj) obj.textContent = '🍺 SMASH THE TAVERN — wreck it all!';
    if (this.el.ruckusCount) this.el.ruckusCount.textContent = `${done} / ${total}`;
  }

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
    this.hidePathChoice();
  }

  setScreen(name) {
    this.el.title.classList.toggle('hidden', name !== 'title');
    this.el.end.classList.toggle('hidden', name !== 'end');
    this.el.hud.classList.toggle('hidden', !(name === 'play' || name === 'map'));
  }

  // ---- HUD ----
  updateHUD(game) {
    this.updateJoystick(game.input);
    this._updateNausea(game); // queasy overlay — runs in the hubs AND the fight
    if (this.el.gems) this.el.gems.textContent = `💎 ${meta.gems()}`;   // live currency
    if (this.el.clock) this.el.clock.textContent = `☀️ Day ${meta.currentDay()}`;
    if (game.phase === 'tavern' || game.phase === 'room') { // hubs: prompt + main-quest tracker
      this.updatePrompt(game.state === 'play' ? game.nearStation : null, game.input.isTouch);
      this.updateQuestTracker(game);
      return;
    }
    const s = game.stats, w = game.wizard;
    const hpPct = Math.max(0, w.hp / s.hpMax) * 100;
    this.el.hpFill.style.height = hpPct + '%';
    this.el.hpLabel.textContent = `${Math.ceil(Math.max(0, w.hp))}${w.shield > 0 ? '+' + Math.ceil(w.shield) : ''}`;
    const manaPct = Math.max(0, w.mana / s.manaMax) * 100;
    this.el.manaFill.style.height = manaPct + '%';
    if (this.el.manaFoam) this.el.manaFoam.style.bottom = `calc(${manaPct}% - 4px)`;
    this.el.manaLabel.textContent = `${Math.floor(w.mana)}`;
    if (this.el.btnDrink) this.el.btnDrink.classList.toggle('urge', manaPct < 30);
    const xpPct = (game.xp / game.xpNeed) * 100;
    this.el.xpFill.style.width = xpPct + '%';
    this.el.xpLabel.textContent = `Lv ${game.level}`;
    if (this.el.drunkFill) this.el.drunkFill.style.width = Math.min(100, (game.drunkenness || 0) * 100) + '%';

    const mm = Math.floor(game.elapsed / 60), ss = Math.floor(game.elapsed % 60);
    this.el.timer.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
    const d = game.director;
    if (d && d.active) {
      this.el.waveWrap.classList.remove('hidden');
      this.el.wave.textContent = d.state === 'boss' ? '👑 BOSS' : `Wave ${d.wave}/${d.total}`;
      this._renderPips(d);
    } else this.el.waveWrap.classList.add('hidden');
    this.el.kills.textContent = `☠ ${game.kills}`;
    // boss health bar
    const be = game._bossEnemy;
    if (this.el.bossBar) {
      if (game.bossActive && be && be.alive) {
        this.el.bossBar.classList.remove('hidden');
        this.el.bossBarName.textContent = `👑 ${game.stage ? game.stage.bossName : 'Boss'}`;
        this.el.bossBarFill.style.width = `${Math.max(0, be.hp / be.maxHp) * 100}%`;
      } else this.el.bossBar.classList.add('hidden');
    }
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

  // a quick spray of little DOM motes (sparkle / bubble / fire / gem) at an element or {x,y}
  burstFX(anchor, type = 'sparkle', count = 8) {
    let cx, cy;
    if (anchor && anchor.getBoundingClientRect) { const r = anchor.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    else if (anchor && typeof anchor.x === 'number') { cx = anchor.x; cy = anchor.y; }
    else return;
    this._fxCount = this._fxCount || 0;
    for (let i = 0; i < count; i++) {
      if (this._fxCount > 80) break;
      this._fxCount++;
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.7;
      const dist = 24 + Math.random() * 38;
      const s = document.createElement('div');
      s.className = 'fx-burst ' + type;
      s.style.setProperty('--x', cx.toFixed(0) + 'px');
      s.style.setProperty('--y', cy.toFixed(0) + 'px');
      s.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(0) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * dist - (type === 'bubble' ? 34 : 8)).toFixed(0) + 'px');
      s.style.setProperty('--fxdur', (0.5 + Math.random() * 0.35).toFixed(2) + 's');
      const px = (8 + Math.random() * 8).toFixed(0) + 'px'; s.style.width = px; s.style.height = px;
      document.body.appendChild(s);
      setTimeout(() => { s.remove(); this._fxCount--; }, 920);
    }
  }

  // punchy kill-combo counter
  showCombo(n) {
    const h = this.el.comboHud; if (!h) return;
    this.el.comboN.textContent = 'x' + n;
    h.classList.add('show');
    h.classList.remove('punch'); void h.offsetWidth; h.classList.add('punch');
    clearTimeout(this._comboT);
    this._comboT = setTimeout(() => h.classList.remove('show'), 1500);
  }
  hideCombo() { if (this.el.comboHud) { this.el.comboHud.classList.remove('show'); clearTimeout(this._comboT); } }

  // the wisp speaks — a cozy, non-blocking bubble for warnings & tips (replaces blunt toasts).
  // tone:'warn' tints the edge red; big:true makes the wisp "zoom in" with a bigger pop for key tips.
  wispSay(text, opts = {}) {
    const { ms = 2600, tone = 'tip', big = false } = opts;
    const b = this.el.wispBubble; if (!b) { this.toast(text); return; }
    this.el.wispText.textContent = text;
    b.classList.toggle('warn', tone === 'warn');
    b.classList.toggle('big', !!big);
    b.classList.remove('hidden');
    void b.offsetWidth;                 // reflow so a repeated line re-animates
    b.classList.add('show');
    clearTimeout(this._wispT);
    this._wispT = setTimeout(() => { b.classList.remove('show'); setTimeout(() => b.classList.add('hidden'), 220); }, ms);
  }

  // persistent main-quest tracker — read-only over meta; repaint only when the state signature changes
  updateQuestTracker(game) {
    const t = this.el.questTracker; if (!t || t.classList.contains('hidden')) return;
    const debt = meta.debt(), total = meta.DEBT_TOTAL || 1;
    const q = meta.currentQuest(), done = meta.questDone();
    const featSig = (meta.FEATURE_ORDER || []).map(f => meta.featureUnlocked(f) ? 1 : 0).join('');
    const sig = `${debt}|${done ? 1 : 0}|${q ? q.id : '-'}|${meta.gold()}|${featSig}`;
    if (sig === this._qtSig) return; this._qtSig = sig;
    this.el.qtGoalText.textContent = debt > 0 ? 'Pay off the Tavern Debt' : 'The Toad is yours — adventure on!';
    this.el.qtFill.style.width = (100 * Math.max(0, total - debt) / total) + '%';
    // a just-unlocked feature whose station isn't built yet takes priority — names exactly what to do next
    let unbuilt = null;
    for (const f of (meta.FEATURE_ORDER || [])) {
      if (meta.featureUnlocked(f)) { const b = meta.BUILDABLES.find(x => x.feature === f); if (b && !meta.stationBuilt(b.id)) { unbuilt = b; break; } }
    }
    let step;
    if (done) step = 'Claim your bounty in the 📜 quest log';
    else if (unbuilt) step = `Build the ${unbuilt.name} up in your 🪜 room`;
    else if (debt > 0 && meta.gold() < debt) step = 'Earn coin: serve at the 🍺 Bar or finish a bounty';
    else if (debt > 0) step = 'Pay it down in the 📜 quest log';
    else step = 'Venture out and grow stronger';
    this.el.qtStep.textContent = '➤ ' + step;
    this.el.qtBounty.textContent = q ? `Bounty: ${q.text} (+${q.reward}🪙)${done ? ' ✓' : ''}` : '';
  }

  // playstyle picker shown before a venture; cb(id) proceeds with the chosen archetype
  showArchetypePick(list, current, cb) {
    const row = this.el.archRow; if (!row || !this.el.archetypePick) { cb(current); return; }
    const ELCOL = { fire: '#ff7a3a', water: '#7fe0ff', air: '#9fe8ff', earth: '#c9a06a' };
    row.innerHTML = '';
    let sel = current || (list[0] && list[0].id);
    const cards = {};
    for (const a of list) {
      const c = document.createElement('div');
      c.className = 'arch-card' + (a.id === sel ? ' sel' : '');
      c.style.setProperty('--el', ELCOL[a.element] || '#ffcf5c');
      c.innerHTML = `<div class="arch-ico">${a.icon}</div><div class="arch-name">${a.name}</div><div class="arch-desc">${a.desc}</div>`;
      c.addEventListener('click', () => { sel = a.id; for (const k in cards) cards[k].classList.toggle('sel', k === a.id); });
      row.appendChild(c); cards[a.id] = c;
    }
    this.el.archGo.onclick = () => { this.el.archetypePick.classList.add('hidden'); cb(sel); };
    this.el.archetypePick.classList.remove('hidden');
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
      card.className = 'card' + (u.unique ? ' card-unique' : '');
      card.innerHTML = `
        ${u.unique ? '<div class="card-ribbon">✦ UNIQUE ✦</div>' : ''}
        <div class="card-icon">${u.icon}</div>
        <div class="card-name">${u.name}</div>
        <div class="card-desc">${u.desc}</div>
        <div class="card-tag">${u.tag}</div>`;
      card.addEventListener('click', () => {
        this.game.audio.play('click');
        this.burstFX(card, 'sparkle', 14);
        this.el.levelup.classList.add('hidden');
        onPick(u);
      });
      this.el.cards.appendChild(card);
    });
    this.el.levelup.classList.remove('hidden');
  }

  // ---- Results / loot ----
  showResults(win, info) {
    this.el.endTitle.textContent = win ? `${info.stage} — Conquered!` : 'The Wizard Passed Out';
    this.el.endStats.innerHTML = `
      <div class="end-summary">${info.stage} · 🚪 ${info.rooms} rooms · ☠ ${info.kills} · Lv ${info.level} · ☀️ Day ${info.day}${info.combo >= 5 ? ` · 🔥 best combo x${info.combo}` : ''}</div>
      ${info.artifact ? `<div class="end-artifact">✦✦ Claimed artifact: <b>${info.artifact}</b></div>` : ''}
      ${info.research ? `<div class="end-artifact" style="color:var(--mana)">🔬 Research complete: <b>${info.research}</b></div>` : ''}
      <div class="loot-box">
        <div class="loot-row loot-total"><span>Gems won</span><b>+${info.earnedGems}💎</b></div>
      </div>
      <div class="loot-purse">Gems: <b>${info.gems}💎</b> · spend them on spells & research</div>
      ${info.questDone ? '<div style="color:var(--xp);font-weight:800">✓ Bounty complete! Claim it in your 📜 quest log.</div>' : ''}
      <div style="margin-top:6px;color:var(--ink-dim)">${win ? 'Back at the tavern: research, learn spells, then work a shift for coin!' : 'You keep every gem you won. Regroup and try again.'}</div>`;
    this.el.btnAgain.textContent = '▸ Return to the Tavern';
    this.el.end.classList.remove('hidden');
  }

  comboToast(name) {
    const t = document.createElement('div');
    t.className = 'toast crit'; t.textContent = `⚡ COMBO: ${name}!`;
    this.el.toastArea.appendChild(t); this.burstFX(t, 'fire', 12); setTimeout(() => t.remove(), 1700);
  }
  lootToast(gear) {
    const rc = meta.RARITIES[gear.rarity];
    const t = document.createElement('div');
    t.className = 'toast'; t.style.color = rc.color; t.style.borderColor = rc.color;
    t.textContent = `🎁 ${rc.name} ${gear.name}!`;
    this.el.toastArea.appendChild(t); this.burstFX(t, 'gem', 10); setTimeout(() => t.remove(), 1900);
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

  // ---- Tavern serving: take an order, pour to the line, then CARRY it across the
  // bar without tipping the mug over, and serve. Tip = pour accuracy + steady carry. ----
  showBar(onDone) {
    const M = this._bar = {
      done: onDone, served: 0, total: 4, tips: 0,
      liquid: 0, foam: 0, pouring: false, overflow: 0,
      target: 0, tol: 0, phase: 'order', // order -> pour -> carry -> served
      patron: 0, last: performance.now(), anim: 0,
      dist: 0, angle: 0, av: 0, carrySpill: 0, gustT: 0, leftHeld: false, rightHeld: false, pourMiss: 0,
    };
    this.el.mgTitle.textContent = '🍺 Tend the Bar';
    this.el.mgSub.innerHTML = 'Take the order, <b>hold to pour</b> to the line, then <b>carry it over</b> — tap <b>◀ / ▶</b> (or A/D) to keep the mug level. A clean pour AND a steady carry earn the fattest tip.';
    this.el.mgScore.textContent = '0';
    this.el.mgServed.textContent = '0';
    this.el.mgTotal.textContent = M.total;
    this.el.minigame.classList.remove('hidden');
    this._barNewOrder();

    // pour control: hold the button; carry control: hold ◀ / ▶
    const down = (e) => { if (this._bar && this._bar.phase === 'pour') { this._bar.pouring = true; if (e && e.preventDefault) e.preventDefault(); } };
    const upp = () => { if (this._bar) { this._bar.pouring = false; this._bar.leftHeld = false; this._bar.rightHeld = false; } };
    const lDown = (e) => { if (this._bar) this._bar.leftHeld = true; if (e && e.preventDefault) e.preventDefault(); };
    const rDown = (e) => { if (this._bar) this._bar.rightHeld = true; if (e && e.preventDefault) e.preventDefault(); };
    const key = (v) => (e) => { if (!this._bar || this._bar.phase !== 'carry') return; const k = (e.key || '').toLowerCase(); if (k === 'a' || k === 'arrowleft') this._bar.leftHeld = v; else if (k === 'd' || k === 'arrowright') this._bar.rightHeld = v; };
    this._barDown = down; this._barUp = upp; this._barLDown = lDown; this._barRDown = rDown;
    this._barKeyDown = key(true); this._barKeyUp = key(false);
    this.el.mgPour.addEventListener('pointerdown', down);
    this.el.mgPour.addEventListener('pointercancel', upp);
    this.el.mgLeft.addEventListener('pointerdown', lDown);
    this.el.mgRight.addEventListener('pointerdown', rDown);
    window.addEventListener('pointerup', upp);
    window.addEventListener('keydown', this._barKeyDown);
    window.addEventListener('keyup', this._barKeyUp);
    this.el.mgServe.onclick = () => this._barServe();
    this.el.mgAccept.onclick = () => this._barAccept();
    this.el.mgQuit.onclick = () => this._barFinish();
    if (!this._barLoopBound) { this._barLoopBound = this._barLoop.bind(this); }
    cancelAnimationFrame(this._barRaf);
    this._barRaf = requestAnimationFrame(this._barLoopBound);
  }

  _barShow(pour, serve, left, right, accept) {
    this.el.mgPour.classList.toggle('hidden', !pour);
    this.el.mgServe.classList.toggle('hidden', !serve);
    this.el.mgLeft.classList.toggle('hidden', !left);
    this.el.mgRight.classList.toggle('hidden', !right);
    this.el.mgAccept.classList.toggle('hidden', !accept);
  }
  _barNewOrder() {
    const M = this._bar; if (!M) return;
    M.phase = 'order'; M.liquid = 0; M.foam = 0; M.pouring = false; M.overflow = 0;
    M.dist = 0; M.angle = 0; M.av = 0; M.carrySpill = 0; M.gustT = 0; M.leftHeld = false; M.rightHeld = false;
    M.patron++;
    M.target = 0.62 + Math.random() * 0.26;
    M.tol = 0.06;
    this.el.mgOrder.classList.remove('hidden');
    this.el.mgOrder.innerHTML = `Patron #${M.patron}: “Fill 'er to about <b>${Math.round(M.target * 100)}%</b>, barkeep — and don't slosh it on the way over!”`;
    this._barShow(false, false, false, false, true);
  }
  _barAccept() {
    const M = this._bar; if (!M || M.phase !== 'order') return;
    this.game.audio.play('click');
    M.phase = 'pour';
    this.el.mgOrder.innerHTML = `Pour to the <b>red line</b> (~${Math.round(M.target * 100)}%). Foam counts — don't overflow! Then <b>Carry it</b>.`;
    this._barShow(true, true, false, false, false);
  }
  // pour -> carry
  _barServe() {
    const M = this._bar; if (!M || M.phase !== 'pour') return;
    M.pouring = false; M.phase = 'carry';
    M.pourMiss = Math.abs(M.liquid + M.foam - M.target);
    this.game.audio.play('click');
    this.el.mgOrder.innerHTML = '🍺 Carry it to the patron! Tap <b>◀ / ▶</b> (or A/D) to keep the mug level — spill too much and the tip shrinks.';
    this._barShow(false, false, true, true, false);
  }
  // carry -> served (score the round)
  _barDeliver() {
    const M = this._bar; if (!M || M.phase !== 'carry') return;
    M.phase = 'served';
    this._barShow(false, false, false, false, false);
    const pourGood = M.overflow > 0.04 ? 0 : (M.pourMiss <= M.tol ? 8 : M.pourMiss <= 0.16 ? 5 : 2);
    const spillFrac = Math.min(1, M.carrySpill * 2.2);
    const carryGood = Math.round((1 - spillFrac) * 6);
    const tip = Math.max(1, pourGood + carryGood);
    if (pourGood >= 8 && carryGood >= 6) { this.critToast(); this.game.audio.play('levelup'); }
    else this.game.audio.play(spillFrac > 0.55 ? 'hiccup' : 'xp');
    M.tips += tip; M.served++;
    this.el.mgScore.textContent = M.tips;
    this.el.mgServed.textContent = M.served;
    this.toast(`🍺 +${tip}🪙 tip${spillFrac > 0.3 ? ' (a bit sloshed)' : ''}`);
    if (M.served >= M.total) { setTimeout(() => this._barFinish(), 750); return; }
    setTimeout(() => this._barNewOrder(), 850);
  }
  _barFinish() {
    const M = this._bar; if (!M) { this.el.minigame.classList.add('hidden'); return; }
    cancelAnimationFrame(this._barRaf);
    window.removeEventListener('pointerup', this._barUp);
    window.removeEventListener('keydown', this._barKeyDown);
    window.removeEventListener('keyup', this._barKeyUp);
    this.el.mgPour.removeEventListener('pointerdown', this._barDown);
    this.el.mgPour.removeEventListener('pointercancel', this._barUp);
    this.el.mgLeft.removeEventListener('pointerdown', this._barLDown);
    this.el.mgRight.removeEventListener('pointerdown', this._barRDown);
    this.el.minigame.classList.add('hidden');
    this.el.mgOrder.classList.add('hidden');
    this._barShow(false, false, false, false, false);
    const cb = M.done; this._bar = null;
    if (cb) cb(M.tips);
  }

  _barLoop() {
    const M = this._bar; if (!M) return;
    const now = performance.now();
    let dt = (now - M.last) / 1000; M.last = now; if (dt > 0.05) dt = 0.05;
    M.anim += dt;

    if (M.phase === 'pour') {
      if (M.pouring) {
        M.liquid += 0.34 * dt;
        M.foam += (0.10 + M.liquid * 0.20) * dt;
      } else {
        const settle = Math.min(M.foam, 0.18 * dt);
        M.foam -= settle; M.liquid += settle * 0.45;
      }
      const level = M.liquid + M.foam;
      if (level > 1) { M.overflow += (level - 1); M.foam = Math.max(0, M.foam - (level - 1)); M.liquid = Math.min(M.liquid, 1); }
    } else if (M.phase === 'carry') {
      // inverted-pendulum balance: gusts knock the mug, you counter with ◀/▶
      M.gustT -= dt;
      if (M.gustT <= 0) { M.gustT = 0.5 + Math.random() * 0.7; M.av += (Math.random() - 0.5) * 2.0; }
      if (M.leftHeld) M.av -= 5 * dt;
      if (M.rightHeld) M.av += 5 * dt;
      M.av += Math.sin(M.angle) * 3 * dt;   // tilt makes it want to keep tipping
      M.av -= M.av * 2.2 * dt;              // damping
      M.angle += M.av * dt;
      if (M.angle > 1.1) { M.angle = 1.1; M.av *= -0.2; }
      if (M.angle < -1.1) { M.angle = -1.1; M.av *= -0.2; }
      const lean = Math.abs(M.angle);
      if (lean > 0.45) { const over = lean - 0.45; M.carrySpill += over * 0.5 * dt; M.liquid = Math.max(0, M.liquid - over * 0.5 * dt); }
      M.dist += dt / 6.5;
      if (M.dist >= 1) { this._barDeliver(); }
    } else if (M.phase === 'served') {
      const settle = Math.min(M.foam, 0.25 * dt); M.foam -= settle; M.liquid += settle * 0.4;
    }
    this._barRender();
    this._barRaf = requestAnimationFrame(this._barLoopBound);
  }

  _barRenderCarry(ctx, W, H, M) {
    ctx.fillStyle = '#241a18'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#15100e'; ctx.fillRect(0, H - 72, W, 72);
    const px = 44, pw = W - 88, py = H - 70;
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '40px serif'; ctx.textAlign = 'center';
    ctx.fillText('🛢', px, py - 2);
    ctx.fillText(M.dist > 0.9 ? '😋' : '🧔', px + pw, py - 4);
    const wx = px + M.dist * pw;
    ctx.font = '46px serif'; ctx.fillText('🧙', wx, py + 4);
    // mug on a little tray, tilted by the balance angle
    ctx.save(); ctx.translate(wx, py - 52); ctx.rotate(M.angle);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-26, 4, 52, 5);
    const mw = 30, mh = 42;
    ctx.fillStyle = '#caa06a'; ctx.fillRect(-mw / 2, -mh, mw, mh);
    const f = Math.min(1, M.liquid) * (mh - 6);
    const grd = ctx.createLinearGradient(0, -f, 0, 0); grd.addColorStop(0, '#ffd166'); grd.addColorStop(1, '#c8841d');
    ctx.fillStyle = grd; ctx.fillRect(-mw / 2 + 3, -f - 3, mw - 6, f);
    ctx.fillStyle = '#fff7e8'; ctx.fillRect(-mw / 2 + 3, -f - 9, mw - 6, 6);
    ctx.strokeStyle = '#efe6d6'; ctx.lineWidth = 2; ctx.strokeRect(-mw / 2, -mh, mw, mh);
    ctx.restore();
    const lean = Math.abs(M.angle);
    if (lean > 0.45) {
      ctx.fillStyle = 'rgba(255,206,90,.85)';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(wx + (M.angle > 0 ? 22 : -22) + Math.sin(M.anim * 9 + i) * 6, py - 38 + ((M.anim * 130 + i * 22) % 42), 3, 0, 6.28); ctx.fill(); }
      ctx.fillStyle = '#ff6a6a'; ctx.font = 'bold 16px "Trebuchet MS",sans-serif'; ctx.fillText('STEADY!', wx, py - 96);
    }
    // balance meter
    const mx = W / 2, bw = 210;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(mx - bw / 2, 30, bw, 16);
    const safe = (0.45 / 1.1) * (bw / 2);
    ctx.fillStyle = 'rgba(110,231,160,.35)'; ctx.fillRect(mx - safe, 30, safe * 2, 16);
    const nx = mx + Math.max(-1, Math.min(1, M.angle / 1.1)) * (bw / 2);
    ctx.fillStyle = lean > 0.45 ? '#ff5d6c' : '#ffe08a'; ctx.fillRect(nx - 3, 26, 6, 24);
    ctx.fillStyle = '#cfe0ff'; ctx.font = 'bold 12px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('keep it level', mx, 22);
    ctx.fillStyle = '#ffe6a8'; ctx.font = 'bold 15px "Trebuchet MS",sans-serif';
    ctx.fillText(`Carried ${Math.round(M.dist * 100)}%  ·  in the mug: ${Math.round(Math.min(1, M.liquid + M.foam) * 100)}%`, W / 2, H - 14);
  }

  _barRender() {
    const M = this._bar, cv = this.el.mgCanvas; if (!M || !cv) return;
    const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    if (M.phase === 'carry') { this._barRenderCarry(ctx, W, H, M); return; }

    // glass geometry
    const gx = W / 2, gw = 150, gh = 300, gy = H - gh - 30;
    const left = gx - gw / 2, right = gx + gw / 2, bottom = gy + gh;
    const innerL = left + 10, innerR = right - 10, innerW = innerR - innerL;
    const innerTop = gy + 12, innerBot = bottom - 12, innerH = innerBot - innerTop;

    // pouring stream from a tap above
    if (M.phase === 'pour' && M.pouring) {
      ctx.fillStyle = 'rgba(255,206,90,0.9)';
      const sx = gx + Math.sin(M.anim * 12) * 3;
      ctx.fillRect(sx - 5, 8, 10, gy - 8 - (M.liquid + M.foam) * innerH);
      // splash droplets
      ctx.fillStyle = 'rgba(255,240,200,0.8)';
      for (let i = 0; i < 5; i++) { const a = M.anim * 9 + i; ctx.beginPath(); ctx.arc(sx + Math.sin(a) * 14, gy - (M.liquid + M.foam) * innerH + Math.abs(Math.cos(a)) * 10, 2.5, 0, 6.28); ctx.fill(); }
    }
    // the tap
    ctx.fillStyle = '#3a3a42'; ctx.fillRect(gx - 26, 0, 52, 16); ctx.fillRect(gx - 6, 14, 12, 8);

    // liquid + foam inside the glass (clip to inner glass)
    ctx.save();
    ctx.beginPath(); ctx.moveTo(innerL, innerTop); ctx.lineTo(innerR, innerTop); ctx.lineTo(innerR, innerBot); ctx.lineTo(innerL, innerBot); ctx.closePath(); ctx.clip();
    const liqTop = innerBot - Math.min(1, M.liquid) * innerH;
    const grad = ctx.createLinearGradient(0, liqTop, 0, innerBot);
    grad.addColorStop(0, '#ffd166'); grad.addColorStop(1, '#c8841d');
    ctx.fillStyle = grad; ctx.fillRect(innerL, liqTop, innerW, innerBot - liqTop);
    // rising bubbles
    ctx.fillStyle = 'rgba(255,247,230,0.5)';
    for (let i = 0; i < 8; i++) { const t = (M.anim * 0.4 + i / 8) % 1; const by = innerBot - t * Math.min(1, M.liquid) * innerH; ctx.beginPath(); ctx.arc(innerL + ((i * 37) % innerW), by, 1.6 + (i % 3) * 0.6, 0, 6.28); ctx.fill(); }
    // foam head
    const foamH = Math.min(1, M.foam) * innerH;
    if (foamH > 0.5) {
      const foamTop = liqTop - foamH;
      ctx.fillStyle = '#fff7e8'; ctx.fillRect(innerL, foamTop, innerW, foamH);
      ctx.fillStyle = '#fffdf6';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(innerL + 8 + i * (innerW / 6.5), foamTop + Math.sin(M.anim * 2 + i) * 2.5, 7, 0, 6.28); ctx.fill(); }
    }
    ctx.restore();

    // target line + tolerance band
    const tY = innerBot - M.target * innerH;
    ctx.fillStyle = 'rgba(120,240,150,0.18)'; ctx.fillRect(left - 6, tY - M.tol * innerH, gw + 12, M.tol * 2 * innerH);
    ctx.strokeStyle = '#ff5d6c'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(left - 6, tY); ctx.lineTo(right + 6, tY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ff8a98'; ctx.font = 'bold 13px "Trebuchet MS",sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('fill to here', right + 10, tY + 4);

    // glass outline (drawn on top)
    ctx.strokeStyle = 'rgba(220,235,255,0.85)'; ctx.lineWidth = 5;
    ctx.strokeRect(left, gy, gw, gh);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(left + 6, gy + 6, gw - 12, gh - 12);
    // handle
    ctx.strokeStyle = 'rgba(220,235,255,0.8)'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(right + 18, gy + gh * 0.5, 30, -1.1, 1.1); ctx.stroke();

    // spill over the rim
    if (M.overflow > 0.001) {
      ctx.fillStyle = 'rgba(255,206,90,0.8)';
      for (let i = 0; i < 6; i++) { const a = M.anim * 6 + i; ctx.beginPath(); ctx.arc(left + (i % 2 ? -4 : gw + 4), gy + 10 + ((M.anim * 60 + i * 30) % gh), 3 + (i % 2), 0, 6.28); ctx.fill(); }
      ctx.fillStyle = '#ff6a6a'; ctx.textAlign = 'center'; ctx.font = 'bold 15px "Trebuchet MS",sans-serif';
      ctx.fillText('SPILLING!', gx, gy - 8);
    }
    // readout
    ctx.fillStyle = '#ffe6a8'; ctx.textAlign = 'center'; ctx.font = 'bold 15px "Trebuchet MS",sans-serif';
    ctx.fillText(`Filled: ${Math.round(Math.min(1, M.liquid + M.foam) * 100)}%`, gx, bottom + 22);
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
    this.el.shop.classList.toggle('build-mode', kind === 'build');
    this.el.shop.classList.remove('hidden');
    if (kind === 'build') { if (this._buildRot === undefined) this._buildRot = 0; this.el.buildPreview.classList.remove('hidden'); this._setPreviewItem(this._buildSel); this._startPreview(); }
  }
  closeShop() { this.el.shop.classList.add('hidden'); this.el.shop.classList.remove('build-mode'); if (this.el.buildPreview) this.el.buildPreview.classList.add('hidden'); this._stopPreview(); }

  // ---- rotatable 3D build preview (its own tiny renderer over the bottom-docked build panel) ----
  _ensurePreview() {
    if (this._pvRenderer || !this.el.bpCanvas) return;
    const c = this.el.bpCanvas;
    this._pvRenderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true });
    this._pvRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this._pvRenderer.setSize(c.width, c.height, false);
    this._pvScene = new THREE.Scene();
    this._pvCamera = new THREE.PerspectiveCamera(40, c.width / c.height, 0.1, 50);
    this._pvCamera.position.set(0, 0.5, 3.5); this._pvCamera.lookAt(0, 0, 0);
    this._pvScene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.1); key.position.set(2.5, 4, 3); this._pvScene.add(key);
    const rim = new THREE.DirectionalLight(0x9b7bff, 0.55); rim.position.set(-3, 1.5, -2); this._pvScene.add(rim);
  }
  _disposePvMesh() {
    if (!this._pvMesh) return;
    this._pvScene.remove(this._pvMesh);
    this._pvMesh.traverse(o => { if (o.isMesh) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); } });
    this._pvMesh = null;
  }
  _setPreviewItem(id) {
    this._ensurePreview(); if (!this._pvScene) return;
    this._disposePvMesh();
    if (!id || !this.game || !this.game.tavern) { if (this.el.bpLabel) this.el.bpLabel.textContent = 'Pick a piece to preview'; return; }
    const built = this.game.tavern._buildPlaced(id); if (!built) return;
    const pivot = new THREE.Group(); pivot.add(built);
    const box = new THREE.Box3().setFromObject(built);
    const ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    built.position.set(-ctr.x, -ctr.y, -ctr.z);          // recentre the model inside its pivot
    const maxd = Math.max(sz.x, sz.y, sz.z) || 1; pivot.scale.setScalar(1.7 / maxd);
    this._pvScene.add(pivot); this._pvMesh = pivot;
    const b = meta.buildableById(id); if (this.el.bpLabel) this.el.bpLabel.textContent = b ? `${b.icon} ${b.name}` : '';
  }
  _startPreview() {
    this._ensurePreview(); if (this._pvActive || !this._pvRenderer) return;
    this._pvActive = true;
    const loop = () => { if (!this._pvActive) return; this._pvFrame(); this._pvRaf = requestAnimationFrame(loop); };
    loop();
  }
  _stopPreview() { this._pvActive = false; if (this._pvRaf) cancelAnimationFrame(this._pvRaf); }
  _pvFrame() {
    if (!this._pvRenderer) return;
    this._pvSpinV = (this._pvSpinV === undefined ? 0.6 : this._pvSpinV); this._pvSpinV += (0.6 - this._pvSpinV) * 0.04;
    this._pvAngle = (this._pvAngle || 0) + this._pvSpinV * 0.016;
    if (this._pvMesh) { this._pvMesh.rotation.y = this._pvAngle; this._pvMesh.position.y = Math.sin(this._pvAngle * 1.3) * 0.05; }
    this._pvRenderer.render(this._pvScene, this._pvCamera);
  }

  _shopAction(act, id, slot) {
    const g = this._shopGame;
    if (act === 'startrun') { g.startRun(id); return; }
    if (act === 'buildtab') { this._buildTab = id; this._buildSel = null; if (g) g.audio.play('click'); this._renderShop(); return; }
    if (act === 'libtab') { this._libTab = id; if (g) g.audio.play('click'); this._renderShop(); return; }
    if (act === 'selbuild') { this._buildSel = (this._buildSel === id ? null : id); this._setPreviewItem(this._buildSel); if (this._buildSel) this._pvSpinV = 6; if (g) g.audio.play('click'); this._renderShop(); return; }
    if (act === 'place') {
      const [gx, gy] = id.split('_').map(Number);
      let ok, placedStation = null;
      if (meta.cellOccupied(gx, gy)) ok = meta.removeAt(gx, gy);
      else if (this._buildSel) { const sb = meta.buildableById(this._buildSel); ok = meta.placeItem(this._buildSel, gx, gy, this._buildRot || 0); if (ok) { placedStation = sb && sb.station ? sb : null; if (placedStation) { this._buildSel = null; this._setPreviewItem(null); } } }
      else ok = false;
      if (g) { g.audio.play(ok ? 'click' : 'hiccup'); if (ok && g.tavern.refreshRoom) g.tavern.refreshRoom(meta); }
      if (ok) this.burstFX({ x: window.innerWidth / 2, y: window.innerHeight * 0.34 }, 'sparkle', 10);
      if (placedStation) this.wispSay(`✓ Built the ${placedStation.name}. Walk up and press E to use it!`);
      this.setGold(meta.gold());
      this._renderShop();
      return;
    }
    let ok = false;
    if (act === 'unlock') ok = meta.unlockSpell(id);
    else if (act === 'upgrade') ok = meta.upgradeSpell(id);
    else if (act === 'equip') ok = meta.toggleEquip(id);
    else if (act === 'learn') ok = meta.learnCombo(id);
    else if (act === 'brew') { ok = meta.brewPotion(id); if (ok) g.ui.wispSay('🧪 Potion brewed! Its boon is yours for good.'); }
    else if (act === 'buyroom') ok = meta.buyRoom();
    else if (act === 'buydecor') ok = meta.buyDecor(id);
    else if (act === 'rest') ok = meta.rest();
    else if (act === 'collect') { const r = meta.collectTavern(); ok = r > 0; if (ok) g.ui.toast(`Collected ${r}🪙`); }
    else if (act === 'tavup') ok = meta.buyTavernUpgrade(id);
    else if (act === 'equipgear') ok = meta.equipGear(id);
    else if (act === 'salvage') { const v = meta.salvageGear(id); ok = v > 0; if (ok) g.ui.toast(`Salvaged for ${v}🪙`); }
    else if (act === 'upgradegear') ok = meta.upgradeGear(id);
    else if (act === 'forge') { const inst = meta.forgeGear(id); ok = !!inst; if (ok) { g.ui.lootToast(inst); g.audio.play('levelup'); } }
    else if (act === 'research') { ok = meta.startResearch(id); if (ok) g.ui.wispSay('🔬 Research begun. It finishes as the days pass.'); }
    else if (act === 'artieq') { ok = meta.toggleArtifactEquip(id); if (!ok) g.ui.wispSay(`✦ You can only carry ${meta.MAX_ARTIFACTS} artifacts into a run.`, { tone: 'warn' }); }
    else if (act === 'deck') { const inDeck = UPGRADES.length - meta.deckOffIds().length; if (!meta.isDeckOff(id) && inDeck <= 6) { g.ui.wispSay('Keep at least 6 boons in your deck!', { tone: 'warn' }); ok = false; } else { meta.toggleDeck(id); ok = true; } }
    else if (act === 'paydebt') { const p = meta.payDebt(meta.gold()); ok = p > 0; if (ok) { g.ui.toast(`💰 Paid ${p}🪙 off the debt`); if (meta.debt() <= 0) g.onDebtCleared(); } }
    else if (act === 'claim') { const res = meta.claimQuest(); ok = !!(res && res.reward > 0); if (ok) { g.ui.toast(`Quest reward: +${res.reward}🪙`); if (res.unlocked) g.ui.wispSay(`🔓 Unlocked the ${meta.FEATURE_LABELS[res.unlocked]}. Build it up in your room!`, { big: true, ms: 4200 }); } }
    if (g) g.audio.play(ok ? 'click' : 'hiccup');
    this.setGold(meta.gold());
    this._renderShop();
  }

  _renderShop() {
    const kind = this._shopKind;
    const titles = { skilltree: '✦ Spell Table', library: '📖 Arcane Library', cauldron: '🜲 Cauldron', build: '🏛 Build Your Den', manager: '📜 Quest Board', wardrobe: '🎽 Equipment Hall', ledger: '📒 Tavern Ledger', blacksmith: '🔨 Anvil' };
    this.el.shopTitle.textContent = titles[kind] || 'Tavern';
    let html = '';
    if (kind === 'skilltree') html = this._renderSkillTree();
    else if (kind === 'library') html = this._renderLibrary();
    else if (kind === 'cauldron') html = this._renderCauldron();
    else if (kind === 'build') html = this._renderBuild();
    else if (kind === 'manager') html = this._renderManager();
    else if (kind === 'wardrobe') html = this._renderWardrobe();
    else if (kind === 'ledger') html = this._renderLedger();
    else if (kind === 'blacksmith') html = this._renderBlacksmith();
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

  _gearStats(g) { return Object.entries(g.mods).map(([k, v]) => meta.statLabel(k, v)).join(' · '); }
  _slotMeta(slot) { return ({ hat: { icon: '🎩', name: 'Hat' }, robe: { icon: '🧥', name: 'Robe' }, staff: { icon: '🪄', name: 'Staff' }, charm: { icon: '🔮', name: 'Charm' } })[slot] || { icon: '🎒', name: slot }; }
  _gearCard(g, acts, on) {
    const rc = meta.RARITIES[g.rarity];
    return `<div class="shop-card gear rar-${g.rarity} ${on ? 'worn' : ''}" style="--rc:${rc.color}">
      <div class="gear-top"><span class="gear-name" style="color:${rc.color}">${g.name}</span><span class="gear-lv">Lv${g.level}</span></div>
      <div class="gear-rar" style="color:${rc.color}">★ ${rc.name} ${this._slotMeta(g.slot).name}</div>
      <div class="shop-desc gear-stats">${this._gearStats(g)}</div>
      <div class="shop-acts">${acts}</div></div>`;
  }
  // Clash-style Equipment Hall: a hero loadout strip + combined bonuses + per-slot inventory
  _renderWardrobe() {
    const mods = meta.equipMods();
    const totalStr = Object.keys(mods).length ? Object.entries(mods).map(([k, v]) => meta.statLabel(k, v)).join(' · ') : 'Nothing equipped yet';
    let strip = '<div class="eq-loadout">';
    for (const slot of meta.GEAR_SLOTS) {
      const sm = this._slotMeta(slot);
      const g = meta.gearById(meta.equippedGearId(slot));
      const rc = g ? meta.RARITIES[g.rarity] : null;
      strip += `<div class="eq-slot ${g ? 'filled' : ''}" style="${rc ? `--rc:${rc.color}` : ''}">
        <div class="eq-slot-frame">${g ? `<span class="eq-slot-ico">${sm.icon}</span><span class="eq-lv">Lv${g.level}</span>` : `<span class="eq-slot-ph">${sm.icon}</span>`}</div>
        <div class="eq-slot-name">${g ? g.name : sm.name}</div>
        <div class="eq-slot-rar ${g ? '' : 'empty'}" ${rc ? `style="color:${rc.color}"` : ''}>${g ? rc.name : '— empty —'}</div></div>`;
    }
    strip += '</div>';
    let h = '<p class="shop-sub">Your relics &amp; regalia — one piece per slot. Rarer &amp; higher-level hits harder; bonuses apply on your next venture.</p>';
    h += strip;
    h += `<div class="eq-totals"><span>⚔ Equipped bonuses</span><b>${totalStr}</b></div>`;
    for (const slot of meta.GEAR_SLOTS) {
      const sm = this._slotMeta(slot);
      const eqId = meta.equippedGearId(slot);
      const items = meta.gearList().filter(g => g.slot === slot)
        .sort((a, b) => meta.RARITIES[b.rarity].mult * b.level - meta.RARITIES[a.rarity].mult * a.level);
      h += `<div class="eq-section"><div class="eq-section-head">${sm.icon} ${sm.name}s <span class="eq-count">${items.length}</span></div><div class="shop-grid eq-grid">`;
      if (!items.length) h += `<div class="eq-empty">No ${sm.name.toLowerCase()} found yet — slay monsters &amp; bosses to loot some.</div>`;
      for (const g of items) {
        const on = eqId === g.id, cost = meta.upgradeGearCost(g), max = g.level >= 10;
        const acts = `<button class="shop-btn ${on ? 'on' : ''}" data-act="equipgear" data-id="${g.id}">${on ? '✓ Worn' : 'Wear'}</button>`
          + (max ? '<button class="shop-btn" disabled>MAX</button>' : `<button class="shop-btn" data-act="upgradegear" data-id="${g.id}" ${meta.canAfford(cost) ? '' : 'disabled'}>⚒ ${cost}🪙</button>`)
          + `<button class="shop-btn ghost" data-act="salvage" data-id="${g.id}">♻ ${meta.gearValue(g)}🪙</button>`;
        h += this._gearCard(g, acts, on);
      }
      h += '</div></div>';
    }
    return h;
  }
  _renderBlacksmith() {
    let h = '<p class="shop-sub">⚒️ The forge-gacha: spend 🪙 gold &amp; 💎 gems to <b>cast a random piece of gear</b>. Richer ingredients tilt the odds toward the good stuff.</p><div class="shop-grid">';
    for (const t of meta.FORGE_TIERS) {
      const odds = meta.GEAR_RARITY_ORDER.filter(r => t.w[r]).map(r => `<span style="color:${meta.RARITIES[r].color}">${t.w[r]}%</span>`).join(' / ');
      const can = meta.canForge(t.id);
      h += `<div class="shop-card forge-card">
        <div class="shop-glyph">${t.icon}</div>
        <div class="shop-name">${t.name}</div>
        <div class="shop-desc">Cast a random piece.<br><span style="font-size:11px">${odds}</span></div>
        <div class="shop-acts"><button class="shop-btn gem" data-act="forge" data-id="${t.id}" ${can ? '' : 'disabled'}>🪙${t.gold} · 💎${t.gems}</button></div></div>`;
    }
    h += '</div>';
    const items = meta.gearList().slice().sort((a, b) => meta.RARITIES[b.rarity].mult * b.level - meta.RARITIES[a.rarity].mult * a.level);
    h += `<div class="eq-section-head" style="margin-top:14px">Your gear — forge up or salvage <span class="eq-count">${items.length}</span></div><div class="shop-grid eq-grid">`;
    if (!items.length) h += '<div class="eq-empty">No gear yet — cast some above, or loot it on a venture!</div>';
    for (const g of items) {
      const cost = meta.upgradeGearCost(g), max = g.level >= 10;
      const acts = `${max ? '<button class="shop-btn" disabled>MAX</button>' : `<button class="shop-btn" data-act="upgradegear" data-id="${g.id}" ${meta.canAfford(cost) ? '' : 'disabled'}>⚒ +Lv ${cost}🪙</button>`}<button class="shop-btn ghost" data-act="salvage" data-id="${g.id}">♻ ${meta.gearValue(g)}🪙</button>`;
      h += this._gearCard(g, acts, false);
    }
    h += '</div>';
    return h;
  }

  _elChip(elementId) {
    const e = meta.ELEMENTS[elementId] || { icon: '✦', color: 'var(--magic)', name: '' };
    return { e, chip: `<span class="spell-el" style="color:${e.color}">${e.icon} ${e.name}</span>` };
  }
  _renderSkillTree() {
    const eq = meta.getLoadout();
    let h = '<p class="shop-sub">Unlock & upgrade spells with <b>💎 gems</b> (won in battle), then equip up to <b>3</b> as your loadout. Each channels one of the four elements.</p><div class="shop-grid">';
    for (const id of meta.SPELL_LIST) {
      const m = meta.SPELL_META[id];
      const { e } = this._elChip(m.element);
      const owned = meta.owns(id), lvl = meta.spellLevel(id), equipped = eq.includes(id);
      let action;
      if (!owned) {
        const c = meta.spellUnlockGems(id);
        action = `<button class="shop-btn gem" data-act="unlock" data-id="${id}" ${meta.canAffordGems(c) ? '' : 'disabled'}>Unlock 💎${c}</button>`;
      } else {
        const up = lvl >= meta.MAX_LEVEL ? `<button class="shop-btn" disabled>MAX</button>` :
          `<button class="shop-btn gem" data-act="upgrade" data-id="${id}" ${meta.canAffordGems(meta.spellUpgradeGems(lvl)) ? '' : 'disabled'}>Lv${lvl}→${lvl + 1} · 💎${meta.spellUpgradeGems(lvl)}</button>`;
        action = up + `<button class="shop-btn ${equipped ? 'on' : ''}" data-act="equip" data-id="${id}">${equipped ? '✓ Equipped' : 'Equip'}</button>`;
      }
      h += `<div class="shop-card spell-card ${owned ? '' : 'locked'}" style="--el:${e.color}">
        <div class="spell-el" style="color:${e.color}">${e.icon} ${e.name}</div>
        <div class="shop-glyph" style="color:${e.color}">${m.glyph}</div>
        <div class="shop-name">${m.name}${owned ? ` <span class="lvtag">Lv${lvl}</span>` : ''}</div>
        <div class="shop-acts">${action}</div></div>`;
    }
    h += '</div>';
    return h;
  }

  // ---- Arcane Library: tabbed Grimoire (showcase) / Research / Inventory ----
  _renderLibrary() {
    const tab = this._libTab || (this._libTab = 'grimoire');
    let h = `<div class="vil-tabs">
      <button class="vil-tab ${tab === 'grimoire' ? 'on' : ''}" data-act="libtab" data-id="grimoire">📖 Grimoire</button>
      <button class="vil-tab ${tab === 'deck' ? 'on' : ''}" data-act="libtab" data-id="deck">🃏 Deck</button>
      <button class="vil-tab ${tab === 'research' ? 'on' : ''}" data-act="libtab" data-id="research">🔬 Research</button>
      <button class="vil-tab ${tab === 'inventory' ? 'on' : ''}" data-act="libtab" data-id="inventory">🎒 Inventory</button></div>`;
    if (tab === 'deck') h += this._renderDeck();
    else if (tab === 'research') h += this._renderResearch();
    else if (tab === 'inventory') h += this._renderInventory();
    else h += this._renderGrimoire();
    return h;
  }
  _renderDeck() {
    const total = UPGRADES.length, inDeck = total - meta.deckOffIds().length;
    let h = `<p class="shop-sub">Your level-up <b>deck</b> — toggle which boons can appear when you level up, and craft the run you want. (Keep at least 6 in.)</p>`;
    h += `<div class="eq-section-head">🃏 In your deck <span class="eq-count">${inDeck}/${total}</span></div><div class="shop-grid grim-grid">`;
    for (const u of UPGRADES) {
      const on = !meta.isDeckOff(u.id);
      h += `<div class="shop-card deck-card ${on ? '' : 'locked'}">
        <div class="shop-glyph">${u.icon}</div>
        <div class="shop-name">${u.name}</div>
        <div class="shop-desc">${u.desc}</div>
        <div class="shop-acts"><button class="shop-btn ${on ? 'on' : ''}" data-act="deck" data-id="${u.id}">${on ? '✓ In deck' : '+ Add'}</button></div></div>`;
    }
    h += '</div>';
    return h;
  }
  _renderGrimoire() {
    let h = '<p class="shop-sub">Every glyph in the realm — its element, its lore, and a glimpse of its magic. Owned spells show their level.</p><div class="shop-grid grim-grid">';
    for (const id of meta.SPELL_LIST) {
      const m = meta.SPELL_META[id];
      const { e } = this._elChip(m.element);
      const owned = meta.owns(id), lvl = meta.spellLevel(id);
      h += `<div class="shop-card grim-card ${owned ? '' : 'locked'}" style="--el:${e.color}">
        <div class="grim-vfx"><span class="vfx-orb" style="--c:${e.color}"></span><span class="grim-glyph" style="color:${e.color}">${m.glyph}</span></div>
        <div class="spell-el" style="color:${e.color}">${e.icon} ${e.name}</div>
        <div class="shop-name">${m.name} ${owned ? `<span class="lvtag">Lv${lvl}</span>` : '<span class="lvtag locked-tag">locked</span>'}</div>
        <div class="shop-desc">${m.lore}</div></div>`;
    }
    h += '</div>';
    return h;
  }
  _renderResearch() {
    const active = meta.researchActive();
    let h = '<p class="shop-sub">Spend <b>💎 gems</b> to research permanent boons. A project finishes after a few <b>days</b> — every shift you work and venture you take passes one. One project at a time.</p>';
    if (active) h += `<div class="research-active">🔬 Researching <b>${active.name}</b> — <b>${meta.researchDaysLeft()}</b> day(s) to go.</div>`;
    h += '<div class="shop-grid">';
    for (const r of meta.RESEARCH) {
      const done = meta.researchDone(r.id), isActive = active && active.id === r.id;
      let btn;
      if (done) btn = '<button class="shop-btn on" disabled>✓ Researched</button>';
      else if (isActive) btn = `<button class="shop-btn" disabled>… ${meta.researchDaysLeft()}d left</button>`;
      else if (active) btn = '<button class="shop-btn" disabled>Library busy</button>';
      else btn = `<button class="shop-btn gem" data-act="research" data-id="${r.id}" ${meta.canAffordGems(r.gems) ? '' : 'disabled'}>Research 💎${r.gems}</button>`;
      h += `<div class="shop-card ${done ? '' : 'locked'}">
        <div class="shop-glyph">${r.icon}</div>
        <div class="shop-name">${r.name}</div>
        <div class="shop-desc">${r.desc} · takes <b>${r.days}d</b></div>
        <div class="shop-acts">${btn}</div></div>`;
    }
    h += '</div>';
    return h;
  }
  _renderInventory() {
    const eqMods = meta.equipMods();
    const statStr = Object.keys(eqMods).length ? Object.entries(eqMods).map(([k, v]) => meta.statLabel(k, v)).join(' · ') : 'No gear equipped';
    const ownedSpells = meta.SPELL_LIST.filter(id => meta.owns(id)).length;
    const tally = {}; for (const id of meta.SPELL_LIST) if (meta.owns(id)) { const el = meta.SPELL_META[id].element; tally[el] = (tally[el] || 0) + 1; }
    const elh = meta.ELEMENT_LIST.map(el => { const e = meta.ELEMENTS[el]; return `<span class="inv-el" style="color:${e.color}">${e.icon} ${e.name} ×${tally[el] || 0}</span>`; }).join('');
    let h = '<p class="shop-sub">Your satchel — currencies, gear and known magic at a glance.</p>';
    h += `<div class="inv-cur">
      <div class="inv-coin"><span class="inv-ico">🪙</span><b>${meta.gold()}</b><small>gold · earned by working</small></div>
      <div class="inv-coin"><span class="inv-ico">💎</span><b>${meta.gems()}</b><small>gems · won in battle</small></div>
      <div class="inv-coin"><span class="inv-ico">🌿</span><b>${meta.herbs()}</b><small>herbs · brew potions</small></div>
      <div class="inv-coin"><span class="inv-ico">☀️</span><b>Day ${meta.currentDay()}</b><small>the tavern clock</small></div>
    </div>`;
    h += `<div class="eq-totals"><span>⚔ Equipped bonuses</span><b>${statStr}</b></div>`;
    h += `<div class="inv-row"><span>Spells known</span><b>${ownedSpells} / ${meta.SPELL_LIST.length}</b></div>
      <div class="inv-row"><span>Gear in stash</span><b>${meta.gearList().length}</b></div>
      <div class="inv-els">${elh}</div>`;
    // elemental gemstones — collected from battle, brewed at the Cauldron
    const gs = meta.gemstones();
    const gsh = meta.ELEMENT_LIST.map(el => { const e = meta.ELEMENTS[el]; return `<span class="inv-el" style="color:${e.color}">${e.icon} ${e.name} ×${gs[el] || 0}</span>`; }).join('');
    h += `<div class="eq-section-head" style="margin-top:14px">💎 Elemental Gemstones <span class="eq-count">${meta.totalGemstones()} total</span></div>
      <p class="shop-sub" style="margin:.2em 0 .5em">Won in battle. Brew them with 🌿 herbs into potions at the Cauldron.</p>
      <div class="inv-els">${gsh}</div>`;
    // collected artifacts — carry up to MAX into your runs
    const owned = meta.ownedArtifacts();
    h += `<div class="eq-section-head" style="margin-top:14px">✦ Artifacts <span class="eq-count">${meta.equippedArtifacts().length} carried · ${owned.length}/${ARTIFACTS.length} found</span></div>`;
    h += `<p class="shop-sub" style="margin:.2em 0 .6em">Won from bosses. <b>Carry up to ${meta.MAX_ARTIFACTS}</b> into a run — each grants its full power.</p><div class="shop-grid eq-grid">`;
    if (!owned.length) h += '<div class="eq-empty">No artifacts yet — fell a region boss to claim one.</div>';
    for (const id of owned) {
      const a = artifactById(id); if (!a) continue;
      const on = meta.artifactEquipped(id);
      h += `<div class="shop-card art-card ${on ? 'worn' : ''}" style="--rc:var(--gold)">
        <div class="grim-vfx"><span class="vfx-orb" style="--c:#ffcf5c"></span><span class="grim-glyph" style="color:var(--gold)">${a.icon}</span></div>
        <div class="shop-name" style="color:var(--gold)">${a.name}</div>
        <div class="shop-desc">${a.desc}</div>
        <div class="shop-acts"><button class="shop-btn ${on ? 'on' : ''}" data-act="artieq" data-id="${id}">${on ? '✓ Carrying' : 'Carry'}</button></div></div>`;
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
    // ---- brew lasting potions from gathered herbs + elemental gemstones ----
    h += `<div class="eq-section-head" style="margin-top:14px">🧪 Brew Potions <span class="eq-count">🌿 ${meta.herbs()} herbs</span></div>
      <p class="shop-sub" style="margin:.2em 0 .6em">Spend 🌿 herbs (gathered while venturing) and an elemental 💎 gemstone for a <b>permanent</b> boon.</p><div class="shop-grid">`;
    for (const p of meta.POTIONS) {
      const e = meta.ELEMENTS[p.el], can = meta.canBrew(p.id), have = meta.brewCount(p.id);
      h += `<div class="shop-card" style="--el:${e.color}">
        <div class="shop-glyph">${p.icon}</div>
        <div class="shop-name">${p.name}${have ? ` ×${have}` : ''}</div>
        <div class="shop-desc">${p.desc}</div>
        <div class="shop-acts"><button class="shop-btn" data-act="brew" data-id="${p.id}" ${can ? '' : 'disabled'}>🌿${p.herbs} + ${e.icon}${p.gems}</button></div></div>`;
    }
    h += '</div>';
    return h;
  }

  // Clash-style den builder: village stats + grid + category-tabbed palette
  _renderBuild() {
    const comfort = meta.roomComfort();
    const restAmt = meta.REST_BONUS + comfort * 4;
    const tab = this._buildTab || (this._buildTab = 'station');
    const stationsTotal = meta.BUILDABLES.filter(b => b.station).length;
    const stationsBuilt = meta.BUILDABLES.filter(b => b.station && meta.stationBuilt(b.id)).length;
    let h = `<p class="shop-sub">Build your wizard's den Clash-style: <b>pick</b> a building, then <b>tap a tile</b> to place it (tap a placed tile to sell it back at half). <b>Stations</b> let you manage spells &amp; gear right here; <b>comforts</b> deepen your rest bonus.</p>`;
    h += `<div class="vil-stats">
      <div class="vil-stat"><span>🏛 Stations</span><b>${stationsBuilt}/${stationsTotal}</b></div>
      <div class="vil-stat"><span>🛋 Comfort</span><b>${comfort}</b></div>
      <div class="vil-stat"><span>🛏 Rest bonus</span><b>+${restAmt} HP</b></div>
    </div>`;
    h += '<div class="build-grid">';
    for (let gy = 0; gy < meta.ROOM_GH; gy++) {
      for (let gx = 0; gx < meta.ROOM_GW; gx++) {
        const item = meta.placedItems().find(p => p.gx === gx && p.gy === gy);
        const b = item ? meta.buildableById(item.id) : null;
        h += `<button class="build-cell ${item ? 'filled' : ''} ${b && b.station ? 'is-station' : ''}" data-act="place" data-id="${gx}_${gy}" title="${b ? b.name + ' — tap to sell' : 'empty tile'}">${b ? b.icon : ''}</button>`;
      }
    }
    h += '</div>';
    h += `<div class="vil-tabs">
      <button class="vil-tab ${tab === 'station' ? 'on' : ''}" data-act="buildtab" data-id="station">🏛 Stations</button>
      <button class="vil-tab ${tab === 'comfort' ? 'on' : ''}" data-act="buildtab" data-id="comfort">🛋 Comforts</button></div>`;
    h += '<div class="build-cat">';
    for (const b of meta.BUILDABLES) {
      if ((tab === 'station') !== !!b.station) continue;
      const locked = b.feature && !meta.featureUnlocked(b.feature);
      const sel = this._buildSel === b.id;
      const built = b.station && meta.stationBuilt(b.id);
      const dis = locked || built || !meta.canAfford(b.cost);
      const cost = locked ? '🔒 quest' : built ? '✓ Built' : b.cost === 0 ? 'Free' : b.cost + '🪙';
      h += `<button class="build-item ${sel ? 'sel' : ''} ${b.station ? 'is-station' : ''} ${locked ? 'locked' : ''}" data-act="selbuild" data-id="${b.id}" ${dis ? 'disabled' : ''} title="${locked ? 'Unlock by claiming a bounty in your quest log' : b.name}">
        <span class="bi-icon">${locked ? '🔒' : b.icon}</span><span class="bi-name">${b.name}</span><span class="bi-cost">${cost}</span></button>`;
    }
    h += '</div>';
    if (this._buildSel) { const sb = meta.buildableById(this._buildSel); if (sb) h += `<p class="build-hint">Placing <b>${sb.icon} ${sb.name}</b> — spin it in the preview with <b>⟳ Rotate</b>, then tap an empty tile. <span data-act="selbuild" data-id="${this._buildSel}" style="text-decoration:underline;cursor:pointer">cancel</span></p>`; }
    return h;
  }

  _renderManager() {
    const q = meta.currentQuest(), done = meta.questDone();
    const debt = meta.debt(), total = meta.DEBT_TOTAL, paid = Math.max(0, total - debt), pct = Math.round(paid / total * 100);
    let h = '<p class="shop-sub">"Evenin\'. Mind the furniture. Here\'s the ledger — and a bit of work if you want coin…"</p>';
    // ---- MAIN QUEST: the debt ----
    if (debt > 0) {
      const pay = Math.min(meta.gold(), debt);
      h += `<div class="quest-box main-quest">
        <div class="quest-title">⚜ MAIN QUEST · The Tavern Debt</div>
        <div class="quest-text">Old Tomas left the Tipsy Toad drowning in debt — and you smashed up the rest on your way in. Pay it off to truly own the place.</div>
        <div class="debt-bar"><div class="debt-fill" style="width:${pct}%"></div><span class="debt-label">${paid} / ${total}🪙 paid</span></div>
        <div class="shop-acts"><button class="shop-btn big" data-act="paydebt" ${pay > 0 ? '' : 'disabled'}>Pay ${pay}🪙</button></div>
      </div>`;
    } else {
      h += `<div class="quest-box main-quest done"><div class="quest-title">⚜ MAIN QUEST · Debt Cleared!</div><div class="quest-text">Paid in full. The Tipsy Toad is yours, free and clear. 🍺</div></div>`;
    }
    // ---- side bounty ----
    h += `<div class="quest-box">
      <div class="quest-title">📜 Bounty</div>
      <div class="quest-text">${q.text}</div>
      <div class="quest-reward">Reward: <b>${q.reward}🪙</b> · claim it to unlock a new facility</div>
      <div class="shop-acts">${done ? '<button class="shop-btn big on" data-act="claim">✓ Claim reward</button>' : '<button class="shop-btn big" disabled>Complete it in a run</button>'}</div>
    </div>`;
    // ---- unlock track ----
    h += '<div class="eq-section-head" style="margin-top:12px">🔓 Facilities (claim bounties to unlock, then build them)</div><div class="unlock-row">';
    for (const f of meta.FEATURE_ORDER) { const u = meta.featureUnlocked(f); h += `<span class="unlock-chip ${u ? 'on' : ''}">${u ? '✓' : '🔒'} ${meta.FEATURE_LABELS[f]}</span>`; }
    h += '</div>';
    return h;
  }
}
