// meta.js — persistent meta-progression (saved to localStorage): gold, owned &
// leveled spells, learned combos, the 3-spell loadout, the room, and quests.
// This is the "between runs" economy that the tavern hub edits.

const KEY = 'wonkywizard.save.v1';

export const SPELL_META = {
  fireball:  { name: 'Fireball',     glyph: '△', starter: true },
  gust:      { name: 'Gust',         glyph: '—', starter: true },
  lightning: { name: 'Lightning',    glyph: 'ϟ', unlock: 60 },
  heal:      { name: 'Heal',         glyph: '∨', unlock: 70 },
  frost:     { name: 'Frost Splash', glyph: '◯', unlock: 90 },
  spike:     { name: 'Arcane Spike', glyph: '∧', unlock: 130 },
  nova:      { name: 'Fire Nova',    glyph: '★', unlock: 180 },
};
export const SPELL_LIST = Object.keys(SPELL_META);
export const MAX_LEVEL = 5;
export function levelCost(level) { return 45 + (level - 1) * 40; } // cost from `level` -> level+1

export const COMBO_META = {
  firetornado: { name: 'Fire Tornado', a: 'fireball', b: 'gust',      cost: 150, desc: '△ then — : a roaming vortex of flame.' },
  icestorm:    { name: 'Ice Storm',    a: 'frost',    b: 'lightning', cost: 210, desc: '◯ then ϟ : a freezing, shocking storm.' },
  holynova:    { name: 'Holy Nova',    a: 'heal',     b: 'nova',      cost: 240, desc: '∨ then ★ : heal yourself and blast foes.' },
};
export const COMBO_LIST = Object.keys(COMBO_META);

export const ROOM_COST = 220;
export const DECOR = [
  { id: 'rug',    name: 'Cozy Rug',        cost: 50 },
  { id: 'banner', name: 'Wizard Banner',   cost: 70 },
  { id: 'plant',  name: 'Potted Mandrake', cost: 60 },
];
export const REST_BONUS = 30; // +max HP on your next run after resting

export const QUESTS = [
  { id: 'q_kill',   text: 'Vanquish 70 foes in one run', type: 'kills',  goal: 70,  reward: 120 },
  { id: 'q_time',   text: 'Survive 3 minutes',            type: 'time',   goal: 180, reward: 150 },
  { id: 'q_chores', text: 'Finish 2 forest chores',       type: 'chores', goal: 2,   reward: 130 },
  { id: 'q_boss',   text: 'Defeat the Goblin King',       type: 'boss',   goal: 1,   reward: 300 },
];

function defaultSave() {
  return {
    gold: 0,
    owned: { fireball: true, gust: true },
    level: { fireball: 1, gust: 1 },
    combos: {},
    loadout: ['fireball', 'gust'],
    room: { owned: false, decor: {} },
    questIdx: 0, questDone: false,
    rested: false,
  };
}

let state = defaultSave();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      state = Object.assign(defaultSave(), s);
      state.owned = Object.assign({ fireball: true, gust: true }, state.owned || {});
      state.level = Object.assign({ fireball: 1, gust: 1 }, state.level || {});
      state.combos = state.combos || {};
      state.room = state.room || { owned: false, decor: {} };
      state.room.decor = state.room.decor || {};
      state.loadout = Array.isArray(state.loadout) ? state.loadout.filter(x => state.owned[x]).slice(0, 3) : ['fireball', 'gust'];
      if (state.loadout.length === 0) state.loadout = ['fireball', 'gust'];
    }
  } catch (e) { state = defaultSave(); }
  return state;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
export function get() { return state; }

export const gold = () => state.gold;
export function addGold(n) { state.gold += n; save(); }
export const owns = (id) => !!state.owned[id];
export const spellLevel = (id) => state.level[id] || 0;
export const learned = (id) => !!state.combos[id];
export function spellDmgMult(id) { const l = state.level[id] || 1; return 1 + (l - 1) * 0.22; }
export function canAfford(n) { return state.gold >= n; }

export function unlockSpell(id) {
  const m = SPELL_META[id];
  if (!m || owns(id) || m.starter || !canAfford(m.unlock)) return false;
  state.gold -= m.unlock; state.owned[id] = true; state.level[id] = 1; save(); return true;
}
export function upgradeSpell(id) {
  if (!owns(id)) return false;
  const l = state.level[id] || 1;
  if (l >= MAX_LEVEL) return false;
  const c = levelCost(l);
  if (!canAfford(c)) return false;
  state.gold -= c; state.level[id] = l + 1; save(); return true;
}
export const isEquipped = (id) => state.loadout.includes(id);
export const getLoadout = () => state.loadout.slice();
export function toggleEquip(id) {
  if (!owns(id)) return false;
  const i = state.loadout.indexOf(id);
  if (i >= 0) { if (state.loadout.length <= 1) return false; state.loadout.splice(i, 1); }
  else { if (state.loadout.length >= 3) return false; state.loadout.push(id); }
  save(); return true;
}

export function learnCombo(id) {
  const m = COMBO_META[id];
  if (!m || learned(id) || !owns(m.a) || !owns(m.b) || !canAfford(m.cost)) return false;
  state.gold -= m.cost; state.combos[id] = true; save(); return true;
}
// combos castable given the equipped set
export function activeCombos(equippedSet) {
  return COMBO_LIST.filter(id => learned(id) && equippedSet.has(COMBO_META[id].a) && equippedSet.has(COMBO_META[id].b));
}

export const roomOwned = () => state.room.owned;
export function buyRoom() { if (state.room.owned || !canAfford(ROOM_COST)) return false; state.gold -= ROOM_COST; state.room.owned = true; save(); return true; }
export const ownsDecor = (id) => !!state.room.decor[id];
export function buyDecor(id) {
  const d = DECOR.find(x => x.id === id);
  if (!d || !state.room.owned || state.room.decor[id] || !canAfford(d.cost)) return false;
  state.gold -= d.cost; state.room.decor[id] = true; save(); return true;
}
export function rest() { if (!state.room.owned || state.rested) return false; state.rested = true; save(); return true; }
export const isRested = () => state.rested;
export function consumeRest() { const r = state.rested; if (r) { state.rested = false; save(); } return r; }

export function currentQuest() { return QUESTS[state.questIdx % QUESTS.length]; }
export const questDone = () => state.questDone;
export function evaluateQuest(run) {
  if (state.questDone) return false;
  const q = currentQuest();
  let done = false;
  if (q.type === 'kills') done = run.kills >= q.goal;
  else if (q.type === 'time') done = run.time >= q.goal;
  else if (q.type === 'chores') done = run.chores >= q.goal;
  else if (q.type === 'boss') done = !!run.win;
  if (done) { state.questDone = true; save(); }
  return done;
}
export function claimQuest() {
  if (!state.questDone) return 0;
  const r = currentQuest().reward;
  state.gold += r; state.questIdx += 1; state.questDone = false; save();
  return r;
}
