// ui.js — all the DOM: HUD, story modal, level-up cards, toasts, results,
// and the tavern shop panels (skill tree / cauldron / room / manager).
import * as THREE from 'three';
import { SPELL_ORDER, SPELLS } from './spells.js';
import { TEMPLATES } from './recognizer.js';
import * as meta from './meta.js';
import { STAGES, STAGE_ORDER, STAGE_GIMMICKS } from './story.js';
import { INGREDIENTS, RECIPES, RECIPE_BY_ID, platePrice, canCook, ZODIAC, ZODIAC_BY_ID } from './cooking.js';
import { ARTIFACTS, artifactById, UPGRADES, upgradeRarity } from './upgrades.js';
import { MINIGAMES, setIconDrawer } from './minigames.js';
import { CARDS, CARD_BY_ID, CARD_RARITY } from './cards.js';
import { spriteImg, gearImg, iconImg, iconCanvas, pixify, pixifyHtml, SPELL_SPRITE, COMBO_SPRITE, PET_SPRITE } from './pixelicons.js';

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
      killsWrap: $('kills-wrap'), sobrietyWrap: $('sobriety-wrap'), clockWrap: $('clock-wrap'),
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
      minigame: $('minigame'), mgTitle: $('mg-title'), mgSub: $('mg-sub'), mgCanvas: $('mg-canvas'),
      mgControls: $('mg-controls'), mgHud: $('mg-hud'), mgTimer: $('mg-timer'), mgQuit: $('mg-quit'),
      end: $('end'), endTitle: $('end-title'), endStats: $('end-stats'), btnAgain: $('btn-again'),
      loading: $('loading'),
      bars: document.querySelector('.bars'), spellbook: $('spellbook'), castHint: $('cast-hint'),
      gold: $('gold'), gems: $('gems'), clock: $('clock'), wave: $('wave'), banner: $('banner'), interactPrompt: $('interact-prompt'), btnInteract: $('btn-interact'), btnInteractLabel: $('btn-interact-label'),
      camControls: $('cam-controls'), camLeft: $('cam-left'), camReset: $('cam-reset'), camRight: $('cam-right'),
      stageBanner: $('stage-banner'), stageTint: $('stage-tint'), missionHud: $('mission-hud'),
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
      runMap: $('run-map'), chat: $('chat'),
      mapHud: $('map-hud'), mapTitleText: $('map-title-text'), mapRetreat: $('map-retreat'), mapHint: $('map-hint'),
      btnGuide: $('btn-guide'), btnPause: $('btn-pause'), btnMute: $('btn-mute'),
      btnQuests: $('btn-quests'), btnInv: $('btn-inv'),
      questPanel: $('quest-panel'), qpBody: $('qp-body'), qpClose: $('qp-close'),
      buildPreview: $('build-preview'), bpCanvas: $('bp-canvas'), bpLabel: $('bp-label'), bpRotate: $('bp-rotate'), buildPlace: $('build-place'),
      comboHud: $('combo-hud'), comboN: $('combo-n'),
      merchant: $('merchant'), merchCards: $('merch-cards'), merchGems: $('merch-gems'), merchLeave: $('merch-leave'),
      joystick: $('joystick'), joyKnob: $('joy-knob'), blackout: $('blackout'), wipe: $('wipe'),
      glyphGuide: $('glyph-guide'), guideCards: $('guide-cards'), btnGuideClose: $('btn-guide-close'),
    };
    this.chips = {}; // rebuilt per run from the loadout
    this._storyCb = null;
    this._storyLines = [];
    this._storyIdx = 0;
  }

  init(game) {
    this.game = game;
    // stamp every <i class="pix" data-pix="..."> in the static markup with its sprite
    document.querySelectorAll('i.pix[data-pix]').forEach(el => { el.innerHTML = iconImg(el.dataset.pix, {}, el.dataset.cls || ''); });
    // hand the minigames a way to stamp pixel sprites onto their canvas (keeps
    // minigames.js import-free for the node test suite)
    setIconDrawer((ctx, key, x, y, size) => {
      const c = iconCanvas(key, { scale: 6 }); if (!c) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(c, x - size / 2, y - size / 2, size, size);
    });
    this.el.btnStart.addEventListener('click', () => { game.audio.resume(); game.audio.play('click'); this.showSlots(); });
    this.el.btnAgain.addEventListener('click', () => { game.audio.play('click'); this.wipe('iris', () => game.enterResto()); });
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
    const btnCook = document.getElementById('btn-cookbook');
    const inService = () => { if (game._service && game._service.active) { this.toast('🍳 Finish the dinner service first!'); return true; } return false; };
    if (btnCook) { this.el.btnCookbook = btnCook; btnCook.addEventListener('click', () => { if (inService()) return; game.audio.play('click'); this._mb ? this.hideMenuBook() : this.showMenuBook(game); }); }
    const btnZod = document.getElementById('btn-zodiac');
    if (btnZod) { this.el.btnZodiac = btnZod; btnZod.addEventListener('click', () => { if (inService()) return; game.audio.play('click'); this._zd ? this.hideZodiac() : this.showZodiac(game); }); }
    if (this.el.btnInv) this.el.btnInv.addEventListener('click', () => { game.audio.play('click'); this.openInventory(game); });
    // dining-hall walk arrows: hold to move (feeds game._restoNudge)
    const wireArrow = (el, dir) => {
      if (!el) return;
      const down = (e) => { e.preventDefault(); game._restoNudge = dir; };
      const up = () => { if (game._restoNudge === dir) game._restoNudge = 0; };
      el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
    };
    wireArrow(document.getElementById('resto-left'), -1);
    wireArrow(document.getElementById('resto-right'), 1);
    const bServe = document.getElementById('btn-resto-serve');
    if (bServe) { this.el.btnRestoServe = bServe; bServe.addEventListener('click', () => { game.audio.play('click'); game.interact(); }); }
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
      } else if (act === 'claimside') {
        const r = meta.claimSideQuest(b.dataset.id);
        if (r && r.card) { this.toast(`🃏 ${r.card.name} card earned!${r.fresh ? '' : ' (dupe)'}`); this.burstFX(b, 'sparkle', 8); game.audio.play('win'); }
      }
      this.renderQuestPanel(game);
    });
    this.el.btnGuideClose.addEventListener('click', () => { game.audio.play('click'); game.toggleGuide(); });
    this.el.btnInteract.addEventListener('click', () => game.interact());
    if (this.el.btnDrink) this.el.btnDrink.addEventListener('click', () => game.drink());
    // camera turn controls (snap ±30°; middle-drag & [ ] keys also turn)
    if (this.el.camLeft) this.el.camLeft.addEventListener('click', () => { game.turnCamera(-1); game.audio.play('click'); });
    if (this.el.camRight) this.el.camRight.addEventListener('click', () => { game.turnCamera(1); game.audio.play('click'); });
    if (this.el.camReset) this.el.camReset.addEventListener('click', () => { game.resetCamera(); game.audio.play('click'); });
    if (this.el.mapRetreat) this.el.mapRetreat.addEventListener('click', () => { game.audio.play('click'); game.retreatFromMap(); });
    if (this.el.btnBuild) this.el.btnBuild.addEventListener('click', () => game.openBuild());
    this.el.shopClose.addEventListener('click', () => { game.audio.play('click'); game.closeShop(); });
    if (this.el.bpRotate) this.el.bpRotate.addEventListener('click', () => { this.burstFX(this.el.bpRotate, 'sparkle', 5); if (game.rotateBuild) { game.rotateBuild(); if (!this._buildPending && game._inBuild && game._inBuild()) game.buildHover(this._lastBuildX || 0, this._lastBuildY || 0); } });
    // the room itself is the build grid: hover the floor to preview a hologram, click to place
    if (this.el.buildPlace) {
      this.el.buildPlace.addEventListener('pointermove', (e) => { this._lastBuildX = e.clientX; this._lastBuildY = e.clientY; if (game.buildHover) game.buildHover(e.clientX, e.clientY); });
      this.el.buildPlace.addEventListener('pointerdown', (e) => { this._lastBuildX = e.clientX; this._lastBuildY = e.clientY; if (game.buildPlaceAt) game.buildPlaceAt(e.clientX, e.clientY); });
    }
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
    // party-minigame controls: delegated button bar, canvas taps, and forfeit (wired once)
    if (this.el.mgControls) this.el.mgControls.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mg]'); if (b) this._mgInput({ type: 'button', id: b.dataset.mg });
    });
    if (this.el.mgCanvas) this.el.mgCanvas.addEventListener('pointerdown', (e) => {
      if (!this._mgRunning) return;
      const r = this.el.mgCanvas.getBoundingClientRect();
      this._mgInput({ type: 'pointer', nx: (e.clientX - r.left) / (r.width || 1), ny: (e.clientY - r.top) / (r.height || 1) });
    });
    // Forfeit = true abandon: end with score 0 (no banked partial progress, no exploit)
    if (this.el.mgQuit) this.el.mgQuit.addEventListener('click', () => { if (this._mgRunning) { const key = this._mgKey; this.hideMinigame(); if (this.game) this.game.resolveMinigame(key, 0); } });
    if (this.el.artClaim) this.el.artClaim.addEventListener('click', () => { game.audio.play('click'); const cb = this._artRevealDone; this._artRevealDone = null; this.el.artReveal.classList.add('hidden'); if (cb) cb(); });
    // region level map: tap a reachable node to descend, or retreat
    if (this.el.runMap) this.el.runMap.addEventListener('click', (e) => {
      const n = e.target.closest('[data-node]'); if (n && !n.disabled) { game.chooseMapNode(n.dataset.node); return; }
      const r = e.target.closest('[data-rm]'); if (r) game.retreatFromMap();
    });
    // cinematic tavern chat buttons
    if (this.el.chat) this.el.chat.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chat]'); if (!b) return;
      const act = b.dataset.chat;
      if (act === 'claim') game.chatClaim();
      else if (act === 'accept') game.chatAccept();
      else if (act === 'ask') game.chatAsk();
      else game.endChat();
    });
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
      chip.innerHTML = `<span class="glyph">${spriteImg(SPELL_SPRITE[id], {}, 'sm', s.glyph)}</span><span class="name">${s.name}</span><span class="key">${i + 1}</span>`;
      chip.addEventListener('click', () => this.game.castById(id));
      this.el.spellbook.appendChild(chip);
      this.chips[id] = chip;
    });
    this.buildGuide(loadout);
  }

  setGold(n) { if (this.el.gold) this.el.gold.textContent = `${n}`; if (this.el.shopGold) this.el.shopGold.textContent = `${n}`; this.setGems(meta.gems()); }

  // ---- the quest log side panel (debt + bounty + the learn-the-ropes checklist) ----
  toggleQuestPanel(game) {
    const p = this.el.questPanel; if (!p) return;
    if (game && game.state !== 'play' && game.state !== 'resto' && !p.classList.contains('show')) return; // not while a chat/menu/cutscene owns the screen
    if (p.classList.contains('show')) { p.classList.remove('show'); return; }
    this.renderQuestPanel(game); p.classList.add('show');
  }
  openInventory(game) {
    if (game && game.state !== 'play' && game.state !== 'resto') return; // not mid-chat/cutscene
    // the Character Hall room is gone — the satchel opens straight from the dining hall now
    this._charTab = 'satchel'; if (game._openShop) game._openShop('character'); else this.openShop('character', game);
  }
  // dead-simple quest log: just your GOAL (debt + the one bounty) and your JOBS.
  renderQuestPanel(game) {
    const body = this.el.qpBody; if (!body) return;
    const debt = meta.debt(), total = meta.DEBT_TOTAL || 1, paid = Math.max(0, total - debt);
    const q = meta.currentQuest(), done = meta.questDone();
    // ---- GOAL: pay off the debt, then claim the bounty that unlocks the next station ----
    let h = `<div class="qp-card"><h4>${iconImg('⚜', {}, 'sm')} Goal</h4>`;
    if (debt > 0) {
      h += `<p class="qp-sub">Pay off the tavern debt.</p>
        <div class="debt-bar"><div class="debt-fill" style="width:${100 * paid / total}%"></div></div>
        <div class="qp-progress">${paid} / ${total} gold</div>
        <div class="shop-acts" style="margin-top:8px"><button class="shop-btn" data-act="paydebt" ${meta.gold() > 0 ? '' : 'disabled'}>Pay ${Math.min(meta.gold(), debt)} gold</button></div>`;
    } else {
      h += `<div class="qp-progress" style="color:var(--xp)">✓ Debt cleared — the Toad is yours!</div>`;
    }
    if (q) h += `<div class="qp-task ${done ? 'done' : ''}" style="margin-top:10px"><span class="tick">${done ? '✓' : iconImg('pin', {}, 'sm')}</span><span>${pixify(q.text, 'sm')} · +${q.reward} ${iconImg('coin', {}, 'sm')}</span>${done ? ` <button class="shop-btn on" data-act="claim">Claim</button>` : ''}</div>`;
    h += `</div>`;
    // ---- JOBS: accepted patron quests (return to the patron to claim when ready) ----
    const reqs = meta.acceptedQuests();
    h += `<div class="qp-card"><h4>${iconImg('scroll', {}, 'sm')} Jobs</h4>`;
    if (reqs.length) {
      h += '<div class="qp-tasklist">';
      for (const cq of reqs) {
        const ready = meta.customerQuestReady(cq);
        h += `<div class="qp-task ${ready ? 'done' : ''}"><span class="tick">${ready ? '✓' : '○'}</span><span>${pixify(cq.ask, 'sm')}${ready ? ' <b>(ready!)</b>' : ''}</span></div>`;
      }
      h += '</div>';
    } else h += `<div class="qp-progress">No jobs — chat a ${iconImg('bang', {}, 'sm')} patron to take one.</div>`;
    // fold in any ready-to-claim side reward so it isn't lost
    for (const sq of meta.sideQuests().filter(s => s.ready && !s.claimed)) h += `<div class="qp-task"><span class="tick">${iconImg('target', {}, 'sm')}</span><span>${pixify(sq.text, 'sm')}</span> <button class="shop-btn" data-act="claimside" data-id="${sq.id}">Claim</button></div>`;
    h += `</div>`;
    body.innerHTML = h;
  }
  setGems(n) { if (this.el.gems) this.el.gems.textContent = `${n}`; if (this.el.shopGems) this.el.shopGems.textContent = `${n}`; }
  setClock(day) { if (this.el.clock) this.el.clock.textContent = `Day ${day}`; }

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
      label.innerHTML = `<span class="guide-glyph">${spriteImg(SPELL_SPRITE[id], {}, 'sm', s.glyph)}</span> ${s.name} <span class="key">${i + 1}</span>`;
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

  // the spell's NAME drifts up in glowing arcane script when you cast — no toast boxes,
  // no "clean/sloppy" grading text. Crit = bigger, gold, flanked by flourishes.
  castWord(text, { color = '#c9b6ff', crit = false, big = false } = {}) {
    const w = document.createElement('div');
    w.className = 'cast-word' + (crit ? ' crit' : '') + (big ? ' big' : '');
    w.textContent = crit || big ? `✦ ${text} ✦` : text;
    w.style.setProperty('--cw', color);
    w.style.left = `calc(50% + ${Math.round((Math.random() - 0.5) * 90)}px)`;
    w.style.setProperty('--tilt', ((Math.random() - 0.5) * 6).toFixed(1) + 'deg');
    document.body.appendChild(w); // body, not #toast-area (its transform breaks position:fixed)
    setTimeout(() => w.remove(), crit || big ? 1300 : 950);
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
    const arena = phase === 'arena', world = phase === 'world', tavern = phase === 'tavern', room = phase === 'room', resto = phase === 'resto';
    const hub = tavern || room || world || resto;
    this.el.bars.classList.toggle('hidden', hub);        // vitals only in the fight
    this.el.spellbook.classList.toggle('hidden', !arena);
    // toggle the whole stat PILLS (icon + number), not just the inner number
    if (this.el.sobrietyWrap) this.el.sobrietyWrap.classList.toggle('hidden', !arena);
    this.el.timer.classList.toggle('hidden', !arena || isTouch);  // calmer fight HUD on phones
    if (this.el.killsWrap) this.el.killsWrap.classList.toggle('hidden', !arena || isTouch);
    if (this.el.clockWrap) this.el.clockWrap.classList.toggle('hidden', arena); // clock shows in the hubs
    this.el.waveWrap.classList.add('hidden');
    if (this.el.bossBar) this.el.bossBar.classList.add('hidden');
    this.el.tavernHud.classList.add('hidden');
    this.el.btnGuide.classList.toggle('hidden', !arena);
    if (this.el.btnQuests) this.el.btnQuests.classList.toggle('hidden', !(tavern || room || resto)); // quest log in the hub
    if (this.el.btnCookbook) this.el.btnCookbook.classList.toggle('hidden', !(tavern || room)); // the menu book opens from the resto book station
    if (this.el.btnZodiac) this.el.btnZodiac.classList.toggle('hidden', !(tavern || room));     // the star chart opens from the resto book too
    if (this.el.btnInv) this.el.btnInv.classList.toggle('hidden', !(tavern || room || resto));  // gear satchel reachable from the hall
    if (this.el.questPanel && !(tavern || room)) this.el.questPanel.classList.remove('show');
    if (this.el.btnDrink) this.el.btnDrink.classList.toggle('hidden', !arena); // drink only in the fight
    if (this.el.drinkBar && !arena) this.el.drinkBar.classList.add('hidden');
    if (this.el.btnBuild) this.el.btnBuild.classList.toggle('hidden', !room);  // build only in your room
    // dining-hall walk arrows: shown whenever you're in the restaurant
    const arrows = document.getElementById('resto-arrows');
    if (arrows) arrows.classList.toggle('hidden', !resto);
    if (this.el.btnRestoServe) this.el.btnRestoServe.classList.toggle('hidden', true); // shown only during service (game toggles it)
    if (this.el.abilityTray) this.el.abilityTray.classList.toggle('hidden', !arena || !this.el.abilityTray.innerHTML);
    if (this.el.drunkWrap) this.el.drunkWrap.classList.toggle('hidden', !arena);
    if (!arena) this.hideCombo();   // never let the combo counter linger outside a fight
    if (this.el.questTracker) { this.el.questTracker.classList.toggle('hidden', !(tavern || room)); this._qtSig = null; } // main-quest tracker in the hub
    if (!world) this.hideWorldHud();
    if (this.el.camControls) this.el.camControls.classList.toggle('hidden', !(arena || tavern || room)); // turn the camera in any 3D scene
    if (!arena && !world) { this.el.interactPrompt.classList.add('hidden'); this.el.btnInteract.classList.add('hidden'); }
    if (tavern) this.el.castHint.innerHTML = pixifyHtml(isTouch ? 'Wander to a <b>table</b> for an order, pour at the <b>bar</b>, carry it back · 🪜 room · 🚪 venture' : 'Take an order at a <b>table</b>, pour at the <b>bar</b>, carry it back to <b>serve</b> for tips · <b>🚪</b> venture · <b>🪜</b> room · press <b>E</b>', 'sm');
    else if (room) this.el.castHint.innerHTML = pixifyHtml(isTouch ? 'Tap <b>🔨 Build</b> to place stations & furniture · tap a station to use it' : 'Press <b>🔨 Build</b> to craft & place stations · walk to one and press <b>E</b> to use it · stairs to go down', 'sm');
    else if (world) this.el.castHint.innerHTML = isTouch ? 'Tap a <b>region</b> to scout it · then <b>Venture</b>' : 'Click a <b>region</b> to scout it · then <b>Venture</b>';
    else if (resto) this.el.castHint.innerHTML = pixifyHtml(isTouch ? 'Drag to look around · tap <b>tables & stations</b> to build · the 🔔 <b>bell</b> opens for the night' : 'Drag to look around · click <b>tables & stations</b> to build · the 🔔 <b>bell</b> opens service · <b>ESC</b> leaves', 'sm');
    else this.el.castHint.innerHTML = pixifyHtml(isTouch ? 'Left = move · <b>draw a glyph</b> on the right to cast · 🍺 hold to chug (fills mana)' : 'Hold <b>Right-Mouse</b> and draw a glyph · <b>WASD</b> move · <b>Q</b> to chug (fills mana) · keys <b>1–3</b>', 'sm');
  }

  showLoadScene(text) { if (this.el.loadscene) { if (this.el.loadsceneText) this.el.loadsceneText.textContent = text || 'Loading…'; this.el.loadscene.classList.remove('hidden'); } }
  hideLoadScene() { if (this.el.loadscene) this.el.loadscene.classList.add('hidden'); }

  // update the map's hovered-node info bar
  // ---- the 3D world map HUD: a side panel that scouts the selected region ----
  _wmOrder() { return STAGE_ORDER.filter(id => STAGE_MAP[id] && STAGES[id]); }
  _wmUnlocked(id) { const o = this._wmOrder(), i = o.indexOf(id); return i <= 0 || meta.regionUnlockedByStars(i); }
  showWorldHud(game, id) {
    if (!this.el.worldDetail) return;
    const s = STAGES[id], m = STAGE_MAP[id];
    const order = this._wmOrder(), idx = order.indexOf(id);
    const unlocked = this._wmUnlocked(id), cleared = meta.stageCleared(id);
    const access = cleared ? '<span class="wm-done-t">✓ Conquered</span>' : unlocked ? '<span class="wm-open-t">Open — ready to venture</span>' : `${iconImg('lock', {}, 'sm')} Needs ${iconImg('star', {}, 'sm')} <b>${meta.regionStarReq(idx)}</b> — have ${meta.totalStars()}`;
    this.el.worldDetail.innerHTML = `
      <div class="wmd-head"><span class="wmd-ico" style="filter:drop-shadow(0 0 8px ${m.tone})">${unlocked ? iconImg(m.icon, {}, 'lg') : iconImg('lock', {}, 'lg')}</span>
        <div><div class="wmd-name" style="color:${m.tone}">${s.name}</div>
        <div class="wmd-sub">Region ${idx + 1} of ${order.length} · ${iconImg('crown', {}, 'sm')} ${s.bossName}</div></div></div>
      <div class="wmd-rows">
        <div class="wmd-row"><span>Danger</span><b>${iconImg('skull', {}, 'sm').repeat(m.danger)}</b></div>
        <div class="wmd-row"><span>Access</span><b>${access}</b></div>
        <div class="wmd-row"><span>Stages</span><b>${cleared ? `${iconImg('trophy', {}, 'sm')} 10 / 10` : `${meta.regionBest(id)} / 10 reached`}</b></div>
        <div class="wmd-row"><span>Stars</span><b>${iconImg('star', {}, 'sm')} ${meta.regionStars(id)} / 30</b></div>
        <div class="wmd-row"><span>Loot</span><b>${pixify(m.loot, 'sm')}</b></div>
      </div>
      <button class="btn big wmd-venture" data-act="venture" ${unlocked ? '' : 'disabled'}>${unlocked ? '▸ Venture here' : `${iconImg('lock', {}, 'sm')} Locked`}</button>
      <button class="btn wmd-back" data-act="back">◂ Back to the bar</button>`;
    this.el.worldHud.classList.remove('hidden');
  }
  hideWorldHud() { if (this.el.worldHud) this.el.worldHud.classList.add('hidden'); }

  // ---- region level map: a Mewgenics / Slay-the-Spire branching node map ----
  // ---- the run map: a 3D candy-crush winding level trail. The region is a single chain of
  // 10 levels; we lay them out as a bobbing S-curve of glossy numbered bubbles climbing to
  // the boss, a fat candy path linking them, a star rating stamped under each, and reward
  // charms floating beside cache/rest levels. Stars you bank here unlock the next region. ----
  showRunMap(game) {
    const el = this.el.runMap; if (!el) return;
    const map = game._runMap; if (!map) return;
    const cur = game._mapNodeId;                 // null = run not started
    const visited = game._mapVisited || new Set();
    const region = game._runRegion;
    const reach = new Set();
    if (cur == null) reach.add(map.startId);
    else { const c = map.byId[cur]; if (c) c.next.forEach(id => reach.add(id)); }
    const curRow = cur != null && map.byId[cur] ? map.byId[cur].row : -1;
    const META = { combat: ['⚔️', 'Skirmish'], elite: ['💀', 'Elite'], treasure: ['💰', 'Cache'], campfire: ['🔥', 'Rest'], event: ['❓', 'Mystery'], skill: ['✶', 'Trial'], minigame: ['🎲', 'Game'], boss: ['👑', 'Boss Lair'] };
    const REWARD = { treasure: '💎', campfire: '❤️', minigame: '🎲' }; // little charm shown beside reward levels

    // winding S-curve layout: row 0 (entrance) at the BOTTOM, boss at the TOP — you climb up
    const rows = map.rows, AMP = 92, ROWH = 108, PADX = 64, PADY = 70, R = 1;
    const CX = PADX + AMP, W = CX * 2, H = PADY * 2 + (rows - 1) * ROWH;
    const X = (r) => CX + Math.sin(r * 0.9 + 0.5) * AMP;
    const Y = (r) => PADY + (rows - 1 - r) * ROWH;
    const rr = (v) => Math.round(v * 10) / 10;
    const pts = map.nodes.slice().sort((a, b) => a.row - b.row).map(n => ({ n, x: X(n.row), y: Y(n.row) }));
    const smooth = (arr) => {
      const m = arr.length; if (m < 2) return '';
      let d = `M ${rr(arr[0].x)} ${rr(arr[0].y)}`;
      for (let i = 0; i < m - 1; i++) { const p = arr[i], q = arr[i + 1]; d += ` Q ${rr(p.x)} ${rr(p.y)} ${rr((p.x + q.x) / 2)} ${rr((p.y + q.y) / 2)}`; }
      const last = arr[m - 1]; d += ` L ${rr(last.x)} ${rr(last.y)}`; return d;
    };
    const basePath = smooth(pts);
    const donePts = pts.filter(p => p.n.row <= curRow);
    const donePath = donePts.length >= 2 ? smooth(donePts) : '';
    // the glowing "next" connector from where you stand to the reachable level
    let openPath = '';
    if (cur != null) { const nx = pts.find(p => reach.has(p.n.id)); const c = pts.find(p => p.n.id === cur); if (nx && c) openPath = smooth([c, nx]); }

    const relic = game._opArtifact; // guaranteed boss-drop relic, previewed on the boss node
    let nodes = '';
    for (const p of pts) {
      const n = p.n, mt = META[n.type] || META.combat;
      const isCur = n.id === cur, isReach = reach.has(n.id), isVis = visited.has(n.id) && !isCur;
      const isBoss = n.type === 'boss';
      const cls = ['rm-node', 'rm-' + n.type, isCur ? 'cur' : '', isReach ? 'reach' : '', isVis ? 'done' : ''].filter(Boolean).join(' ');
      const tip = isBoss && relic ? `Boss — wins ${relic.name}` : mt[1];
      // main face: boss shows a crown, everyone else the level number with a small type badge
      const face = isBoss
        ? `<span class="rm-face rm-boss-face">${iconImg('crown', {}, 'md')}</span>`
        : `<span class="rm-face"><b class="rm-num">${n.row + 1}</b><span class="rm-badge">${iconImg(mt[0], {}, 'sm')}</span></span>`;
      // star rating stamped under the bubble (best you've earned on this level)
      const got = meta.stageStars(region, n.row + 1);
      let stars = '';
      for (let i = 0; i < 3; i++) stars += `<span class="rm-star ${i < got ? 'on' : ''}">${iconImg('star', {}, 'sm')}</span>`;
      // reward charm beside cache / rest / game levels ("rewards between")
      const charm = REWARD[n.type] ? `<span class="rm-charm">${iconImg(REWARD[n.type], {}, 'sm')}</span>` : '';
      nodes += `<button class="${cls}" data-node="${n.id}" title="${tip}" style="left:${rr(p.x)}px;top:${rr(p.y)}px" ${isReach ? '' : 'disabled'}>${face}${charm}<span class="rm-stars">${stars}</span></button>`;
    }

    // banner: region name + your star bank and the next region's unlock gate
    const order = this._wmOrder(); const rIdx = order.indexOf(region);
    const total = meta.totalStars();
    const nextId = order[rIdx + 1];
    const nextReq = nextId ? meta.regionStarReq(rIdx + 1) : 0;
    const nextName = nextId && STAGES[nextId] ? STAGES[nextId].name : '';
    const gate = nextId
      ? `<div class="rm-gate ${total >= nextReq ? 'open' : ''}">${iconImg('star', {}, 'sm')} <b>${total}</b>/${nextReq} to unlock ${nextName}</div>`
      : `<div class="rm-gate open">${iconImg('star', {}, 'sm')} <b>${total}</b> stars banked</div>`;
    const regionName = (STAGES[region] && STAGES[region].name) || 'The Path';
    el.innerHTML = `<div class="rm-frame">
      <div class="rm-banner">${iconImg('map', {}, 'sm')} ${regionName}</div>
      ${gate}
      <div class="rm-tip">${cur == null ? 'Tap the first level to begin your climb' : 'Tap the next level to press on'}${relic ? ` · ${iconImg('crown', {}, 'sm')} boss drops ${iconImg(relic.icon, {}, 'sm')} ${relic.name}` : ''}</div>
      <div class="rm-scroll"><div class="rm-graph" style="width:${W}px;height:${H}px">
        <svg class="rm-edges" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
          <path class="rm-trail-base" d="${basePath}"/>
          ${donePath ? `<path class="rm-trail-done" d="${donePath}"/>` : ''}
          ${openPath ? `<path class="rm-trail-open" d="${openPath}"/>` : ''}
        </svg>${nodes}
      </div></div>
      <button class="btn rm-retreat" data-rm="retreat">◂ ${cur == null ? 'Back to realm' : 'Retreat'}</button>
    </div>`;
    el.classList.remove('hidden');
    // start scrolled to the bottom (the entrance / where you stand) so the climb reads upward
    const sc = el.querySelector('.rm-scroll'); if (sc) { const target = cur != null ? Math.max(0, Y(curRow) - sc.clientHeight * 0.78) : sc.scrollHeight; sc.scrollTop = target; }
  }
  hideRunMap() { if (this.el.runMap) this.el.runMap.classList.add('hidden'); }
  // HUD for the 3D level-map scene (region name + retreat + control hint)
  showMapHud(game) {
    if (!this.el.mapHud) return;
    const id = game._runRegion; const nm = (STAGES[id] && STAGES[id].name) || 'Region';
    if (this.el.mapTitleText) this.el.mapTitleText.textContent = nm;
    if (this.el.castHint) this.el.castHint.classList.add('hidden'); // the map-hint replaces the world cast-hint
    this.el.mapHud.classList.remove('hidden');
  }
  hideMapHud() { if (this.el.mapHud) this.el.mapHud.classList.add('hidden'); }

  // ---- cinematic tavern chat (letterbox + dialogue) ----
  showChat(game, station) {
    const el = this.el.chat; if (!el || !station) return;
    const npc = station.npc || {};
    const q = station.quest;
    let body, btns;
    // "tell me more" response (a choice the player picked → the patron elaborates)
    const detail = (game && game._chatAsked)
      ? `<div class="chat-detail">"${q ? (q.kind === 'clear' ? 'Fell the champion of that cursed place and bring me word — I\'ll make it worth your while.' : 'Push as deep as you dare into any region. Reach that stage and the deed is done.') : 'Aye, the old Toad\'s seen better nights. Sit, drink, and mind Tomas\' furniture, eh?'}"</div>`
      : '';
    if (q) {
      const ready = meta.customerQuestReady(q);
      const prog = meta.customerQuestProgress(q);
      const r = q.reward || {};
      const rewardStr = [r.gold ? `${r.gold} ${iconImg('coin', {}, 'sm')}` : '', r.gems ? `${r.gems} ${iconImg('💎', {}, 'sm')}` : ''].filter(Boolean).join(' · ') || '—';
      body = `<div class="chat-ask">${iconImg(q.icon || 'scroll', {}, 'sm')} ${pixify(q.ask, 'sm')}</div>${detail}<div class="chat-prog">${pixify(prog, 'sm')}</div><div class="chat-reward">${iconImg('gift', {}, 'sm')} ${rewardStr}</div>`;
      if (!q.accepted) btns = `<button class="btn chat-go" data-chat="accept">${iconImg('scroll', {}, 'sm')} Accept the job</button><button class="btn chat-ask" data-chat="ask">Tell me more</button><button class="btn chat-no" data-chat="leave">Not now</button>`;
      else if (ready) btns = `<button class="btn chat-go" data-chat="claim">${iconImg('hand', {}, 'sm')} Hand it over</button><button class="btn chat-no" data-chat="leave">Leave</button>`;
      else btns = `<button class="btn chat-ask" data-chat="ask">Tell me more</button><button class="btn chat-no" data-chat="leave">I'll be back</button>`;
    } else {
      body = `<div class="chat-ask">A friendly face by the fire.</div>${detail}`;
      btns = `<button class="btn chat-go" data-chat="claim">${iconImg('beer', {}, 'sm')} Cheers!</button><button class="btn chat-ask" data-chat="ask">Chat a while</button><button class="btn chat-no" data-chat="leave">Leave</button>`;
    }
    el.innerHTML = `<div class="chat-bar top"></div>
      <div class="chat-box">
        <div class="chat-main">
          <div class="chat-name">${npc.name || 'Patron'}</div>
          <div class="chat-line">"${npc.line || 'Well met, wizard.'}"</div>
          <div class="chat-body">${body}</div>
          <div class="chat-btns">${btns}</div>
        </div>
      </div>
      <div class="chat-bar bottom"></div>`;
    el.classList.remove('hidden');
    this._typeInto(el.querySelector('.chat-line')); // typewriter the opening line
  }
  // typewriter-reveal an element's own text (used for dialogue lines)
  _typeInto(lineEl) {
    if (this._chatTyper) { clearInterval(this._chatTyper); this._chatTyper = null; }
    if (!lineEl) return;
    const text = lineEl.textContent; let i = 0;
    lineEl.textContent = '';
    this._chatTyper = setInterval(() => {
      i += 2; lineEl.textContent = text.slice(0, i);
      if (i >= text.length) { lineEl.textContent = text; clearInterval(this._chatTyper); this._chatTyper = null; }
    }, 18);
  }
  // swap the dialogue to a closing "thank you" beat after a claim/tip
  chatResult(game, line, rewardText) {
    const box = this.el.chat && this.el.chat.querySelector('.chat-main'); if (!box) return;
    box.innerHTML = `<div class="chat-line">${line}</div>${rewardText ? `<div class="chat-reward">${rewardText}</div>` : ''}<div class="chat-btns"><button class="btn chat-go" data-chat="leave">Farewell ▸</button></div>`;
    this._typeInto(box.querySelector('.chat-line'));
  }
  hideChat() { if (this._chatTyper) { clearInterval(this._chatTyper); this._chatTyper = null; } if (this.el.chat) this.el.chat.classList.add('hidden'); }

  // ---- acquired abilities + artifacts: a stacking tray, top-left ----
  setAbilities(abilities, artifacts) {
    const tray = this.el.abilityTray; if (!tray) return;
    abilities = abilities || []; artifacts = artifacts || [];
    if (!abilities.length && !artifacts.length) { tray.innerHTML = ''; tray.classList.add('hidden'); return; }
    let h = '<div class="abil-label">Abilities</div><div class="abil-row">';
    for (const a of artifacts) h += `<div class="abil art" title="✦ ARTIFACT — ${a.name}"><span class="abil-ico">${iconImg(a.icon, {}, 'sm')}</span></div>`;
    for (const a of abilities) h += `<div class="abil" title="${a.name}${a.count > 1 ? ` ×${a.count}` : ''}"><span class="abil-ico">${iconImg(a.icon, {}, 'sm')}</span>${a.count > 1 ? `<span class="abil-x">${a.count}</span>` : ''}</div>`;
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
      this.el.pathBoss.innerHTML = `${iconImg('crown', {}, 'sm')} <b>${stage.bossName}</b> guards a relic — clear the lair to claim <span class="pb-art">✦ ${artifact.name}</span>`;
    } else this.el.pathBoss.classList.add('hidden');
    this.el.pathDoors.innerHTML = '';
    this._pathDoors = [];
    const sides = ['◂ LEFT', 'RIGHT ▸'];
    nodes.forEach((n, i) => {
      const door = document.createElement('div'); door.className = 'path-door'; door.dataset.door = i;
      const side = document.createElement('div'); side.className = 'door-side'; side.textContent = sides[i] || 'Enter';
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 150; cv.className = 'door-art';
      const lurk = document.createElement('div'); lurk.className = 'door-lurk'; lurk.innerHTML = pixify(n.lurk || '👁 something lurks within…', 'sm');
      const node = document.createElement('div'); node.className = 'door-reward';
      node.innerHTML = `<span class="door-ico">${iconImg(n.icon, {}, 'md')}</span><div class="door-rw-txt"><div class="door-name">${n.name}</div><div class="door-desc">${pixify(n.desc, 'sm')}</div></div>`;
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
    this.el.eventIcon.innerHTML = iconImg(ev.icon || 'question', {}, 'xl');
    this.el.eventTitle.textContent = ev.title || 'A Mystery';
    this.el.eventPrompt.textContent = ev.prompt || '';
    this.el.eventSkill.classList.add('hidden');
    this.el.eventOpts.classList.remove('hidden');
    this.el.eventOpts.innerHTML = '';
    ev.opts.forEach((o, i) => {
      const afford = !o.minGems || meta.gems() >= o.minGems;
      const b = document.createElement('button');
      b.className = 'btn event-opt'; b.dataset.opt = i; if (!afford) b.disabled = true;
      b.innerHTML = `<span class="eo-label">${pixify(o.label, 'sm')}</span><span class="eo-tip">${afford ? pixify(o.tip || '', 'sm') : `not enough ${iconImg('💎', {}, 'sm')}`}</span>`;
      this.el.eventOpts.appendChild(b);
    });
    this.el.eventModal.classList.remove('hidden');
  }
  // (the old event-modal customer request was replaced by the cinematic showChat flow)
  // ---- skill event: stop the sweeping marker on the green mark ----
  showSkillEvent(game) {
    this.el.eventIcon.innerHTML = '<span class="event-glyph">✶</span>';
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

  // ====================== party minigames (generic canvas driver) ======================
  showMinigame(game, key) {
    const mg = MINIGAMES[key];
    if (!mg) { game.resolveMinigame(key, 0); return; }
    this._mgKey = key; this._mg = mg;
    this._mgState = mg.init({ rng: Math.random });
    this._mgState.timeLeft = mg.dur;
    if (this.el.mgTitle) this.el.mgTitle.innerHTML = `${iconImg('dice', {}, 'sm')} ${mg.name}`;
    if (this.el.mgSub) this.el.mgSub.innerHTML = pixify(mg.how, 'sm');
    this._mgRenderControls(mg);
    // un-hide FIRST so the canvas reports its real CSS box, THEN size the backing store
    // (a hidden element's clientWidth/Height are 0 -> would force the blurry 400×440 fallback)
    if (this.el.minigame) this.el.minigame.classList.remove('hidden');
    const cv = this.el.mgCanvas;
    if (cv) { const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = (cv.clientWidth || 400) * dpr; cv.height = (cv.clientHeight || 440) * dpr; }
    if (!this._mgLoopBound) this._mgLoopBound = this._mgLoop.bind(this);
    if (!this._mgKeyHandler) this._mgKeyHandler = (e) => { if (this._mgRunning) this._mgInput({ type: 'key', key: e.key }); };
    window.addEventListener('keydown', this._mgKeyHandler);
    this._mgRunning = true;
    this._mgLast = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    cancelAnimationFrame(this._mgRaf);
    this._mgRaf = requestAnimationFrame(this._mgLoopBound);
  }
  _mgRenderControls(mg) {
    const host = this.el.mgControls; if (!host) return;
    host.innerHTML = '';
    const ctrls = mg.controls || [];
    if (!ctrls.length) { host.innerHTML = `<div class="mg-hint">${iconImg('hand', {}, 'sm')} tap the board</div>`; return; }
    for (const c of ctrls) {
      const b = document.createElement('button');
      b.className = 'btn mg-btn' + (c.big ? ' big' : '');
      b.dataset.mg = c.id; b.innerHTML = pixify(c.label, 'sm');
      if (c.color) b.style.background = c.color;
      host.appendChild(b);
    }
  }
  _mgLoop(now) {
    const s = this._mgState, mg = this._mg; if (!s || !mg || !this._mgRunning) return;
    let dt = (now - this._mgLast) / 1000; this._mgLast = now;
    if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
    mg.update(s, dt); s.timeLeft -= dt;
    try { const cv = this.el.mgCanvas; if (cv) mg.draw(cv.getContext('2d'), cv.width, cv.height, s); } catch (e) {}
    if (this.el.mgTimer) this.el.mgTimer.textContent = Math.max(0, s.timeLeft).toFixed(1);
    if (mg.isOver(s) || s.timeLeft <= 0) { this._mgEnd(); return; }
    this._mgRaf = requestAnimationFrame(this._mgLoopBound);
  }
  _mgInput(ev) { const s = this._mgState, mg = this._mg; if (!s || !mg || !this._mgRunning) return; try { mg.onInput(s, ev); } catch (e) {} }
  _mgEnd() {
    if (!this._mg || !this._mgState) { this.hideMinigame(); return; }
    const score = this._mg.scoreOf(this._mgState);
    const key = this._mgKey;
    this.hideMinigame();
    if (this.game) this.game.resolveMinigame(key, score);
  }
  hideMinigame() {
    this._mgRunning = false;
    cancelAnimationFrame(this._mgRaf);
    if (this._mgKeyHandler) window.removeEventListener('keydown', this._mgKeyHandler);
    this._mgState = null; this._mg = null;
    if (this.el.minigame) this.el.minigame.classList.add('hidden');
  }

  // ---- the end-of-level artifact reveal: a dramatic, glowing relic screen ----
  showArtifactReveal(a, onDone) {
    this._artRevealDone = onDone || null;
    if (this.el.artRevealIcon) this.el.artRevealIcon.innerHTML = a ? iconImg(a.icon, {}, 'xl') : '✦';
    if (this.el.artRevealName) this.el.artRevealName.textContent = a ? a.name : 'A Relic';
    if (this.el.artRevealDesc) this.el.artRevealDesc.textContent = a ? a.desc : '';
    const o = this.el.artReveal; if (!o) { if (onDone) onDone(); return; }
    o.classList.remove('hidden');
    o.classList.remove('show'); void o.offsetWidth; o.classList.add('show'); // restart the entrance
    if (this.game && this.game.audio) this.game.audio.play('win');
  }

  // treasure-chest reward reveal — a magical burst card, not a boring toast.
  // built on the fly + appended to <body> so no fixed-position parent can squash it.
  showChestReward(reward, onDone) {
    let done = false;
    const finish = () => { if (done) return; done = true; ov.classList.remove('show'); setTimeout(() => ov.remove(), 340); if (onDone) onDone(); };
    const RC = meta.RARITIES || {};
    const tier = reward.tier || 'common';
    const col = (RC[tier] && RC[tier].color) || '#f0a92e';
    let iconHtml = '✦', title = 'Treasure', sub = '';
    if (reward.kind === 'gear' && reward.inst) {
      const rc = RC[reward.inst.rarity] || {};
      iconHtml = gearImg(reward.inst, 'xl'); title = reward.inst.name; sub = `${rc.name || ''} ${reward.inst.slot || ''}`.trim();
    } else if (reward.kind === 'gems') {
      iconHtml = iconImg('💎', {}, 'xl'); title = `+${reward.amount} Gems`; sub = tier === 'rare' ? 'A glittering haul!' : 'Arcane gemstones';
    } else if (reward.kind === 'heart') {
      iconHtml = iconImg('❤️', {}, 'xl'); title = '+25 Max HP'; sub = 'A heartier vessel — fully restored';
    } else if (reward.kind === 'brew') {
      iconHtml = iconImg('🍺', {}, 'xl'); title = 'Brewfont'; sub = 'Bigger mug · heartier brew';
    }
    if (reward.bonusGems) sub += ` · +${reward.bonusGems} 💎`;
    const rare = (tier === 'legendary' || tier === 'epic');
    const ov = document.createElement('div');
    ov.className = 'chest-reward-overlay' + (rare ? ' cr-rare' : '');
    ov.style.setProperty('--rc', col);
    ov.innerHTML = `<div class="cr-rays"></div><div class="cr-card">
      <div class="cr-banner">${tier === 'legendary' ? 'JACKPOT!' : 'Treasure!'}</div>
      <div class="cr-icon">${iconHtml}</div>
      <div class="cr-title">${pixifyHtml(title)}</div>
      <div class="cr-sub">${pixify(sub)}</div>
      <div class="cr-tap">tap to claim</div></div>`;
    document.body.appendChild(ov);
    void ov.offsetWidth; ov.classList.add('show');
    ov.addEventListener('click', finish);
    if (this.game && this.game.audio) this.game.audio.play(tier === 'legendary' ? 'win' : 'jobDone');
    this._chestRewardT = setTimeout(finish, tier === 'legendary' ? 4200 : 3000);
  }

  // YOUR QUEST splash — stamps the game's two goals once, right after the intro scold.
  showGoalSplash(onDone) {
    if (meta.hasSeen && meta.hasSeen('goalsplash')) { if (onDone) onDone(); return; }
    if (meta.markSeen) meta.markSeen('goalsplash');
    const el = document.getElementById('goal-splash'); if (!el) { if (onDone) onDone(); return; }
    el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('show');
    if (this.game && this.game.audio) this.game.audio.play('levelup');
    let done = false;
    const finish = () => { if (done) return; done = true; el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 320); if (onDone) onDone(); };
    el.addEventListener('click', finish, { once: true });
    setTimeout(finish, 4200);
  }

  // ===== the TELEPORTER: a slot machine you spin to roll the next stage =====
  showTeleporter(game, opts) {
    this.hideTeleporter();
    const entrance = !!opts.entrance;
    // WHERE reel: boss stage is locked to the lair; the first venture is always the
    // entrance skirmish; otherwise the full encounter pool.
    const ENC = opts.isBoss ? [{ k: 'boss', i: '👑', t: 'BOSS LAIR' }]
      : entrance ? [{ k: 'combat', i: '⚔️', t: 'Skirmish' }]
        : [{ k: 'combat', i: '⚔️', t: 'Skirmish' }, { k: 'elite', i: '💀', t: 'Elite Pack' }, { k: 'treasure', i: '💰', t: 'Cache' }, { k: 'campfire', i: '🔥', t: 'Rest' }, { k: 'event', i: '❓', t: 'Mystery' }, { k: 'minigame', i: '🎲', t: 'Party Game' }];
    // TWIST reel: real per-stage gimmicks only — never the boss-lair objective
    const TW = STAGE_GIMMICKS.map((g, idx) => ({ idx, i: g.icon || '✦', t: g.name })).filter(e => STAGE_GIMMICKS[e.idx].mission !== 'boss');
    const BOUNTY = [{ k: 'gems', i: '💎', t: 'Gems' }, { k: 'heart', i: '❤️', t: 'Heal' }, { k: 'brew', i: '🍺', t: 'Brew' }, { k: 'gear', i: '🛡️', t: 'Gear' }, { k: 'ability', i: '✨', t: 'Power' }];
    // the entrance fight always drops a generic reward, so only show reels that matter
    const cfg = [{ id: 'enc', lbl: 'WHERE', list: ENC, key: 'encounter', pick: (p) => p.k, dur: 900 },
      { id: 'tw', lbl: 'TWIST', list: TW, key: 'twistIdx', pick: (p) => p.idx, dur: 1300 }];
    if (!entrance) cfg.push({ id: 'bt', lbl: 'BOUNTY', list: BOUNTY, key: 'bounty', pick: (p) => p.k, dur: 1700 });
    const ov = document.createElement('div'); ov.id = 'teleporter';
    ov.innerHTML = `
      <div class="tp-frame">
        <div class="tp-title">✦ TELEPORTER ✦</div>
        <div class="tp-sub">Stage ${opts.stageNum}/${opts.total} · spin to roll your fate</div>
        <div class="tp-reels">${cfg.map(c => `<div class="tp-reel" data-r="${c.id}"><div class="tp-lbl">${c.lbl}</div><div class="tp-win"><span class="tp-i">?</span><span class="tp-t">— —</span></div></div>`).join('')}</div>
        <button class="btn big tp-spin">▸ SPIN</button>
        <button class="btn big tp-launch" style="display:none">✦ LAUNCH! ✦</button>
        <button class="btn tp-back">◀ Back to the bar</button>
      </div>`;
    document.body.appendChild(ov); this._tp = ov; this._tpTimers = [];
    const set = (win, e) => { win.querySelector('.tp-i').textContent = e.i; win.querySelector('.tp-t').textContent = e.t; };
    const spinBtn = ov.querySelector('.tp-spin'), launchBtn = ov.querySelector('.tp-launch');
    ov.querySelector('.tp-back').onclick = () => { if (game.audio) game.audio.play('click'); game.retreatFromMap(); };
    let spinning = false;
    const spinReel = (win, list, dur, onStop) => {
      const box = win.parentElement; box.classList.add('spin');
      const iv = setInterval(() => { set(win, list[(Math.random() * list.length) | 0]); }, 70);
      this._tpTimers.push(iv);
      const to = setTimeout(() => { clearInterval(iv); const pick = list[(Math.random() * list.length) | 0]; set(win, pick); box.classList.remove('spin'); box.classList.add('landed'); setTimeout(() => box.classList.remove('landed'), 400); if (game.audio) game.audio.play('click'); onStop(pick); }, dur);
      this._tpTimers.push(to);
    };
    spinBtn.onclick = () => {
      if (spinning) return; spinning = true; spinBtn.disabled = true;
      if (game.audio) game.audio.play('levelup');
      const res = {}; const last = cfg.length - 1;
      cfg.forEach((c, i) => {
        const win = ov.querySelector(`[data-r="${c.id}"] .tp-win`);
        spinReel(win, c.list, c.dur, (p) => {
          res[c.key] = c.pick(p);
          if (i === last) { this._tpResult = res; launchBtn.style.display = ''; launchBtn.classList.add('pop'); if (game.audio) game.audio.play('win'); }
        });
      });
    };
    launchBtn.onclick = () => { if (!this._tpResult) return; launchBtn.disabled = true; game.resolveTeleport(this._tpResult); };
    void ov.offsetWidth; ov.classList.add('show');
  }
  hideTeleporter() { if (this._tpTimers) { for (const t of this._tpTimers) { clearInterval(t); clearTimeout(t); } this._tpTimers = null; } if (this._tp) { this._tp.remove(); this._tp = null; } this._tpResult = null; }

  // ===== the CATAPULT launch: a quick DOM cutscene flinging the wizard into the stage =====
  showCatapult(onDone) {
    const ov = document.createElement('div'); ov.id = 'catapult';
    ov.innerHTML = `
      <div class="cp-sky"></div>
      <div class="cp-ground"></div>
      <div class="cp-machine"><div class="cp-base"></div><div class="cp-arm"><div class="cp-bucket"></div></div></div>
      <div class="cp-wiz">🧙</div>
      <div class="cp-word">WHEEE!</div>`;
    document.body.appendChild(ov);
    void ov.offsetWidth; ov.classList.add('go');
    let done = false;
    const finish = () => { if (done) return; done = true; ov.classList.add('flash'); setTimeout(() => { ov.remove(); if (onDone) onDone(); }, 180); };
    setTimeout(finish, 1650);
  }

  // ===== COOK TIMING: the quick service-cook — stop the sweeping flame in the gold zone =====
  showCookTiming(recipe, onDone) {
    this.hideCookTiming();
    const ov = document.createElement('div'); ov.id = 'cooktime';
    ov.innerHTML = `
      <div class="ct-card">
        <div class="ct-name">${recipe.icon} ${recipe.name}</div>
        <div class="ct-bar"><div class="ct-zone"></div><div class="ct-perfect"></div><div class="ct-marker">🔥</div></div>
        <div class="ct-hint">E / tap — stop the flame in the gold!</div>
      </div>`;
    document.body.appendChild(ov); this._ct = ov;
    const marker = ov.querySelector('.ct-marker');
    let t = 0, dir = 1, sweeps = 0, done = false, last = performance.now(), raf = 0;
    this._ctAbort = () => { done = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); }; // external teardown (service ended underneath)
    const finish = (quality) => {
      if (done) return; done = true;
      cancelAnimationFrame(raf); this._ctAbort = null;
      window.removeEventListener('keydown', onKey); ov.removeEventListener('pointerdown', onTap);
      ov.classList.add(quality >= 1.3 ? 'ct-win' : 'ct-ok');
      this._ctTimer = setTimeout(() => { this._ctTimer = null; this.hideCookTiming(); onDone(quality); }, quality >= 1.3 ? 520 : 300);
    };
    const stop = () => { const d = Math.abs(t - 0.5); finish(Math.max(0.5, Math.min(1.5, 1.5 - d * 3.2))); };
    const onKey = (e) => { const k = e.key.toLowerCase(); if (k === 'e' || k === ' ' || k === 'enter' || k === 'f') { e.preventDefault(); stop(); } };
    const onTap = () => stop();
    window.addEventListener('keydown', onKey); ov.addEventListener('pointerdown', onTap);
    const loop = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      t += dir * dt * 1.15;
      if (t > 1) { t = 1; dir = -1; sweeps++; } else if (t < 0) { t = 0; dir = 1; sweeps++; }
      if (sweeps >= 4) { finish(0.7); return; } // dawdled — a passable plate
      marker.style.left = (t * 100) + '%';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    void ov.offsetWidth; ov.classList.add('show');
  }
  hideCookTiming() {
    if (this._ctTimer) { clearTimeout(this._ctTimer); this._ctTimer = null; } // kill a pending result-flash callback
    if (this._ctAbort) { this._ctAbort(); this._ctAbort = null; }
    if (this._ct) { this._ct.remove(); this._ct = null; }
  }

  // ===== 3D COOKING-MAMA: a real little kitchen scene rendered in THREE —
  // CHOP the ingredient, SIZZLE it to a golden brown, PLATE it with a flourish.
  // Returns true if it spun up; false (so the caller falls back to 2D) if WebGL
  // couldn't start. Contract: onDone(score 0..1) once; ✕ → onDone(0). =====
  _showCookOff3D(game, recipe, onDone) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ing = Object.keys(recipe.needs || {})[0];
    const tintHex = { boarmeat: 0xc05a4a, lizardtail: 0x6aa050, slimejelly: 0x4ad0a8, shroomcap: 0xd8465e,
      hydrawing: 0xd8905a, chamflank: 0x9a6ad0, whaleblub: 0x8fb6d0, batwing: 0x8c6fb8, wildherb: 0x6ab04a }[ing] || 0xc9704a;
    const ov = document.createElement('div'); ov.id = 'cookoff'; ov.className = 'cook3d';
    ov.innerHTML = `
      <div class="co-head"><span class="co-title">COOK-OFF</span><span class="co-dish">${recipe.icon || ''} ${recipe.name}</span><button class="btn co-quit">✕</button></div>
      <canvas class="co-canvas3d"></canvas>
      <div class="co-phase"></div>
      <div class="co-hint"></div>
      <div class="co-meter"><div class="co-band"></div><div class="co-fill"></div></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('.co-canvas3d');
    const W = Math.min(660, window.innerWidth - 28), H = Math.max(240, Math.min(420, Math.round(window.innerHeight * 0.5)));
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); }
    catch (e) { ov.remove(); return false; }
    if (!renderer) { ov.remove(); return false; }
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    cam.position.set(0, 3.9, 5.6); cam.lookAt(0, 0.3, -0.1);
    scene.add(new THREE.HemisphereLight(0xfff2e0, 0x2a2018, 1.05));
    const key = new THREE.DirectionalLight(0xfff0d2, 1.5); key.position.set(3.4, 7, 4.5); scene.add(key);
    const warm = new THREE.PointLight(0xffb060, 0.8, 22); warm.position.set(-2.6, 3, 2.4); scene.add(warm);
    const disposables = [];
    const M = (c, r = 0.82, m = 0, e = 0) => { const mat = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e, emissiveIntensity: e ? 0.9 : 0, flatShading: true }); disposables.push(mat); return mat; };
    const geo = (g) => { disposables.push(g); return g; };
    const glowMat = (c) => { const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }); disposables.push(mat); return mat; };
    // ---- kitchen dressing ----
    const counter = new THREE.Mesh(geo(new THREE.BoxGeometry(14, 0.7, 7)), M(0x6a4a2c, 0.9)); counter.position.y = -0.35; scene.add(counter);
    const wall = new THREE.Mesh(geo(new THREE.BoxGeometry(14, 7, 0.4)), M(0x9a7250, 0.95)); wall.position.set(0, 3, -3.2); scene.add(wall);
    for (let i = -2; i <= 2; i++) { const tile = new THREE.Mesh(geo(new THREE.BoxGeometry(2.2, 2.2, 0.1)), M(i % 2 ? 0xa88058 : 0xb89060, 0.9)); tile.position.set(i * 2.4, 2.4, -2.98); scene.add(tile); }
    const board = new THREE.Mesh(geo(new THREE.BoxGeometry(4.4, 0.26, 2.7)), M(0xcaa06a, 0.7)); board.position.set(0, 0.13, 0.3); scene.add(board);
    // ---- actors, reused across phases ----
    const food = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.62, 1.9, 6, 12)), M(tintHex, 0.6)); food.rotation.z = Math.PI / 2; food.position.set(0, 0.55, 0.3); scene.add(food);
    const knife = new THREE.Group();
    const blade = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.9, 1.5)), M(0xd6dde4, 0.25, 0.7)); blade.position.y = -0.45; knife.add(blade);
    const handle = new THREE.Mesh(geo(new THREE.BoxGeometry(0.16, 0.7, 0.22)), M(0x4a2f1a, 0.7)); handle.position.y = 0.35; knife.add(handle);
    knife.position.set(-1.4, 1.7, 0.3); scene.add(knife);
    const pan = new THREE.Group();
    const panBody = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.5, 1.35, 0.3, 22)), M(0x2a2632, 0.4, 0.6)); pan.add(panBody);
    const panHandle = new THREE.Mesh(geo(new THREE.BoxGeometry(2.4, 0.18, 0.28)), M(0x1a1622, 0.5, 0.4)); panHandle.position.set(2.3, 0.02, 0); pan.add(panHandle);
    pan.position.set(0, 0.3, 0.3); pan.visible = false; scene.add(pan);
    const plate = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.7, 1.5, 0.16, 26)), M(0xf0ead8, 0.45)); plate.position.set(0, 0.24, 0.3); plate.visible = false; scene.add(plate);
    const ring = new THREE.Mesh(geo(new THREE.TorusGeometry(1.2, 0.06, 8, 32)), glowMat(0xffd76a)); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.5, 0.3); ring.visible = false; scene.add(ring);
    // ---- juice pops ----
    const pops = [];
    const popGeo = geo(new THREE.BoxGeometry(0.16, 0.16, 0.16));
    const spawnPops = (pos, color, n = 10, up = 4) => {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(popGeo, glowMat(color));
        m.position.copy(pos); scene.add(m);
        pops.push({ m, vx: (Math.random() - 0.5) * 4, vy: up + Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 0.7 });
      }
    };
    // ---- phase machine ----
    const phaseLbl = ov.querySelector('.co-phase'), hintLbl = ov.querySelector('.co-hint');
    const meter = ov.querySelector('.co-meter'), fill = ov.querySelector('.co-fill'), band = ov.querySelector('.co-band');
    band.style.bottom = '55%'; band.style.height = '30%';
    const names = ['CHOP!', 'SIZZLE!', 'PLATE!'];
    const s = { phase: 0, t: 0, scores: [], chop: { taps: 0, hits: 0, kAnim: 0 }, sizzle: { heat: 0, inBand: 0, dur: 5, done: 0 }, plate: { r: 1.4, round: 0, score: 0 } };
    let held = false, done = false, raf = 0, last = performance.now(), torn = false, shake = 0;
    const setPhaseUI = () => {
      phaseLbl.textContent = names[s.phase];
      meter.style.display = s.phase === 1 ? 'block' : 'none';
      hintLbl.textContent = s.phase === 0 ? 'TAP as the knife crosses the food' : s.phase === 1 ? 'HOLD to keep the heat in the golden band' : 'TAP when the ring meets the plate';
      if (s.phase === 1) { food.visible = true; knife.visible = false; pan.visible = true; food.position.set(0, 0.55, 0.3); food.scale.setScalar(1); food.rotation.set(Math.PI / 2, 0, 0); }
      if (s.phase === 2) { pan.visible = false; food.visible = true; plate.visible = true; ring.visible = true; food.position.set(0, 0.4, 0.3); food.scale.setScalar(0.7); }
    };
    const nextPhase = (score) => {
      s.scores.push(Math.max(0, Math.min(1, score)));
      s.phase++; s.t = 0;
      if (s.phase >= 3) {
        const total = s.scores.reduce((a, b) => a + b, 0) / 3;
        finish(total); return;
      }
      setPhaseUI(); if (game.audio) game.audio.play('levelup');
    };
    const press = () => {
      if (done) return;
      if (s.phase === 0) {
        s.chop.taps++; s.chop.kAnim = 1;
        const near = Math.abs(knife.position.x - (food.position.x)) < 0.55; // knife over the food
        if (near) { s.chop.hits++; if (game.audio) game.audio.play('hit'); shake = 6; spawnPops(new THREE.Vector3(knife.position.x, 0.6, 0.3), tintHex, 12, 5); }
        if (s.chop.taps >= 5) nextPhase(s.chop.hits / 5);
      } else if (s.phase === 2) {
        const d = Math.abs(s.plate.r - 1.15);
        s.plate.score += Math.max(0, 1 - d * 3.5);
        spawnPops(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6, 0.3), 0xb9ff7a, 8, 3); if (game.audio) game.audio.play('click');
        s.plate.round++; s.plate.r = 1.4;
        if (s.plate.round >= 3) nextPhase(s.plate.score / 3);
      }
    };
    const onDown = (e) => { if (e.target.closest('.co-quit')) return; held = true; press(); e.preventDefault(); };
    const onUp = () => { held = false; };
    const onKey = (e) => { const k = e.key.toLowerCase(); if (k === 'e' || k === ' ' || k === 'enter') { if (!e.repeat) press(); held = true; e.preventDefault(); } };
    const onKeyUp = (e) => { const k = e.key.toLowerCase(); if (k === 'e' || k === ' ' || k === 'enter') held = false; };
    cv.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    const cleanup = () => { cv.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
    const teardown = () => {
      if (torn) return; torn = true;
      cancelAnimationFrame(raf); cleanup();
      for (const p of pops) scene.remove(p.m);
      for (const d of disposables) { if (d.dispose) d.dispose(); }
      try { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) {}
      ov.remove();
    };
    const quitBtn = ov.querySelector('.co-quit');
    quitBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this._coAbort = () => { if (this._coTimer) { clearTimeout(this._coTimer); this._coTimer = null; } teardown(); this._coAbort = null; };
    quitBtn.onclick = () => { if (done) return; done = true; const ab = this._coAbort; if (ab) ab(); onDone(0); };
    const finish = (total) => {
      if (done) return; done = true;
      ov.classList.add('co-done');
      phaseLbl.textContent = total >= 0.85 ? '✨ MASTERFUL! ✨' : total >= 0.6 ? '😋 Delicious!' : '💨 A bit rough…';
      hintLbl.textContent = '';
      if (game.audio) game.audio.play(total >= 0.6 ? 'win' : 'hurt');
      spawnPops(new THREE.Vector3(0, 1, 0.3), total >= 0.6 ? 0xffd76a : 0x8a6a4a, 26, 6);
      this._coTimer = setTimeout(() => { this._coTimer = null; this._coAbort = null; teardown(); onDone(total); }, 1300);
    };
    setPhaseUI();
    const loop = (now) => {
      if (done && !this._coTimer) { return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      s.t += dt; shake = Math.max(0, shake - dt * 30);
      // per-phase sim
      if (!done) {
        if (s.phase === 0) {
          knife.position.x = Math.sin(s.t * 3.2) * 1.5;
          s.chop.kAnim = Math.max(0, s.chop.kAnim - dt * 4);
          knife.position.y = 1.7 - (1 - Math.pow(1 - s.chop.kAnim, 2)) * 1.0; // chop down-bob
          knife.rotation.z = s.chop.kAnim * 0.3;
          food.scale.x = 1 - s.chop.hits * 0.13; // the log shortens as it's sliced
        } else if (s.phase === 1) {
          const z = s.sizzle;
          z.heat += (held ? 1.5 : -1.1) * dt; z.heat = Math.max(0, Math.min(1, z.heat));
          const inBand = z.heat > 0.55 && z.heat < 0.85;
          if (inBand) z.inBand += dt;
          z.dur -= dt;
          fill.style.height = (z.heat * 100).toFixed(0) + '%';
          fill.style.background = inBand ? '#ffd76a' : '#ff7a4a';
          // brown the patty as it cooks
          const cook = Math.min(1, z.inBand / 3);
          food.material.color.lerpColors(new THREE.Color(tintHex), new THREE.Color(0x6a3a1e), cook);
          if (inBand && Math.random() < 0.35) spawnPops(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.55, 0.3), 0xffb35a, 2, 3);
          pan.position.y = 0.3 + Math.sin(s.t * 20) * (held ? 0.04 : 0.01);
          if (z.dur <= 0) nextPhase(Math.min(1, z.inBand / 3));
        } else if (s.phase === 2) {
          s.plate.r -= dt * 0.85;
          if (s.plate.r < 0.25) { s.plate.round++; s.plate.r = 1.4; if (s.plate.round >= 3) nextPhase(s.plate.score / 3); }
          ring.scale.setScalar(Math.max(0.05, s.plate.r));
          food.rotation.y += dt * 1.5;
        }
      }
      // pops
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]; p.life -= dt;
        if (p.life <= 0) { scene.remove(p.m); pops.splice(i, 1); continue; }
        p.vy -= 12 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
        p.m.material.opacity = Math.max(0, p.life / 0.7); p.m.rotation.x += dt * 8;
      }
      cam.position.x = Math.sin(shake) * 0.05 * shake; cam.lookAt(0, 0.3, -0.1);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    void ov.offsetWidth; ov.classList.add('show');
    return true;
  }

  // ===== COOK-OFF: the Cooking-Mama practice minigame — CHOP! SIZZLE! SEASON! =====
  // A full-screen canvas with three juicy phases; onDone(score 0..1).
  // Entry point: try the juicy 3D cooking-mama scene; fall back to the 2D canvas
  // minigame if a WebGL context can't be spun up. Same contract either way:
  // onDone(score in [0,1]) fires exactly once; ✕ quit → onDone(0); this._coAbort
  // is a silent teardown (no onDone) for closeModals/scene changes.
  showCookOff(game, recipe, onDone) {
    try {
      if (this._showCookOff3D(game, recipe, onDone)) return;
    } catch (e) { /* fall through to the trusty 2D version */ }
    this._showCookOff2D(game, recipe, onDone);
  }
  _showCookOff2D(game, recipe, onDone) {
    const ov = document.createElement('div'); ov.id = 'cookoff';
    ov.innerHTML = `<div class="co-head"><span class="co-title">COOK-OFF</span><span class="co-dish">${recipe.icon} ${recipe.name}</span><button class="btn co-quit">✕</button></div>
      <canvas class="co-canvas"></canvas><div class="co-phase"></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('.co-canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.min(560, window.innerWidth - 40), H = 380;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const x = cv.getContext('2d'); x.scale(dpr, dpr);
    const phaseLbl = ov.querySelector('.co-phase');
    const s = { phase: 0, t: 0, shake: 0, pops: [], // pops: little burst rings for juice
      chop: { hits: 0, taps: 0, kx: 0 },            // knife marches; tap on the marks
      sizzle: { heat: 0, inBand: 0, dur: 5 },        // hold to keep the heat in the gold band
      season: { ring: 1.4, round: 0, score: 0 },     // shrinking ring; tap at the circle
      scores: [] };
    let held = false, done = false, raf = 0, last = performance.now();
    const names = ['CHOP!', 'SIZZLE!', 'SEASON!'];
    const pop = (px, py, col) => { s.pops.push({ x: px, y: py, r: 6, col, a: 1 }); s.shake = 5; if (game.audio) game.audio.play('click'); };
    const nextPhase = (score) => {
      s.scores.push(Math.max(0, Math.min(1, score)));
      s.phase++; s.t = 0;
      if (s.phase >= 3) {
        done = true; cancelAnimationFrame(raf); cleanup();
        const total = s.scores.reduce((a, b) => a + b, 0) / 3;
        ov.classList.add('co-done');
        phaseLbl.textContent = total >= 0.85 ? '✨ MASTERFUL! ✨' : total >= 0.6 ? '😋 Delicious!' : '💨 A bit burnt…';
        if (game.audio) game.audio.play(total >= 0.6 ? 'win' : 'hurt');
        this._coTimer = setTimeout(() => { this._coTimer = null; this._coAbort = null; ov.remove(); onDone(total); }, 1200);
      } else { phaseLbl.textContent = names[s.phase]; if (game.audio) game.audio.play('levelup'); }
    };
    const press = (px) => {
      if (s.phase === 0) { // chop: knife at kx, targets every 20%
        s.chop.taps++;
        const near = Math.abs(((s.chop.kx * 5) % 1) - 0.5) < 0.22; // near a chop mark
        if (near) { s.chop.hits++; pop(60 + s.chop.kx * (W - 120), H * 0.5, '#ffd76a'); }
        if (s.chop.taps >= 5) nextPhase(s.chop.hits / 5);
      } else if (s.phase === 2) { // season: tap when the ring meets the circle
        const d = Math.abs(s.season.ring - 0.52);
        s.season.score += Math.max(0, 1 - d * 4.5);
        pop(W / 2, H * 0.52, '#b9ff7a');
        s.season.round++; s.season.ring = 1.4;
        if (s.season.round >= 3) nextPhase(s.season.score / 3);
      }
    };
    const onDown = (e) => { held = true; press(); e.preventDefault(); };
    const onUp = () => { held = false; };
    const onKey = (e) => { const k = e.key.toLowerCase(); if (k === 'e' || k === ' ' || k === 'enter') { if (!e.repeat) press(); held = true; e.preventDefault(); } };
    const onKeyUp = () => { held = false; };
    ov.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    const cleanup = () => { ov.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
    const quitBtn = ov.querySelector('.co-quit');
    quitBtn.addEventListener('pointerdown', (e) => e.stopPropagation()); // don't count as a chop
    // silent teardown for closeModals — no onDone, so nothing reopens over a scene change
    this._coAbort = () => {
      done = true; cancelAnimationFrame(raf); cleanup();
      if (this._coTimer) { clearTimeout(this._coTimer); this._coTimer = null; }
      ov.remove(); this._coAbort = null;
    };
    quitBtn.onclick = () => { if (done) return; const ab = this._coAbort; if (ab) ab(); onDone(0); };
    phaseLbl.textContent = names[0];
    const loop = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      s.t += dt; s.shake = Math.max(0, s.shake - dt * 30);
      x.clearRect(0, 0, W, H);
      x.save(); if (s.shake > 0) x.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      // board
      x.fillStyle = '#2a2140'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#181228'; x.fillRect(10, 10, W - 20, H - 20);
      if (s.phase === 0) { // CHOP: a marching knife over 5 marks
        s.chop.kx = (s.t * 0.28) % 1;
        x.fillStyle = '#7a5a34'; x.fillRect(40, H * 0.52, W - 80, 26); // the board
        const sausage = 60 + ((s.chop.taps) / 5) * 0; // the roast
        x.fillStyle = '#c05a4a'; x.beginPath(); x.roundRect(60, H * 0.44, W - 120, 34, 16); x.fill();
        for (let k = 0; k < 5; k++) { const mx = 60 + ((k + 0.5) / 5) * (W - 120); x.strokeStyle = k < s.chop.taps ? '#4a3020' : '#ffd76a'; x.lineWidth = 4; x.beginPath(); x.moveTo(mx, H * 0.40); x.lineTo(mx, H * 0.52 + 30); x.stroke(); }
        const kx = 60 + s.chop.kx * (W - 120);
        x.font = '44px sans-serif'; x.textAlign = 'center'; x.fillText('🔪', kx, H * 0.36);
      } else if (s.phase === 1) { // SIZZLE: hold to keep heat in the gold band
        const z = s.sizzle;
        z.heat += (held ? 1.4 : -1.1) * dt; z.heat = Math.max(0, Math.min(1, z.heat));
        const inBand = z.heat > 0.55 && z.heat < 0.85;
        if (inBand) z.inBand += dt;
        z.dur -= dt;
        x.font = '64px sans-serif'; x.textAlign = 'center'; x.fillText('🍳', W / 2, H * 0.42);
        if (inBand && Math.random() < 0.4) pop(W / 2 + (Math.random() - 0.5) * 90, H * 0.35, '#ffb35a');
        const bx = W / 2 - 30, bh = H - 120;
        x.fillStyle = '#0e0a18'; x.beginPath(); x.roundRect(bx, 60, 60, bh, 12); x.fill();
        x.fillStyle = 'rgba(255,215,106,0.35)'; x.fillRect(bx, 60 + bh * 0.15, 60, bh * 0.3); // gold band (inverted: top = hot)
        const hy = 60 + bh * (1 - z.heat);
        x.fillStyle = inBand ? '#ffd76a' : '#ff7a4a'; x.beginPath(); x.roundRect(bx + 6, hy, 48, 60 + bh - hy - 6, 8); x.fill();
        if (z.dur <= 0) nextPhase(z.inBand / 3.2);
      } else { // SEASON: tap as the shrinking ring meets the plate
        s.season.ring -= dt * 0.75;
        if (s.season.ring < 0.2) { s.season.round++; s.season.ring = 1.4; } // missed the window
        x.font = '58px sans-serif'; x.textAlign = 'center'; x.fillText('🍲', W / 2, H * 0.56);
        x.strokeStyle = '#b9ff7a'; x.lineWidth = 3; x.beginPath(); x.arc(W / 2, H * 0.52, 62, 0, 6.28); x.stroke(); // the target
        x.strokeStyle = '#ffd76a'; x.lineWidth = 6; x.beginPath(); x.arc(W / 2, H * 0.52, 120 * s.season.ring, 0, 6.28); x.stroke();
        x.font = '26px sans-serif'; x.fillText('🧂'.repeat(Math.max(0, 3 - s.season.round)), W / 2, 46);
        if (s.season.round >= 3 && s.phase === 2) nextPhase(s.season.score / 3);
      }
      // juice pops
      for (let i = s.pops.length - 1; i >= 0; i--) { const p = s.pops[i]; p.r += 90 * dt; p.a -= 2.4 * dt; if (p.a <= 0) { s.pops.splice(i, 1); continue; } x.globalAlpha = p.a; x.strokeStyle = p.col; x.lineWidth = 3; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.28); x.stroke(); x.globalAlpha = 1; }
      x.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    void ov.offsetWidth; ov.classList.add('show');
  }

  // ===== the MENU: a REAL restaurant menu card — courses, dotted price leaders,
  // pixel-painted plates, mastery stars, and cook-off practice per dish =====
  static MENU_SECTIONS = [
    { title: 'THE HOUSE STAPLE', ids: ['alebread'] },
    { title: 'GREENS & SMALL PLATES', ids: ['herbsalad', 'batsnack'] },
    { title: 'FROM THE HUNT', ids: ['boarchop', 'tailskewer', 'shroomstew', 'wingplatter', 'chamsteak', 'blubberpot'] },
    { title: 'SWEET THINGS', ids: ['jellyflan'] },
  ];
  showMenuBook(game) {
    this.hideMenuBook();
    const inv = meta.pantry();
    const ov = document.createElement('div'); ov.id = 'menubook';
    const pantryRow = Object.entries(INGREDIENTS).map(([id, ing]) =>
      `<span class="mb-ing ${(inv[id] || 0) > 0 ? '' : 'none'}" title="${ing.name}">${spriteImg('ing_' + id, {}, 'mb-ingico', ing.icon)}×${inv[id] || 0}</span>`).join('');
    const dishRow = (r) => {
      const m = meta.recipeMastery(r.id);
      const stars = '★'.repeat(m) + '<span class="dim">' + '★'.repeat(5 - m) + '</span>';
      const needs = Object.entries(r.needs).map(([id, n]) => { const have = inv[id] || 0; return `<span class="${have >= n ? 'ok' : 'lack'}">${spriteImg('ing_' + id, {}, 'mb-needico', INGREDIENTS[id].icon)}${have}/${n}</span>`; }).join(' ') || '<span class="ok">always stocked</span>';
      const price = platePrice(r, m);
      const cookable = canCook(r, inv) && r.id !== 'alebread';
      return `<div class="mb-card" data-r="${r.id}">
        <div class="mb-ico">${spriteImg('dish_' + r.id, { scale: 4 }, 'mb-dish', r.icon)}</div>
        <div class="mb-mid">
          <div class="mb-name"><span>${r.name}</span><span class="mb-lead"></span><span class="mb-price">${price} ${iconImg('🪙', {}, 'sm')}</span></div>
          <div class="mb-stars">${stars}</div>
          <div class="mb-desc">${r.desc}</div>
          <div class="mb-needs">${needs}</div>
        </div>
        <div class="mb-right">
        ${r.id !== 'alebread' ? `<button class="btn mb-cook" data-r="${r.id}" ${cookable && m < 5 ? '' : 'disabled'}>COOK-OFF</button>` : ''}</div>
      </div>`;
    };
    const sections = UI.MENU_SECTIONS.map(sec => {
      const rows = sec.ids.map(id => RECIPE_BY_ID[id]).filter(Boolean).map(dishRow).join('');
      return `<div class="mb-section"><div class="mb-sechead">✦ ${sec.title} ✦</div>${rows}</div>`;
    }).join('');
    ov.innerHTML = `<div class="mb-frame">
      <div class="mb-head"><span class="mb-title">${iconImg('🍳', {}, 'sm')} THE TIPSY TOAD</span><button class="btn mb-close">✕</button></div>
      <div class="mb-tagline">— wildwood kitchen · est. the night no one came —</div>
      <div class="mb-pantry">${iconImg('🧺', {}, 'sm')} PANTRY · ${pantryRow}</div>
      <div class="mb-list">${sections}</div>
      <div class="mb-foot">hunt the wild larder · practice COOK-OFFS to master dishes · masters charge more</div>
    </div>`;
    document.body.appendChild(ov); this._mb = ov;
    ov.querySelector('.mb-close').onclick = () => { if (game.audio) game.audio.play('click'); this.hideMenuBook(); };
    for (const btn of ov.querySelectorAll('.mb-cook')) {
      btn.onclick = () => {
        const r = RECIPE_BY_ID[btn.dataset.r];
        if (!meta.pantrySpend(r.needs)) { this.toast('🧺 Not enough ingredients in the pantry.'); return; }
        this.hideMenuBook();
        if (game.audio) game.audio.play('levelup');
        this.showCookOff(game, r, (score) => {
          if (score >= 0.6) { meta.bumpMastery(r.id); this.toast(`⭐ ${r.name} mastered up! ${meta.recipeMastery(r.id)}/5`); }
          else this.toast('💨 Burnt it… the ingredients are spent, but so is the lesson.');
          this.showMenuBook(game); // back to the book with fresh numbers
        });
      };
    }
    void ov.offsetWidth; ov.classList.add('show');
  }
  hideMenuBook() { if (this._mb) { this._mb.remove(); this._mb = null; } }

  // ===== the ZODIAC: step through the book into the ASTRAL REALM — a branching
  // constellation skill tree adrift in deep space. Three star-paths climb from the
  // Fallen Star; each sign must wake in order along its path. Icons are the game's
  // own spell pixel sprites — the stars remember the hero's old magic. =====
  static ZODIAC_BRANCHES = [
    { name: 'PATH OF FLAME', signs: ['aries', 'leo', 'sagittarius', 'scorpio'] },
    { name: 'PATH OF TIDES', signs: ['taurus', 'cancer', 'pisces', 'virgo'] },
    { name: 'PATH OF GALES', signs: ['gemini', 'libra', 'aquarius', 'capricorn'] },
  ];
  static ZODIAC_ICON = {
    aries: 'spell_fireball', leo: 'spell_nova', sagittarius: 'spell_lightning', scorpio: 'spell_spike',
    taurus: 'spell_quake', cancer: 'spell_shield', pisces: 'spell_heal', virgo: 'spell_orb',
    gemini: 'spell_blink', libra: 'spell_gust', aquarius: 'spell_frost', capricorn: 'spell_acid',
  };
  showZodiac(game) {
    this.hideZodiac();
    const BR = UI.ZODIAC_BRANCHES, ICON = UI.ZODIAC_ICON;
    const ov = document.createElement('div'); ov.id = 'zodiac';
    // node positions (percent of the tree area): root left-centre, branches fan right
    const pos = { root: [10, 50] };
    BR.forEach((br, bi) => {
      const y0 = [22, 50, 78][bi], drift = bi === 0 ? -2.2 : bi === 2 ? 2.2 : 0;
      br.signs.forEach((id, si) => { pos[id] = [28 + si * 20, y0 + drift * si]; });
    });
    // constellation lines (SVG under the nodes; lit segments glow gold)
    let lines = '';
    BR.forEach(br => {
      let prev = 'root';
      for (const id of br.signs) {
        const a = pos[prev], b = pos[id];
        const lit = meta.zodiacHas(id);
        lines += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${lit ? 'lit' : ''}"/>`;
        prev = id;
      }
    });
    const nodeHtml = (id) => {
      const z = ZODIAC_BY_ID[id], owned = meta.zodiacHas(id);
      const br = BR.find(b => b.signs.includes(id)), idx = br.signs.indexOf(id);
      const open = idx === 0 || meta.zodiacHas(br.signs[idx - 1]);
      const cls = owned ? 'owned' : open ? 'open' : 'locked';
      return `<button class="zd-node ${cls}" data-z="${id}" style="left:${pos[id][0]}%;top:${pos[id][1]}%">
        ${spriteImg(ICON[id], { color: owned ? '#ffcf5c' : open ? '#bcd8ff' : '#565672' }, 'zd-ico')}
        <span class="zd-nname">${z.name}</span>
        <span class="zd-nsub">${owned ? '★ ' + z.desc : open ? z.desc + ' · ' + z.cost + '💎' : 'wake the star before it'}</span>
      </button>`;
    };
    const branchTags = BR.map((br, bi) => `<span class="zd-branch" style="top:${[22, 50, 78][bi]}%">${br.name}</span>`).join('');
    ov.innerHTML = `
      <canvas class="zd-stars"></canvas>
      <div class="zd-head"><span class="zd-title">✦ THE ASTRAL REALM ✦</span>
        <span class="zd-gems">${iconImg('💎', {}, 'sm')} ${meta.gems()}</span>
        <button class="btn zd-close">✕</button></div>
      <div class="zd-tree">
        <svg class="zd-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
        ${branchTags}
        <div class="zd-node root owned" style="left:10%;top:50%">
          ${spriteImg('spell_orb', { color: '#dff4ff' }, 'zd-ico')}
          <span class="zd-nname">THE FALLEN STAR</span><span class="zd-nsub">you — a legend, forgotten</span>
        </div>
        ${Object.keys(ICON).map(nodeHtml).join('')}
      </div>
      <div class="zd-foot">each awakened star grants a permanent boon · paths wake in order, root to sky</div>`;
    document.body.appendChild(ov); this._zd = ov;
    this._paintAstralSky(ov.querySelector('.zd-stars'));
    ov.querySelector('.zd-close').onclick = () => { if (game.audio) game.audio.play('click'); this.hideZodiac(); };
    for (const btn of ov.querySelectorAll('.zd-node[data-z]')) {
      btn.onclick = () => {
        const z = ZODIAC_BY_ID[btn.dataset.z];
        if (meta.zodiacHas(z.id)) { this.toast(`${z.name} already shines for you.`); return; }
        if (btn.classList.contains('locked')) { this.toast('✦ Wake the star before it first.'); return; }
        if (!meta.unlockZodiac(z.id, z.cost)) { this.toast(`Need ${z.cost}💎 to wake ${z.name}.`); return; }
        if (game.audio) game.audio.play('win');
        this.toast(`✦ ${z.name} awakened — ${z.desc}!`);
        this.showZodiac(game); // re-render lit
      };
    }
    void ov.offsetWidth; ov.classList.add('show');
  }
  // a crunchy pixel starfield + dithered nebulae, painted once per open
  _paintAstralSky(cv) {
    if (!cv) return;
    cv.width = 480; cv.height = 300;
    const x = cv.getContext('2d');
    x.fillStyle = '#0a0a1e'; x.fillRect(0, 0, 480, 300);
    for (const [nx, ny, nr, col] of [[120, 80, 62, '#221a48'], [350, 210, 84, '#16294a'], [410, 60, 46, '#381a3e'], [40, 250, 50, '#1a3040']]) {
      for (let i = 0; i < nr * 12; i++) {
        const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * nr;
        if (Math.random() < 0.55) { x.fillStyle = col; x.fillRect((nx + Math.cos(a) * r) | 0, (ny + Math.sin(a) * r * 0.6) | 0, 2, 2); }
      }
    }
    for (let i = 0; i < 240; i++) {
      const s = Math.random();
      x.fillStyle = s > 0.92 ? '#ffffff' : s > 0.6 ? '#cdd6ff' : '#7e88b0';
      x.fillRect((Math.random() * 480) | 0, (Math.random() * 300) | 0, s > 0.96 ? 2 : 1, s > 0.96 ? 2 : 1);
    }
    for (let i = 0; i < 9; i++) { // four-point twinkles
      const px = (Math.random() * 470 + 2) | 0, py = (Math.random() * 290 + 2) | 0;
      x.fillStyle = '#ffffff'; x.fillRect(px, py, 1, 1);
      x.fillStyle = '#9fb0ff';
      x.fillRect(px - 1, py, 1, 1); x.fillRect(px + 1, py, 1, 1); x.fillRect(px, py - 1, 1, 1); x.fillRect(px, py + 1, 1, 1);
    }
  }
  hideZodiac() { if (this._zd) { this._zd.remove(); this._zd = null; } }

  // hub prompt: show what the wizard can interact with
  updatePrompt(station, isTouch) {
    if (station) {
      this.el.interactPrompt.classList.remove('hidden');
      this.el.interactPrompt.innerHTML = isTouch ? `Tap ${iconImg('hand', {}, 'sm')} to use <b>${station.label}</b>` : `Press <b>E</b> to use <b>${station.label}</b>`;
      this.el.btnInteract.classList.toggle('hidden', !isTouch);
      if (this.el.btnInteractLabel) this.el.btnInteractLabel.textContent = station.type === 'door' ? 'Leave' : 'Use';
    } else {
      this.el.interactPrompt.classList.add('hidden');
      this.el.btnInteract.classList.add('hidden');
    }
  }

  fadeBlack(on) { this.el.blackout.classList.toggle('show', !!on); }

  // scene wipe: cover the screen, run `mid` at the covered moment (swap the scene there),
  // then reveal. Only two, clean transitions: 'fade' (to black) and 'iris' (black circle zoom).
  wipe(kind = 'fade', mid, done, ms = 420) {
    const el = this.el.wipe;
    if (kind !== 'iris' && kind !== 'fade') kind = 'fade';
    if (!el) { if (mid) mid(); if (done) done(); return; }
    if (this._wipeT) { clearTimeout(this._wipeT); this._wipeT = null; }
    el.className = ''; void el.offsetWidth; // restart animations
    el.classList.add('show', 'w-' + kind, 'covering');
    this._wipeT = setTimeout(() => {
      if (mid) { try { mid(); } catch (e) {} }
      el.classList.remove('covering'); el.classList.add('revealing');
      this._wipeT = setTimeout(() => { el.className = ''; if (done) { try { done(); } catch (e) {} } }, ms + 120);
    }, ms);
  }

  // a quick white slam-flash (cutscene starts, big reveals)
  flash() { const el = this.el.wipe; if (!el) return; el.className = ''; void el.offsetWidth; el.classList.add('show', 'flash'); setTimeout(() => { el.className = ''; }, 380); }

  // death: a clean fade to black, then `done` fires (kept simple — no spin)
  deathTumble(done) { this.wipe('fade', () => { if (done) { try { done(); } catch (e) {} } }); }

  // ⭐ candy-crush star pop when a level is rated: three stars stamp in one-by-one,
  // the earned ones gold & bouncing, with a "new best!" ribbon when it beats your record.
  starAward(stars = 1, gained = 0) {
    // NB: append to <body>, not #toast-area — that host has a transform, which would make
    // this position:fixed popup resolve against it and collapse to zero size.
    const host = document.body;
    const wrap = document.createElement('div');
    wrap.className = 'star-award';
    let row = '';
    for (let i = 0; i < 3; i++) row += `<span class="sa-star ${i < stars ? 'on' : 'off'}" style="animation-delay:${i * 0.13}s">${iconImg('star', {}, 'lg')}</span>`;
    wrap.innerHTML = `<div class="sa-row">${row}</div>${gained ? '<div class="sa-cap">★ New best!</div>' : ''}`;
    host.appendChild(wrap);
    try { this.audio && this.audio.play && this.audio.play('xp'); } catch (e) {}
    if (stars >= 2) setTimeout(() => this.burstFX(wrap, 'gem', 6 + stars * 2), 240);
    setTimeout(() => wrap.remove(), 1850);
  }

  // opening rampage objective (reuses the tavern HUD banner)
  showRampage(done, total) {
    if (!this.el.tavernHud) return;
    this.el.tavernHud.classList.remove('hidden');
    const obj = this.el.tavernHud.querySelector('.tavern-obj'); if (obj) obj.innerHTML = `${iconImg('beer', {}, 'sm')} SMASH THE TAVERN — wreck it all!`;
    if (this.el.ruckusCount) this.el.ruckusCount.textContent = `${done} / ${total}`;
  }

  bumpTavern(n) {
    this.el.ruckusCount.textContent = n;
    this.el.tavernHud.classList.remove('flash');
    void this.el.tavernHud.offsetWidth;
    this.el.tavernHud.classList.add('flash');
  }

  setMuteIcon(muted) { this.el.btnMute.innerHTML = iconImg(muted ? 'mute' : 'sound'); }

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

  // true while a fullscreen cooking/zodiac overlay owns the keyboard — world input must ignore E
  overlayActive() { return !!(this._mb || this._ct || this._zd || this._coAbort || document.getElementById('cookoff')); }

  closeModals() {
    this.el.story.classList.add('hidden');
    this.el.levelup.classList.add('hidden');
    this.el.howto.classList.add('hidden');
    this.el.glyphGuide.classList.add('hidden');
    this.hidePathChoice();
    this.hideMenuBook();
    this.hideZodiac();
    this.hideCookTiming();
    if (this._coAbort) this._coAbort(); // tear down a live cook-off silently (no reopen)
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
    if (this.el.gems) this.el.gems.textContent = `${meta.gems()}`;   // live currency
    if (this.el.clock) this.el.clock.textContent = `Day ${meta.currentDay()}`;
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
    const d = game.director, es = game._escort;
    if (es && es.active) {
      // escort readout: how far along the trail the snail has crawled + its mood
      this.el.waveWrap.classList.remove('hidden');
      this.el.wave.textContent = es.state === 'ambush' ? '⚔ AMBUSH!'
        : es.state === 'blocked' ? '🚧 Road blocked'
        : es.state === 'waiting' ? '🐌 …waiting for you'
        : `🐌 Trail ${Math.round(es.u * 100)}%`;
      if (this.el.wavePips && this._pipTotal !== 0) { this._pipTotal = 0; this.el.wavePips.innerHTML = ''; }
    } else if (d && d.active) {
      this.el.waveWrap.classList.remove('hidden');
      this.el.wave.textContent = d.state === 'boss' ? 'BOSS' : `Wave ${d.wave}/${d.total}`;
      this._renderPips(d);
    } else this.el.waveWrap.classList.add('hidden');
    this.el.kills.textContent = `${game.kills}`;
    // boss health bar
    const be = game._bossEnemy;
    if (this.el.bossBar) {
      if (game.bossActive && be && be.alive) {
        this.el.bossBar.classList.remove('hidden');
        this.el.bossBarName.textContent = `${game.stage ? game.stage.bossName : 'Boss'}`;
        this.el.bossBarFill.style.width = `${Math.max(0, be.hp / be.maxHp) * 100}%`;
      } else this.el.bossBar.classList.add('hidden');
    }
    const wob = s.wobble;
    const label = wob <= 0.6 ? 'Tipsy' : (wob <= 1.15 ? 'Sloshed' : 'Hammered');
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

  // Notifications are quiet now: routine info is spoken by the WISP (its bubble
  // pops out and tells you). Only warnings — or messages explicitly forced —
  // surface as a chip. Pass { warn:true } for a red alert, { force:true } to
  // guarantee a chip regardless.
  toast(text, opts = {}) {
    if (!opts.warn && !opts.force && this.el.wispBubble) { this.wispSay(text, { ms: opts.ms || 2400 }); return; }
    const t = document.createElement('div');
    t.className = 'toast' + (opts.warn ? ' warn' : '');
    t.innerHTML = pixify(text, 'sm');
    this.el.toastArea.appendChild(t);
    setTimeout(() => t.remove(), opts.warn ? 2400 : 1700);
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

  // RPG unlock graph: earn a fresh level-up boon from spells / combos / bounties / wins
  _earnUpgrade(g, why) {
    const u = meta.unlockRandomUpgrade(); if (!u) return;
    if (g && g._unlockedUpg) g._unlockedUpg.add(u.id);
    this.wispSay(`✨ ${why} unlocked a new boon: ${u.icon} ${u.name}!`, { tone: 'tip', ms: 3200 });
  }

  // ===== Wandering Merchant: mid-run, buy boons with gems (applied now + unlocked forever) =====
  _merchPrice(u) { return ({ common: 4, rare: 6, epic: 9, legendary: 14 })[upgradeRarity(u).key] || 6; }
  showMerchant(game, onDone) {
    this._merchDone = onDone; this._merchSold = {};
    const pool = UPGRADES.filter(u => !u.available || u.available(game)).slice();
    const offers = [];
    while (offers.length < 10 && pool.length) offers.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this._merchOffers = offers;
    this._renderMerch();
    this.el.merchant.classList.remove('hidden');
    this.el.merchLeave.onclick = () => { game.audio.play('click'); this.closeMerchant(); };
    this.el.merchCards.onclick = (e) => { const b = e.target.closest('[data-buy]'); if (b) this._merchBuy(game, b.dataset.buy); };
  }
  merchantOpen() { return !!(this.el.merchant && !this.el.merchant.classList.contains('hidden')); }
  closeMerchant() {
    if (!this.merchantOpen()) return false;
    this.el.merchant.classList.add('hidden');
    const cb = this._merchDone; this._merchDone = null; if (cb) cb();   // hands control back to _showPath
    return true;
  }
  _renderMerch() {
    this.el.merchGems.textContent = `${meta.gems()}`;
    let h = '';
    for (const u of this._merchOffers) {
      const r = upgradeRarity(u), price = this._merchPrice(u), sold = this._merchSold[u.id];
      const can = !sold && meta.gems() >= price;
      h += `<div class="shop-card rar-${r.key}" style="--rc:${r.color}">
        <div class="card-rarity" style="color:${r.color}">${r.name}</div>
        <div class="shop-glyph">${iconImg(u.icon, {}, 'md')}</div>
        <div class="shop-name">${u.name}</div>
        <div class="shop-desc">${pixify(u.desc, 'sm')}</div>
        <div class="shop-acts"><button class="shop-btn gem" data-buy="${u.id}" ${can ? '' : 'disabled'}>${sold ? '✓ Bought' : `Buy ${iconImg('💎', {}, 'sm')}` + price}</button></div></div>`;
    }
    this.el.merchCards.innerHTML = h;
  }
  _merchBuy(game, id) {
    const u = this._merchOffers.find(x => x.id === id); if (!u || this._merchSold[id]) return;
    const price = this._merchPrice(u);
    if (!meta.spendGems(price)) { this.wispSay('Not enough 💎 gems for that one.', { tone: 'warn' }); return; }
    this._merchSold[id] = 1;
    meta.unlockUpgrade(u.id); if (game._unlockedUpg) game._unlockedUpg.add(u.id);
    game.applyAbility(u);                  // applied to the current run immediately
    game.audio.play('levelup'); this.burstFX(this.el.merchCards, 'gem', 10);
    this.toast(`Bought ${u.icon} ${u.name}!`);
    this._renderMerch();
  }

  // the wisp speaks — a cozy, non-blocking bubble for warnings & tips (replaces blunt toasts).
  // tone:'warn' tints the edge red; big:true makes the wisp "zoom in" with a bigger pop for key tips.
  wispSay(text, opts = {}) {
    const { ms = 2600, tone = 'tip', big = false } = opts;
    const b = this.el.wispBubble; if (!b) { this.toast(text, { force: true }); return; }
    this.el.wispText.innerHTML = pixify(text, 'sm');
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
    const accepted = meta.acceptedQuests ? meta.acceptedQuests() : []; // only quests you've taken on
    const realms = STAGE_ORDER.filter(id => meta.stageCleared(id)).length, realmsTotal = STAGE_ORDER.length;
    const featSig = (meta.FEATURE_ORDER || []).map(f => meta.featureUnlocked(f) ? 1 : 0).join('');
    const sig = `${debt}|${done ? 1 : 0}|${q ? q.id : '-'}|${meta.gold()}|${featSig}|${realms}|${accepted.map(a => a.id + (meta.customerQuestReady(a) ? 'R' : '')).join(',')}`;
    if (sig === this._qtSig) return; this._qtSig = sig;
    // the game's TWO clear goals, in order: pay the debt, then conquer every realm
    this.el.qtGoalText.textContent = debt > 0 ? 'Pay off the Tavern Debt'
      : realms >= realmsTotal ? '★ All realms conquered!' : `Conquer the 8 Realms — ${realms}/${realmsTotal}`;
    this.el.qtFill.style.width = (debt > 0 ? 100 * Math.max(0, total - debt) / total : 100 * realms / realmsTotal) + '%';
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
    else if (realms >= realmsTotal) step = 'You beat the game! Keep hunting stars & loot';
    else step = `Venture: beat ${STAGES[STAGE_ORDER.find(id => !meta.stageCleared(id))]?.name || 'the next realm'}`;
    this.el.qtStep.innerHTML = '➤ ' + pixify(step, 'sm');
    let bounty = q ? pixify(`Bounty: ${q.text} (+${q.reward}🪙)${done ? ' ✓' : ''}`, 'sm') : '';
    for (const a of accepted.slice(0, 3)) { const ready = meta.customerQuestReady(a); bounty += `<div class="qt-quest ${ready ? 'ready' : ''}">${ready ? '✓' : '➤'} ${pixify(a.ask, 'sm')}${ready ? ' <b>(ready!)</b>' : ''}</div>`; }
    this.el.qtBounty.innerHTML = bounty;
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
      c.innerHTML = `<div class="arch-ico">${iconImg(a.icon, {}, 'lg')}</div><div class="arch-name">${a.name}</div><div class="arch-desc">${a.desc}</div>`;
      c.addEventListener('click', () => { sel = a.id; for (const k in cards) cards[k].classList.toggle('sel', k === a.id); });
      row.appendChild(c); cards[a.id] = c;
    }
    this.el.archGo.onclick = () => { this.el.archetypePick.classList.add('hidden'); cb(sel); };
    this.el.archetypePick.classList.remove('hidden');
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
    this._typeInto(this.el.storyText);           // Stardew-style letter-by-letter reveal
  }
  _storyAdvance() {
    this._storyIdx++;
    if (this._storyIdx >= this._storyLines.length) {
      this.el.story.classList.add('hidden');
      const cb = this._storyCb; this._storyCb = null;
      if (cb) cb();
    } else {
      this.el.storyText.textContent = this._storyLines[this._storyIdx];
      this._typeInto(this.el.storyText);
    }
  }

  // ---- Level up ----
  showLevelUp(choices, onPick) {
    this.el.cards.innerHTML = '';
    choices.forEach((u) => {
      const rc = upgradeRarity(u);
      const card = document.createElement('div');
      card.className = 'card rar-' + rc.key + (u.unique ? ' card-unique' : '');
      card.style.setProperty('--rc', rc.color);
      card.innerHTML = `
        ${u.unique ? '<div class="card-ribbon">✦ UNIQUE ✦</div>' : `<div class="card-rarity" style="color:${rc.color}">${rc.name}</div>`}
        <div class="card-icon">${iconImg(u.icon, {}, 'xl')}</div>
        <div class="card-name">${u.name}</div>
        <div class="card-desc">${pixify(u.desc, 'sm')}</div>
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
    // final result only: outcome + a one-line summary + gems won (+ artifact if any)
    this.el.endTitle.textContent = win ? `${info.stage} — Cleared!` : 'Passed Out';
    const realms = STAGE_ORDER.filter(id => meta.stageCleared(id)).length;
    this.el.endStats.innerHTML = `
      <div class="end-summary">${iconImg('map', {}, 'sm')} Stage ${info.stages || info.rooms}/${info.stagesTotal || 10} · ${iconImg('skull', {}, 'sm')} ${info.kills} · Lv ${info.level}</div>
      ${win ? `<div class="end-artifact" style="color:var(--gold)">${iconImg('crown', {}, 'sm')} Realm ${realms}/${STAGE_ORDER.length} conquered</div>` : ''}
      ${info.artifact ? `<div class="end-artifact">✦ Artifact: <b>${info.artifact}</b></div>` : ''}
      <div class="loot-box"><div class="loot-row loot-total"><span>Gems won</span><b>+${info.earnedGems} ${iconImg('💎', {}, 'sm')}</b></div></div>
      ${(() => { const up = meta.nextGoals ? meta.nextGoals() : []; return up.length ? `<div class="end-next">▸ ${pixify(up[0].text, 'sm')}</div>` : ''; })()}`;
    this.el.btnAgain.textContent = '▸ Restaurant';
    this.el.end.classList.remove('hidden');
  }

  comboToast(name) { this.castWord(name, { color: '#ffd36b', big: true }); } // combos announce in arcane script too
  lootToast(gear) {
    const rc = meta.RARITIES[gear.rarity];
    const t = document.createElement('div');
    t.className = 'toast loot'; t.style.color = rc.color; t.style.borderColor = rc.color;
    t.innerHTML = `${gearImg(gear, 'sm')}<span>${rc.name} ${gear.name}!</span>`;
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
        ? `<div class="slot-name">Slot ${i + 1}</div><div class="slot-info">${iconImg('coin', {}, 'sm')} ${s.gold} · ${s.spells} spells${s.tavern ? ` · ${iconImg('beer', {}, 'sm')} owner` : ''}</div>
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
  // (the cooking/kitchen minigame was removed — bar-work is the in-world walk-up serving loop)

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

  // ---- per-stage gimmick banner (every stage announces what it is) ----
  showStageBanner(n, total, gim) {
    const el = this.el.stageBanner; if (!el) return;
    el.innerHTML = `<div class="sb-count">Stage ${n} <span>/ ${total}</span></div>
      <div class="sb-name"><span class="sb-ico">${iconImg(gim.icon, {}, 'md')}</span>${gim.name}</div>
      <div class="sb-desc">${gim.desc}</div>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  // a translucent colour wash over the scene so each stage LOOKS different
  setStageTint(color) {
    const el = this.el.stageTint; if (!el) return;
    if (!color) { el.style.background = 'transparent'; el.classList.add('hidden'); return; }
    el.style.background = `radial-gradient(ellipse at 50% 36%, transparent 30%, ${color} 100%)`;
    el.classList.remove('hidden');
  }
  // ---- stage-mission HUD (small pinned objective; flashes its result) ----
  showMission(label) {
    const el = this.el.missionHud; if (!el) return;
    el.className = ''; el.innerHTML = pixifyHtml(label, 'sm'); el.classList.remove('hidden');
  }
  hideMission() { const el = this.el.missionHud; if (el) el.classList.add('hidden'); }
  missionResult(won, reward) {
    const el = this.el.missionHud; if (!el) return;
    el.className = won ? 'won' : 'failed';
    el.innerHTML = won ? `${iconImg('check', {}, 'sm')} Mission complete · +${reward} ${iconImg('💎', {}, 'sm')}` : '✕ Mission failed';
    void el.offsetWidth;
    setTimeout(() => { if (el.classList.contains('won') || el.classList.contains('failed')) el.classList.add('hidden'); }, 2200);
  }

  // ---- Shop panels (skill tree / cauldron / room / manager) ----
  openShop(kind, game) {
    this._shopKind = kind;
    this._shopGame = game;
    if (kind === 'blacksmith') { this._tgcPhase = 'shop'; this._tgcOptions = null; } // always open TGC.com at the storefront
    this.setGold(meta.gold());
    this._renderShop();
    this.el.shop.classList.toggle('build-mode', kind === 'build');
    // per-station enchantment theme: each workbench gets its own accent + arcane backdrop
    if (this._shopKindClass) this.el.shop.classList.remove(this._shopKindClass);
    this._shopKindClass = 'shop-' + kind;
    this.el.shop.classList.add('magic-shop', this._shopKindClass);
    this.el.shop.classList.remove('hidden');
    // build mode: no floating preview widget — the in-room hologram IS the preview (room stays the focus)
    if (kind === 'build') { this._buildPending = null; if (this._buildRot === undefined) this._buildRot = 0; if (this.el.buildPlace) this.el.buildPlace.classList.remove('hidden'); }
  }
  closeShop() {
    this.el.shop.classList.add('hidden'); this.el.shop.classList.remove('build-mode', 'magic-shop');
    if (this._shopKindClass) { this.el.shop.classList.remove(this._shopKindClass); this._shopKindClass = null; }
    if (this.el.buildPreview) this.el.buildPreview.classList.add('hidden');
    if (this.el.buildPlace) this.el.buildPlace.classList.add('hidden');
    this._buildPending = null;
    if (this.game && this.game.tavern) { this.game.tavern.hideGhost(); if (this.game.tavern._disposeGhost) this.game.tavern._disposeGhost(); }
    this._stopPreview();
  }

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
    this._pvMesh.traverse(o => {
      if (o.userData.isOutline) return;
      if (o.isMesh) { if (o.geometry) o.geometry.dispose(); const m = o.material; if (Array.isArray(m)) m.forEach(x => x && !x.userData.outline && x.dispose()); else if (m && !m.userData.outline) { if (m.map && !m.map.userData?.keep) m.map.dispose(); m.dispose(); } }
      if (o.isLight && o.dispose) o.dispose();
    });
    this._pvMesh = null;
  }
  _setPreviewItem(id) {
    return; // preview widget retired — the in-room hologram is the preview now
    this._ensurePreview(); if (!this._pvScene) return; // eslint-disable-line no-unreachable
    this._disposePvMesh();
    if (!id || !this.game || !this.game.tavern) { if (this.el.bpLabel) this.el.bpLabel.textContent = 'Pick a piece to preview'; return; }
    const built = this.game.tavern._buildPlaced(id); if (!built) return;
    // render it as a glowing "magic hologram" of the piece before it's built (CoC style)
    built.traverse(o => {
      if (!o.isMesh || o.userData.isOutline) return;
      o.material = new THREE.MeshBasicMaterial({ color: 0x6ad0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: false });
    });
    const pivot = new THREE.Group(); pivot.add(built);
    const box = new THREE.Box3().setFromObject(built);
    const ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    built.position.set(-ctr.x, -ctr.y, -ctr.z);          // recentre the model inside its pivot
    const maxd = Math.max(sz.x, sz.y, sz.z) || 1; pivot.scale.setScalar(1.7 / maxd);
    this._pvScene.add(pivot); this._pvMesh = pivot;
    const b = meta.buildableById(id);
    if (this.el.bpLabel) this.el.bpLabel.innerHTML = b ? `${iconImg(b.icon, {}, 'sm')} ${b.name} · ${iconImg('clock', {}, 'sm')} ${meta.buildTimeOf(b)}s · ${b.cost} ${iconImg('coin', {}, 'sm')}` : '';
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
    this._pvT = (this._pvT || 0) + 0.016;
    if (this._pvMesh) {
      // ease the model toward the chosen placement facing so ⟳ Rotate visibly turns it 90°
      const target = this._buildRot || 0;
      let d = target - (this._pvAngle || 0);
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this._pvAngle = (this._pvAngle || 0) + d * 0.2;
      this._pvMesh.rotation.y = this._pvAngle + Math.sin(this._pvT * 1.2) * 0.12; // gentle alive sway
      this._pvMesh.position.y = Math.sin(this._pvT * 1.7) * 0.05;
    }
    this._pvRenderer.render(this._pvScene, this._pvCamera);
  }

  _shopAction(act, id, slot) {
    const g = this._shopGame;
    if (act === 'startrun') { g.startRun(id); return; }
    if (act === 'buildtab') { this._buildTab = id; this._buildSel = null; this._buildPending = null; if (g) { g.audio.play('click'); if (g.tavern) g.tavern.hideGhost(); } this._renderShop(); return; }
    if (act === 'chartab') { this._charTab = id; if (g) g.audio.play('click'); this._renderShop(); return; }
    if (act === 'selbuild') { this._buildSel = (this._buildSel === id ? null : id); this._buildPending = null; this._pvAngle = this._buildRot || 0; this._setPreviewItem(this._buildSel); if (g) { g.audio.play('click'); if (g.tavern) g.tavern.hideGhost(); } this._renderShop(); return; }
    if (act === 'confirmbuild') { if (g && g.confirmBuild) g.confirmBuild(); return; }
    if (act === 'cancelbuild') { if (g && g.cancelBuildPlacement) g.cancelBuildPlacement(); return; }
    if (act === 'rotbuild') { if (g && g.rotateBuild) g.rotateBuild(); return; }
    if (act === 'place') {
      const [gx, gy] = id.split('_').map(Number);
      let ok, placedStation = null, builtB = null;
      if (meta.cellOccupied(gx, gy)) ok = meta.removeAt(gx, gy);
      else if (this._buildSel) { const sb = meta.buildableById(this._buildSel); ok = meta.placeItem(this._buildSel, gx, gy, this._buildRot || 0); if (ok) { builtB = sb; placedStation = sb && sb.station ? sb : null; if (placedStation) { this._buildSel = null; this._setPreviewItem(null); } } }
      else ok = false;
      if (g) { g.audio.play(ok ? 'click' : 'hiccup'); if (ok && g.tavern.refreshRoom) g.tavern.refreshRoom(meta); }
      // a magic hologram raises the new piece out of the ground over its build time (CoC style)
      if (builtB && g && g.tavern.beginConstruct) g.tavern.beginConstruct(gx, gy, meta.buildTimeOf(builtB));
      if (ok) this.burstFX({ x: window.innerWidth / 2, y: window.innerHeight * 0.34 }, 'sparkle', 10);
      if (placedStation) this.wispSay(`✓ Building the ${placedStation.name}… walk up and press E once it's raised!`);
      this.setGold(meta.gold());
      this._renderShop();
      return;
    }
    // ---- TGC.com pack flow: buy -> opening animation -> choose one revealed piece ----
    if (act === 'buypack') {
      const opts = meta.buyPack(id);
      if (!opts) { if (g) g.audio.play('hiccup'); return; }
      if (g) g.audio.play('levelup');
      this._tgcOptions = opts; this._tgcPhase = 'opening';
      this.setGold(meta.gold()); this._renderShop();
      clearTimeout(this._tgcT);
      this._tgcT = setTimeout(() => { this._tgcPhase = 'reveal'; if (this._shopKind === 'blacksmith') this._renderShop(); if (g) { g.audio.play('win'); this.burstFX({ x: window.innerWidth / 2, y: window.innerHeight * 0.4 }, 'gem', 16); } }, 1500);
      return;
    }
    if (act === 'keepgear') {
      const inst = this._tgcOptions && this._tgcOptions[+id];
      if (inst) { meta.keepGear(inst); this.lootToast(inst); if (g) g.audio.play('levelup'); }
      this._tgcOptions = null; this._tgcPhase = 'shop'; this._renderShop();
      return;
    }
    let ok = false;
    if (act === 'unlock') { ok = meta.unlockSpell(id); if (ok) this._earnUpgrade(g, 'mastering new magic'); }
    else if (act === 'upgrade') ok = meta.upgradeSpell(id);
    else if (act === 'equip') ok = meta.toggleEquip(id);
    else if (act === 'learn') { ok = meta.learnCombo(id); if (ok) this._earnUpgrade(g, 'brewing a new combo'); }
    else if (act === 'brew') { ok = meta.brewPotion(id); if (ok) g.ui.wispSay('🧪 Potion brewed! Its boon is yours for good.'); }
    else if (act === 'research') { ok = meta.startResearch(id); if (ok) { const r = meta.researchById(id); g.ui.wispSay(`🔬 Research begun: ${r.name}. Work shifts & venture to pass the ${r.days} days.`, { big: true, ms: 4200 }); } }
    else if (act === 'buyroom') ok = meta.buyRoom();
    else if (act === 'buydecor') ok = meta.buyDecor(id);
    else if (act === 'rest') ok = meta.rest();
    else if (act === 'collect') { const r = meta.collectTavern(); ok = r > 0; if (ok) g.ui.toast(`Collected ${r}🪙`); }
    else if (act === 'tavup') ok = meta.buyTavernUpgrade(id);
    else if (act === 'equipgear') { ok = meta.equipGear(id); if (ok && g && g.wizard) g.wizard.setEquipment(meta.equippedGearFull()); }
    else if (act === 'salvage') { const v = meta.salvageGear(id); ok = v > 0; if (ok) g.ui.toast(`Salvaged for ${v}🪙`); }
    else if (act === 'upgradegear') ok = meta.upgradeGear(id);
    else if (act === 'forge') { const inst = meta.forgeGear(id); ok = !!inst; if (ok) { g.ui.lootToast(inst); g.audio.play('levelup'); } }
    else if (act === 'artieq') { ok = meta.toggleArtifactEquip(id); if (!ok) g.ui.wispSay(`✦ You can only carry ${meta.MAX_ARTIFACTS} artifacts into a run.`, { tone: 'warn' }); }
    else if (act === 'adoptpet') { ok = meta.adoptPet(id); if (ok) { const p = meta.petById(id); g.ui.wispSay(`🐾 Adopted the ${p.name}! Carry it into a run for its boon.`); this.setGems(meta.gems()); } }
    else if (act === 'equippet') { ok = meta.equipPet(id); if (ok && g && g._spawnPetCompanion) g._spawnPetCompanion(); }
    else if (act === 'paydebt') { const p = meta.payDebt(meta.gold()); ok = p > 0; if (ok) { g.ui.toast(`💰 Paid ${p}🪙 off the debt`); if (meta.debt() <= 0) g.onDebtCleared(); } }
    else if (act === 'claim') { const res = meta.claimQuest(); ok = !!(res && res.reward > 0); if (ok) { g.ui.toast(`Quest reward: +${res.reward}🪙`); if (res.unlocked) g.ui.wispSay(`🔓 Unlocked the ${meta.FEATURE_LABELS[res.unlocked]}. Build it up in your room!`, { big: true, ms: 4200 }); this._earnUpgrade(g, 'finishing a bounty'); } }
    if (g) g.audio.play(ok ? 'click' : 'hiccup');
    this.setGold(meta.gold());
    this._renderShop();
  }

  _renderShop() {
    const kind = this._shopKind;
    const titles = { skilltree: `✦ Spell Table`, character: `${iconImg('wizard', {}, 'sm')} Character`, cauldron: `${iconImg('cauldron', {}, 'sm')} Cauldron`, build: `${iconImg('hammer', {}, 'sm')} Build Your Den`, manager: `${iconImg('scroll', {}, 'sm')} Quest Board`, ledger: `${iconImg('ledger', {}, 'sm')} Tavern Ledger`, blacksmith: `${iconImg('cardpack', {}, 'sm')} TGC.com`, library: `${iconImg('book', {}, 'sm')} Arcane Library` };
    this.el.shopTitle.innerHTML = titles[kind] || 'Tavern';
    let html = '';
    if (kind === 'skilltree') html = this._renderSkillTree();
    else if (kind === 'character') html = this._renderCharacter();
    else if (kind === 'cauldron') html = this._renderCauldron();
    else if (kind === 'build') html = this._renderBuild();
    else if (kind === 'manager') html = this._renderManager();
    else if (kind === 'ledger') html = this._renderLedger();
    else if (kind === 'blacksmith') html = this._renderBlacksmith();
    else if (kind === 'library') html = this._renderLibrary();
    this.el.shopBody.innerHTML = html;
  }

  // ===== Arcane Library: spend 💎 on research; a project finishes as DAYS pass =====
  _renderLibrary() {
    const active = meta.researchActive();
    let h = `<p class="shop-sub">Fund research with ${iconImg('💎', {}, 'sm')} gems. Once done, it boosts <b>every run</b>.</p>`;
    if (active) {
      const r = active, left = meta.researchDaysLeft();
      h += `<div class="quest-box main-quest"><div class="quest-title">${iconImg('alembic', {}, 'sm')} Researching: ${iconImg(r.icon, {}, 'sm')} ${r.name}</div>
        <div class="quest-text">${r.desc}</div>
        <div class="quest-reward">${iconImg('hourglass', {}, 'sm')} Ready in <b>${left} day${left === 1 ? '' : 's'}</b> — work a shift or venture out to pass the time.</div></div>`;
    }
    h += '<div class="shop-grid">';
    for (const r of meta.RESEARCH) {
      const done = meta.researchDone(r.id), isActive = active && active.id === r.id;
      let action;
      if (done) action = '<button class="shop-btn on" disabled>✓ Complete</button>';
      else if (isActive) action = `<button class="shop-btn" disabled>${iconImg('hourglass', {}, 'sm')} In progress</button>`;
      else if (active) action = '<button class="shop-btn" disabled>One at a time</button>';
      else action = `<button class="shop-btn gem" data-act="research" data-id="${r.id}" ${meta.canAffordGems(r.gems) ? '' : 'disabled'}>${iconImg('💎', {}, 'sm')}${r.gems} · ${r.days} days</button>`;
      h += `<div class="shop-card ${done ? '' : isActive ? '' : active ? 'locked' : ''}">
        <div class="shop-glyph">${iconImg(r.icon, {}, 'md')}</div>
        <div class="shop-name">${r.name}</div>
        <div class="shop-desc">${r.desc}</div>
        <div class="shop-acts">${action}</div></div>`;
    }
    h += '</div>';
    return h;
  }

  _renderLedger() {
    if (!meta.tavernOwned()) return '<p class="shop-sub">You just <b>work</b> here. Clear a stage to own the Toad.</p>';
    const bank = meta.tavernBank(), cap = meta.tavernCap(), rate = meta.tavernRate();
    let h = `<p class="shop-sub">Your tavern earns <b>${rate}${iconImg('coin', {}, 'sm')}/min</b> even while you\'re away (banked up to <b>${cap}${iconImg('coin', {}, 'sm')}</b>).</p>
      <div class="loot-box" style="max-width:340px;margin:0 auto 14px">
        <div class="loot-row"><span>Banked coin</span><b>${bank} / ${cap} ${iconImg('coin', {}, 'sm')}</b></div>
        <div class="shop-acts"><button class="shop-btn big" data-act="collect" ${bank > 0 ? '' : 'disabled'}>Collect ${bank} ${iconImg('coin', {}, 'sm')}</button></div>
      </div>
      <div class="shop-grid">`;
    for (const u of meta.TAVERN_UPGRADES) {
      const lvl = meta.tavernUpgradeLevel(u.id), cost = meta.tavernUpgradeCost(u.id);
      h += `<div class="shop-card"><div class="shop-name">${u.name} <span class="lvtag">Lv${lvl}</span></div><div class="shop-desc">${u.desc}</div><div class="shop-acts"><button class="shop-btn" data-act="tavup" data-id="${u.id}" ${meta.canAfford(cost) ? '' : 'disabled'}>Buy ${cost} ${iconImg('coin', {}, 'sm')}</button></div></div>`;
    }
    h += '</div>';
    return h;
  }

  _gearStats(g) { return Object.entries(g.mods).map(([k, v]) => meta.statLabel(k, v)).join(' · '); }
  _slotMeta(slot) { const known = ({ hat: 'Hat', robe: 'Robe', staff: 'Staff', charm: 'Charm' })[slot]; return { kind: known ? slot : 'bag', name: known || slot }; }
  _gearCard(g, acts, on) {
    const rc = meta.RARITIES[g.rarity];
    return `<div class="shop-card gear rar-${g.rarity} ${on ? 'worn' : ''}" style="--rc:${rc.color}">
      <div class="gear-top"><span class="gear-name" style="color:${rc.color}">${g.name}</span><span class="gear-lv">Lv${g.level}</span></div>
      <div class="gear-sprite">${gearImg(g)}</div>
      <div class="gear-rar" style="color:${rc.color}">★ ${rc.name} ${this._slotMeta(g.slot).name}</div>
      <div class="shop-desc gear-stats">${this._gearStats(g)}</div>
      <div class="shop-acts">${acts}</div></div>`;
  }
  // ===== Character Hall: one place to manage Gear, your Spell loadout, and your Satchel =====
  _renderCharacter() {
    const tab = this._charTab || (this._charTab = 'gear');
    let h = `<div class="vil-tabs">
      <button class="vil-tab ${tab === 'gear' ? 'on' : ''}" data-act="chartab" data-id="gear">${iconImg('robe', {}, 'sm')} Gear</button>
      <button class="vil-tab ${tab === 'spells' ? 'on' : ''}" data-act="chartab" data-id="spells">✦ Spells</button>
      <button class="vil-tab ${tab === 'pets' ? 'on' : ''}" data-act="chartab" data-id="pets">${iconImg('cat', {}, 'sm')} Pets</button>
      <button class="vil-tab ${tab === 'satchel' ? 'on' : ''}" data-act="chartab" data-id="satchel">${iconImg('bag', {}, 'sm')} Satchel</button></div>`;
    if (tab === 'gear') h += this._renderWardrobe();
    else if (tab === 'spells') h += this._renderCharSpells();
    else if (tab === 'pets') h += this._renderPets();
    else h += this._renderInventory();
    return h;
  }
  // 🐾 Menagerie: adopt creatures with gems, then carry ONE for a passive boost
  _renderPets() {
    const eqid = meta.equippedPetId();
    let h = `<p class="shop-sub">${iconImg('cat', {}, 'sm')} Adopt with ${iconImg('💎', {}, 'sm')} gems; carry <b>one</b> into a run for a boost.</p><div class="shop-grid">`;
    for (const p of meta.PETS) {
      const owned = meta.hasPet(p.id), on = eqid === p.id;
      let action;
      if (!owned) action = `<button class="shop-btn gem" data-act="adoptpet" data-id="${p.id}" ${meta.canAffordGems(p.cost) ? '' : 'disabled'}>Adopt ${iconImg('💎', {}, 'sm')}${p.cost}</button>`;
      else action = `<button class="shop-btn ${on ? 'on' : ''}" data-act="equippet" data-id="${p.id}">${on ? '✓ Carrying' : 'Carry'}</button>`;
      h += `<div class="shop-card pet-card ${owned ? '' : 'locked'} ${on ? 'on' : ''}">
        <div class="shop-glyph">${spriteImg(PET_SPRITE[p.id], { rarity: on ? 'legendary' : 'rare' }, 'lg', '🐾')}</div>
        <div class="shop-name">${p.name}</div>
        <div class="shop-desc">${p.desc}</div>
        <div class="shop-acts">${action}</div></div>`;
    }
    h += '</div>';
    return h;
  }
  _renderCharSpells() {
    const eq = meta.getLoadout();
    let h = `<p class="shop-sub">Your loadout — carry up to <b>3</b> spells into a venture. Buy &amp; level spells at the <b>Spell Table</b>.</p><div class="shop-grid">`;
    const owned = meta.SPELL_LIST.filter(id => meta.owns(id));
    if (!owned.length) h += '<div class="eq-empty">No spells yet — unlock some at the Spell Table.</div>';
    for (const id of owned) {
      const m = meta.SPELL_META[id]; const { e } = this._elChip(m.element);
      const equipped = eq.includes(id);
      h += `<div class="shop-card spell-card" style="--el:${e.color}">
        <div class="spell-el" style="color:${e.color}">${iconImg(e.icon, {}, 'sm')} ${e.name}</div>
        <div class="shop-glyph" style="color:${e.color}">${spriteImg(SPELL_SPRITE[id], {}, 'lg', m.glyph)}</div>
        <div class="shop-name">${m.name} <span class="lvtag">Lv${meta.spellLevel(id)}</span></div>
        <div class="shop-acts"><button class="shop-btn ${equipped ? 'on' : ''}" data-act="equip" data-id="${id}">${equipped ? '✓ Equipped' : 'Equip'}</button></div></div>`;
    }
    h += '</div>';
    return h;
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
        <div class="eq-slot-frame">${g ? `${gearImg(g, 'md')}<span class="eq-lv">Lv${g.level}</span>` : `<span class="eq-slot-ph">${spriteImg(sm.kind, {}, 'md')}</span>`}</div>
        <div class="eq-slot-name">${g ? g.name : sm.name}</div>
        <div class="eq-slot-rar ${g ? '' : 'empty'}" ${rc ? `style="color:${rc.color}"` : ''}>${g ? rc.name : '— empty —'}</div></div>`;
    }
    strip += '</div>';
    let h = '<p class="shop-sub">One piece per slot. Rarer &amp; higher-level = stronger.</p>';
    h += strip;
    h += `<div class="eq-totals"><span>${iconImg('swords', {}, 'sm')} Equipped bonuses</span><b>${totalStr}</b></div>`;
    for (const slot of meta.GEAR_SLOTS) {
      const sm = this._slotMeta(slot);
      const eqId = meta.equippedGearId(slot);
      const items = meta.gearList().filter(g => g.slot === slot)
        .sort((a, b) => meta.RARITIES[b.rarity].mult * b.level - meta.RARITIES[a.rarity].mult * a.level);
      h += `<div class="eq-section"><div class="eq-section-head">${spriteImg(sm.kind, {}, 'sm')} ${sm.name}s <span class="eq-count">${items.length}</span></div><div class="shop-grid eq-grid">`;
      if (!items.length) h += `<div class="eq-empty">No ${sm.name.toLowerCase()} found yet — slay monsters &amp; bosses to loot some.</div>`;
      for (const g of items) {
        const on = eqId === g.id, cost = meta.upgradeGearCost(g), max = g.level >= 10;
        const acts = `<button class="shop-btn ${on ? 'on' : ''}" data-act="equipgear" data-id="${g.id}">${on ? '✓ Worn' : 'Wear'}</button>`
          + (max ? '<button class="shop-btn" disabled>MAX</button>' : `<button class="shop-btn" data-act="upgradegear" data-id="${g.id}" ${meta.canAfford(cost) ? '' : 'disabled'}>+Lv ${cost} ${iconImg('coin', {}, 'sm')}</button>`)
          + `<button class="shop-btn ghost" data-act="salvage" data-id="${g.id}">Scrap ${meta.gearValue(g)} ${iconImg('coin', {}, 'sm')}</button>`;
        h += this._gearCard(g, acts, on);
      }
      h += '</div></div>';
    }
    return h;
  }
  _renderBlacksmith() {
    const phase = this._tgcPhase || 'shop';
    // --- pack-opening animation (auto-advances to the reveal after ~1.5s) ---
    if (phase === 'opening') {
      return `<div class="tgc-open">
        <div class="tgc-site">TGC<span>.com</span></div>
        <div class="tgc-pack-anim">${spriteImg('cardpack', { rarity: 'legendary' }, 'lg', '🎴')}</div>
        <div class="tgc-open-lbl">Ripping the booster open…</div></div>`;
    }
    // --- reveal: choose ONE of the pulled pieces ---
    if (phase === 'reveal') {
      const opts = this._tgcOptions || [];
      let cards = '';
      opts.forEach((inst, i) => {
        const rc = meta.RARITIES[inst.rarity];
        const stats = Object.entries(inst.mods).map(([k, v]) => meta.statLabel(k, v)).join(' · ');
        cards += `<button class="tgc-card" data-act="keepgear" data-id="${i}" style="--rc:${rc.color};animation-delay:${i * 0.14}s">
          <div class="tgc-card-ico">${gearImg(inst, 'lg')}</div>
          <div class="tgc-card-rar" style="color:${rc.color}">${rc.name}</div>
          <div class="tgc-card-name">${inst.name}</div>
          <div class="tgc-card-stats">${stats}</div>
          <div class="tgc-card-keep">✓ Keep this</div></button>`;
      });
      return `<div class="tgc-reveal"><p class="shop-sub">Booster opened — <b>choose one</b> card to keep. The rest go back in the box.</p>
        <div class="tgc-card-row">${cards}</div></div>`;
    }
    // --- storefront: buy a pack ---
    let h = `<p class="shop-sub">${iconImg('cardpack', {}, 'sm')} <b>TGC.com</b> — open a gear pack, keep <b>one</b>. Pricier = rarer.</p><div class="shop-grid">`;
    for (const p of meta.PACKS) {
      const odds = meta.GEAR_RARITY_ORDER.filter(r => p.w[r]).map(r => `<span style="color:${meta.RARITIES[r].color}">${p.w[r]}%</span>`).join(' / ');
      const can = meta.canBuyPack(p.id);
      h += `<div class="shop-card forge-card tgc-pack-card">
        <div class="shop-glyph">${spriteImg('cardpack', { rarity: ['common', 'rare', 'epic'][meta.PACKS.indexOf(p)] || 'epic' }, 'lg', p.icon)}</div>
        <div class="shop-name">${p.name}</div>
        <div class="shop-desc">Open &amp; pick 1 of ${p.picks}.<br><span style="font-size:11px">${odds}</span></div>
        <div class="shop-acts"><button class="shop-btn gem" data-act="buypack" data-id="${p.id}" ${can ? '' : 'disabled'}>${iconImg('coin', {}, 'sm')}${p.gold} · ${iconImg('💎', {}, 'sm')}${p.gems}</button></div></div>`;
    }
    h += '</div>';
    const items = meta.gearList().slice().sort((a, b) => meta.RARITIES[b.rarity].mult * b.level - meta.RARITIES[a.rarity].mult * a.level);
    h += `<div class="eq-section-head" style="margin-top:14px">Your collection — level up or scrap <span class="eq-count">${items.length}</span></div><div class="shop-grid eq-grid">`;
    if (!items.length) h += '<div class="eq-empty">No gear yet — rip a pack above, or loot it on a venture!</div>';
    for (const g of items) {
      const cost = meta.upgradeGearCost(g), max = g.level >= 10;
      const acts = `${max ? '<button class="shop-btn" disabled>MAX</button>' : `<button class="shop-btn" data-act="upgradegear" data-id="${g.id}" ${meta.canAfford(cost) ? '' : 'disabled'}>+Lv ${cost} ${iconImg('coin', {}, 'sm')}</button>`}<button class="shop-btn ghost" data-act="salvage" data-id="${g.id}">Scrap ${meta.gearValue(g)} ${iconImg('coin', {}, 'sm')}</button>`;
      h += this._gearCard(g, acts, false);
    }
    h += '</div>';
    return h;
  }

  _elChip(elementId) {
    const e = meta.ELEMENTS[elementId] || { icon: '✦', color: 'var(--magic)', name: '' };
    return { e, chip: `<span class="spell-el" style="color:${e.color}">${iconImg(e.icon, {}, 'sm')} ${e.name}</span>` };
  }
  _renderSkillTree() {
    const eq = meta.getLoadout();
    let h = `<p class="shop-sub">Unlock &amp; level spells with <b>${iconImg('💎', {}, 'sm')} gems</b>. Equip up to <b>3</b>.</p><div class="shop-grid">`;
    for (const id of meta.SPELL_LIST) {
      const m = meta.SPELL_META[id];
      const { e } = this._elChip(m.element);
      const owned = meta.owns(id), lvl = meta.spellLevel(id), equipped = eq.includes(id);
      let action;
      if (!owned) {
        const c = meta.spellUnlockGems(id);
        action = `<button class="shop-btn gem" data-act="unlock" data-id="${id}" ${meta.canAffordGems(c) ? '' : 'disabled'}>Unlock ${iconImg('💎', {}, 'sm')}${c}</button>`;
      } else {
        const up = lvl >= meta.MAX_LEVEL ? `<button class="shop-btn" disabled>MAX</button>` :
          `<button class="shop-btn gem" data-act="upgrade" data-id="${id}" ${meta.canAffordGems(meta.spellUpgradeGems(lvl)) ? '' : 'disabled'}>Lv${lvl}→${lvl + 1} · ${iconImg('💎', {}, 'sm')}${meta.spellUpgradeGems(lvl)}</button>`;
        action = up + `<button class="shop-btn ${equipped ? 'on' : ''}" data-act="equip" data-id="${id}">${equipped ? '✓ Equipped' : 'Equip'}</button>`;
      }
      h += `<div class="shop-card spell-card ${owned ? '' : 'locked'}" style="--el:${e.color}">
        <div class="spell-el" style="color:${e.color}">${iconImg(e.icon, {}, 'sm')} ${e.name}</div>
        <div class="shop-glyph" style="color:${e.color}">${spriteImg(SPELL_SPRITE[id], {}, 'lg', m.glyph)}</div>
        <div class="shop-name">${m.name}${owned ? ` <span class="lvtag">Lv${lvl}</span>` : ''}</div>
        <div class="shop-acts">${action}</div></div>`;
    }
    h += '</div>';
    return h;
  }

  _renderInventory() {
    const eqMods = meta.equipMods();
    const statStr = Object.keys(eqMods).length ? Object.entries(eqMods).map(([k, v]) => meta.statLabel(k, v)).join(' · ') : 'No gear equipped';
    const ownedSpells = meta.SPELL_LIST.filter(id => meta.owns(id)).length;
    const tally = {}; for (const id of meta.SPELL_LIST) if (meta.owns(id)) { const el = meta.SPELL_META[id].element; tally[el] = (tally[el] || 0) + 1; }
    const elh = meta.ELEMENT_LIST.map(el => { const e = meta.ELEMENTS[el]; return `<span class="inv-el" style="color:${e.color}">${iconImg(e.icon, {}, 'sm')} ${e.name} ×${tally[el] || 0}</span>`; }).join('');
    let h = '<p class="shop-sub">Your satchel — currencies, gear and known magic at a glance.</p>';
    h += `<div class="inv-cur">
      <div class="inv-coin"><span class="inv-ico">${iconImg('coin', {}, 'md')}</span><b>${meta.gold()}</b><small>gold · earned by working</small></div>
      <div class="inv-coin"><span class="inv-ico">${iconImg('💎', {}, 'md')}</span><b>${meta.gems()}</b><small>gems · won in battle</small></div>
      <div class="inv-coin"><span class="inv-ico">${iconImg('sun', {}, 'md')}</span><b>Day ${meta.currentDay()}</b><small>the tavern clock</small></div>
    </div>`;
    h += `<div class="eq-totals"><span>${iconImg('swords', {}, 'sm')} Equipped bonuses</span><b>${statStr}</b></div>`;
    h += `<div class="inv-row"><span>Spells known</span><b>${ownedSpells} / ${meta.SPELL_LIST.length}</b></div>
      <div class="inv-row"><span>Boons unlocked</span><b>${meta.unlockedUpgradeCount()} / ${meta.earnableUpgradeTotal()}</b></div>
      <div class="inv-row"><span>Gear in stash</span><b>${meta.gearList().length}</b></div>
      <div class="inv-els">${elh}</div>`;
    // elemental gemstones — collected from battle, brewed at the Cauldron
    const gs = meta.gemstones();
    const gsh = meta.ELEMENT_LIST.map(el => { const e = meta.ELEMENTS[el]; return `<span class="inv-el" style="color:${e.color}">${iconImg(e.icon, {}, 'sm')} ${e.name} ×${gs[el] || 0}</span>`; }).join('');
    h += `<div class="eq-section-head" style="margin-top:14px">${iconImg('💎', {}, 'sm')} Elemental Gemstones <span class="eq-count">${meta.totalGemstones()} total</span></div>
      <p class="shop-sub" style="margin:.2em 0 .5em">Won in battle. Brew them into potions at the Cauldron.</p>
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
        <div class="grim-vfx"><span class="vfx-orb" style="--c:#ffcf5c"></span><span class="grim-glyph">${iconImg(a.icon, {}, 'md')}</span></div>
        <div class="shop-name" style="color:var(--gold)">${a.name}</div>
        <div class="shop-desc">${a.desc}</div>
        <div class="shop-acts"><button class="shop-btn ${on ? 'on' : ''}" data-act="artieq" data-id="${id}">${on ? '✓ Carrying' : 'Carry'}</button></div></div>`;
    }
    h += '</div>';
    return h;
  }

  _renderCauldron() {
    let h = '<p class="shop-sub">Learn <b>combos</b>: cast two equipped glyphs back-to-back.</p><div class="shop-grid">';
    for (const id of meta.COMBO_LIST) {
      const c = meta.COMBO_META[id];
      const learned = meta.learned(id);
      const haveParts = meta.owns(c.a) && meta.owns(c.b);
      const ga = SPELLS[c.a].glyph, gb = SPELLS[c.b].glyph;
      let action;
      if (learned) action = '<button class="shop-btn on" disabled>✓ Learned</button>';
      else if (!haveParts) action = '<button class="shop-btn" disabled>Need both spells</button>';
      else action = `<button class="shop-btn" data-act="learn" data-id="${id}" ${meta.canAfford(c.cost) ? '' : 'disabled'}>Learn ${c.cost} ${iconImg('coin', {}, 'sm')}</button>`;
      h += `<div class="shop-card ${learned ? '' : 'locked'}">
        <div class="shop-glyph combo-glyph">${spriteImg(COMBO_SPRITE[id], {}, 'lg', ga + '+' + gb)}<span class="combo-parts">${spriteImg(SPELL_SPRITE[c.a], {}, 'sm', ga)}<b>+</b>${spriteImg(SPELL_SPRITE[c.b], {}, 'sm', gb)}</span></div>
        <div class="shop-name">${c.name}</div>
        <div class="shop-desc">${c.desc}</div>
        <div class="shop-acts">${action}</div></div>`;
    }
    h += '</div>';
    // ---- brew lasting potions from gathered herbs + elemental gemstones ----
    h += `<div class="eq-section-head" style="margin-top:14px">${iconImg('potion', { color: '#9bff5a' }, 'sm')} Brew Potions</div>
      <p class="shop-sub" style="margin:.2em 0 .6em">Spend elemental ${iconImg('💎', {}, 'sm')} gemstones (won in battle) for a <b>permanent</b> boon.</p><div class="shop-grid">`;
    for (const p of meta.POTIONS) {
      const e = meta.ELEMENTS[p.el], can = meta.canBrew(p.id), have = meta.brewCount(p.id);
      h += `<div class="shop-card" style="--el:${e.color}">
        <div class="shop-glyph">${spriteImg('potion', { color: e.color }, 'md', p.icon)}</div>
        <div class="shop-name">${p.name}${have ? ` ×${have}` : ''}</div>
        <div class="shop-desc">${p.desc}</div>
        <div class="shop-acts"><button class="shop-btn" data-act="brew" data-id="${p.id}" ${can ? '' : 'disabled'}>${iconImg(e.icon, {}, 'sm')} ×${p.gems}</button></div></div>`;
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
    const selB = this._buildSel ? meta.buildableById(this._buildSel) : null;
    const pend = this._buildPending;
    // ---- CONFIRM step: a piece is parked on the floor, awaiting your yes/no ----
    if (pend && selB) {
      return `<div class="build-confirm">
        <div class="bc-head">${iconImg(selB.icon, {}, 'lg')}<div class="bc-info"><div class="bc-name">${selB.name}</div>
          <div class="bc-meta">${selB.cost === 0 ? 'Free' : `${selB.cost} ${iconImg('coin', {}, 'sm')}`} · ${iconImg('clock', {}, 'sm')} ${meta.buildTimeOf(selB)}s</div></div></div>
        <div class="bc-acts">
          <button class="shop-btn big on" data-act="confirmbuild">✓ Build</button>
          <button class="shop-btn" data-act="rotbuild">⟳</button>
          <button class="shop-btn" data-act="cancelbuild">✗</button>
        </div></div>`;
    }
    let h = `<p class="shop-sub">${selB ? `Tap a floor tile to place the <b>${selB.name}</b>.` : 'Pick a piece, then tap a floor tile.'}</p>`;
    h += `<div class="vil-tabs">
      <button class="vil-tab ${tab === 'station' ? 'on' : ''}" data-act="buildtab" data-id="station">${iconImg('hammer', {}, 'sm')} Stations</button>
      <button class="vil-tab ${tab === 'comfort' ? 'on' : ''}" data-act="buildtab" data-id="comfort">${iconImg('chair', {}, 'sm')} Comforts</button>
      <button class="vil-tab ${tab === 'furniture' ? 'on' : ''}" data-act="buildtab" data-id="furniture">${iconImg('furn_sofa', {}, 'sm')} Furniture</button></div>`;
    const catOf = (b) => b.station ? 'station' : (b.cat === 'furniture' ? 'furniture' : 'comfort');
    h += '<div class="build-cat">';
    for (const b of meta.BUILDABLES) {
      if (catOf(b) !== tab) continue;
      const locked = b.feature && !meta.featureUnlocked(b.feature);
      const sel = this._buildSel === b.id;
      const built = b.station && meta.stationBuilt(b.id);
      const dis = locked || built || !meta.canAfford(b.cost);
      const cost = locked ? `${iconImg('lock', {}, 'sm')} quest` : built ? '✓ Built' : b.cost === 0 ? 'Free' : `${b.cost} ${iconImg('coin', {}, 'sm')}`;
      const time = (!locked && !built && b.cost > 0) ? `<span class="bi-time">${iconImg('clock', {}, 'sm')} ${meta.buildTimeOf(b)}s</span>` : '';
      h += `<button class="build-item ${sel ? 'sel' : ''} ${b.station ? 'is-station' : ''} ${locked ? 'locked' : ''}" data-act="selbuild" data-id="${b.id}" ${dis ? 'disabled' : ''} title="${locked ? 'Unlock by claiming a bounty in your quest log' : b.name}">
        <span class="bi-icon">${locked ? iconImg('lock', {}, 'sm') : iconImg(b.icon, {}, 'sm')}</span><span class="bi-name">${b.name}</span><span class="bi-cost">${cost}</span>${time}</button>`;
    }
    h += '</div>';
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
        <div class="quest-title">${iconImg('⚜', {}, 'sm')} MAIN QUEST · The Tavern Debt</div>
        <div class="quest-text">Old Tomas left the Tipsy Toad drowning in debt — and you smashed up the rest on your way in. Pay it off to truly own the place.</div>
        <div class="debt-bar"><div class="debt-fill" style="width:${pct}%"></div><span class="debt-label">${paid} / ${total} ${iconImg('coin', {}, 'sm')} paid</span></div>
        <div class="shop-acts"><button class="shop-btn big" data-act="paydebt" ${pay > 0 ? '' : 'disabled'}>Pay ${pay} ${iconImg('coin', {}, 'sm')}</button></div>
      </div>`;
    } else {
      h += `<div class="quest-box main-quest done"><div class="quest-title">${iconImg('⚜', {}, 'sm')} MAIN QUEST · Debt Cleared!</div><div class="quest-text">Paid in full. The Tipsy Toad is yours, free and clear. ${iconImg('beer', {}, 'sm')}</div></div>`;
    }
    // ---- side bounty ----
    h += `<div class="quest-box">
      <div class="quest-title">${iconImg('scroll', {}, 'sm')} Bounty</div>
      <div class="quest-text">${pixify(q.text, 'sm')}</div>
      <div class="quest-reward">Reward: <b>${q.reward} ${iconImg('coin', {}, 'sm')}</b> · claim it to unlock a new facility</div>
      <div class="shop-acts">${done ? '<button class="shop-btn big on" data-act="claim">✓ Claim reward</button>' : '<button class="shop-btn big" disabled>Complete it in a run</button>'}</div>
    </div>`;
    // ---- unlock track ----
    h += `<div class="eq-section-head" style="margin-top:12px">${iconImg('unlock', {}, 'sm')} Facilities (claim bounties to unlock, then build them)</div><div class="unlock-row">`;
    for (const f of meta.FEATURE_ORDER) { const u = meta.featureUnlocked(f); h += `<span class="unlock-chip ${u ? 'on' : ''}">${u ? '✓' : iconImg('lock', {}, 'sm')} ${meta.FEATURE_LABELS[f]}</span>`; }
    h += '</div>';
    return h;
  }
}
