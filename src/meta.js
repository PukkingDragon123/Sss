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
  acid:      { name: 'Acid Spray',   glyph: '@', unlock: 120 },
  shield:    { name: 'Barrier',      glyph: '▢', unlock: 110 },
  quake:     { name: 'Quake',        glyph: 'W', unlock: 160 },
  orb:       { name: 'Arcane Orb',   glyph: 'S', unlock: 150 },
  blink:     { name: 'Blink Strike', glyph: '↻', unlock: 140 },
};
export const SPELL_LIST = Object.keys(SPELL_META);
export const MAX_LEVEL = 5;
export function levelCost(level) { return 45 + (level - 1) * 40; } // cost from `level` -> level+1

export const COMBO_META = {
  firetornado:  { name: 'Fire Tornado', a: 'fireball', b: 'gust',      cost: 150, desc: '△ then — : a roaming vortex of flame.' },
  icestorm:     { name: 'Ice Storm',    a: 'frost',    b: 'lightning', cost: 210, desc: '◯ then ϟ : a freezing, shocking storm.' },
  holynova:     { name: 'Holy Nova',    a: 'heal',     b: 'nova',      cost: 240, desc: '∨ then ★ : heal yourself and blast foes.' },
  toxiccloud:   { name: 'Toxic Cloud',  a: 'acid',     b: 'nova',      cost: 200, desc: '@ then ★ : a lingering cloud of acid.' },
  bulwark:      { name: 'Bulwark',      a: 'shield',   b: 'heal',      cost: 190, desc: '▢ then ∨ : a big heal and a thick barrier.' },
  glacier:      { name: 'Glacier',      a: 'quake',    b: 'frost',     cost: 230, desc: 'W then ◯ : a shattering wave of ice.' },
  flamedash:    { name: 'Flame Dash',   a: 'blink',    b: 'fireball',  cost: 220, desc: '↻ then △ : dash leaving an explosion.' },
  thunderorb:   { name: 'Thunder Orb',  a: 'orb',      b: 'lightning', cost: 250, desc: 'S then ϟ : a crackling orb of storms.' },
};
export const COMBO_LIST = Object.keys(COMBO_META);

export const ROOM_COST = 220;
export const DECOR = [
  { id: 'rug',       name: 'Cozy Rug',        cost: 50 },
  { id: 'banner',    name: 'Wizard Banner',   cost: 70 },
  { id: 'plant',     name: 'Potted Mandrake', cost: 60 },
  { id: 'torch',     name: 'Wall Torches',    cost: 80 },
  { id: 'bookshelf', name: 'Bookshelf',       cost: 110 },
  { id: 'statue',    name: 'Stone Gargoyle',  cost: 130 },
  { id: 'crystal',   name: 'Mana Crystal',    cost: 150 },
  { id: 'fireplace', name: 'Fireplace',       cost: 170 },
];
export const REST_BONUS = 30; // +max HP on your next run after resting

// ---- equipment ----
export const EQUIP_SLOTS = ['hat', 'robe', 'staff', 'charm'];
export const EQUIPMENT = {
  hat: [
    { id: 'hat_none', name: 'Bare Head', cost: 0, mods: {} },
    { id: 'hat_sturdy', name: 'Sturdy Hat', cost: 120, mods: { hpMax: 35 } },
    { id: 'hat_mind', name: 'Mindcap', cost: 150, mods: { manaRegen: 7 } },
  ],
  robe: [
    { id: 'robe_none', name: 'Tattered Robe', cost: 0, mods: {} },
    { id: 'robe_arcane', name: 'Arcane Robe', cost: 170, mods: { damageMult: 0.15 } },
    { id: 'robe_swift', name: 'Swift Robe', cost: 150, mods: { moveSpeed: 1.0 } },
  ],
  staff: [
    { id: 'staff_none', name: 'Old Stick', cost: 0, mods: {} },
    { id: 'staff_ember', name: 'Ember Staff', cost: 190, mods: { damageMult: 0.22 } },
    { id: 'staff_quick', name: 'Quick Staff', cost: 190, mods: { cooldownMult: -0.12 } },
  ],
  charm: [
    { id: 'charm_none', name: 'Lucky Coin', cost: 0, mods: {} },
    { id: 'charm_magnet', name: 'Magnet Charm', cost: 120, mods: { pickupRadius: 1.6 } },
    { id: 'charm_thorn', name: 'Thorn Charm', cost: 160, mods: { thorns: 12, hpMax: 15 } },
  ],
};

export const QUESTS = [
  { id: 'q_kill',   text: 'Vanquish 70 foes in one run', type: 'kills', goal: 70,  reward: 120 },
  { id: 'q_wave',   text: 'Reach wave 6 in any stage',    type: 'wave',  goal: 6,   reward: 150 },
  { id: 'q_boss',   text: 'Defeat any stage boss',        type: 'boss',  goal: 1,   reward: 300 },
  { id: 'q_clear',  text: 'Clear a whole stage',          type: 'win',   goal: 1,   reward: 350 },
];

function defaultSave() {
  return {
    gold: 0,
    owned: { fireball: true, gust: true },
    level: { fireball: 1, gust: 1 },
    combos: {},
    loadout: ['fireball', 'gust'],
    room: { owned: false, decor: {} },
    equipOwned: { hat_none: true, robe_none: true, staff_none: true, charm_none: true },
    equipped: { hat: 'hat_none', robe: 'robe_none', staff: 'staff_none', charm: 'charm_none' },
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
      state.equipOwned = Object.assign({ hat_none: true, robe_none: true, staff_none: true, charm_none: true }, state.equipOwned || {});
      state.equipped = Object.assign({ hat: 'hat_none', robe: 'robe_none', staff: 'staff_none', charm: 'charm_none' }, state.equipped || {});
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

// ---- equipment ----
function findItem(slot, id) { return (EQUIPMENT[slot] || []).find(x => x.id === id); }
export const ownsEquip = (id) => !!state.equipOwned[id];
export const equippedId = (slot) => state.equipped[slot];
export function buyEquip(slot, id) {
  const it = findItem(slot, id);
  if (!it || ownsEquip(id) || !canAfford(it.cost)) return false;
  state.gold -= it.cost; state.equipOwned[id] = true; save(); return true;
}
export function equipItem(slot, id) {
  if (!ownsEquip(id) || !findItem(slot, id)) return false;
  state.equipped[slot] = id; save(); return true;
}
// total stat mods from all equipped gear
export function equipMods() {
  const out = {};
  for (const slot of EQUIP_SLOTS) {
    const it = findItem(slot, state.equipped[slot]);
    if (!it) continue;
    for (const k in it.mods) out[k] = (out[k] || 0) + it.mods[k];
  }
  return out;
}

export function currentQuest() { return QUESTS[state.questIdx % QUESTS.length]; }
export const questDone = () => state.questDone;
export function evaluateQuest(run) {
  if (state.questDone) return false;
  const q = currentQuest();
  let done = false;
  if (q.type === 'kills') done = run.kills >= q.goal;
  else if (q.type === 'time') done = run.time >= q.goal;
  else if (q.type === 'wave') done = (run.wave || 0) >= q.goal;
  else if (q.type === 'boss') done = !!run.bossKilled;
  else if (q.type === 'win') done = !!run.win;
  if (done) { state.questDone = true; save(); }
  return done;
}
export function claimQuest() {
  if (!state.questDone) return 0;
  const r = currentQuest().reward;
  state.gold += r; state.questIdx += 1; state.questDone = false; save();
  return r;
}
