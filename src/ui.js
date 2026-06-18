// ui.js — all the DOM: HUD, story modal, level-up cards, toasts, end screen.
import { SPELL_ORDER, SPELLS } from './spells.js';

const $ = (id) => document.getElementById(id);

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
      btnPause: $('btn-pause'), btnMute: $('btn-mute'),
      joystick: $('joystick'), joyKnob: $('joy-knob'), blackout: $('blackout'),
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
