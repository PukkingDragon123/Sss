// meta.js — persistent meta-progression (3 save slots in localStorage): gold,
// spells/combos/loadout, room, equipment, quests, and the idle tavern tycoon.

// the four elements every spell belongs to (shown in the Grimoire & Spell Table)
export const ELEMENTS = {
  fire:  { name: 'Fire',  icon: '🔥', color: '#ff7a3a' },
  water: { name: 'Water', icon: '💧', color: '#5fb0ff' },
  air:   { name: 'Air',   icon: '🌬️', color: '#cfeaff' },
  earth: { name: 'Earth', icon: '🪨', color: '#c9a06a' },
};
export const ELEMENT_LIST = ['fire', 'water', 'air', 'earth'];

// spells: element, glyph, the gem cost to unlock, and a line of lore for the showcase
export const SPELL_META = {
  fireball:  { name: 'Fireball',     glyph: '△', element: 'fire',  starter: true, lore: 'A lobbed bolt that bursts into splash flame.' },
  gust:      { name: 'Gust',         glyph: '—', element: 'air',   starter: true, lore: 'A shove of wind that knocks the swarm back.' },
  lightning: { name: 'Lightning',    glyph: 'ϟ', element: 'air',   gems: 4,  lore: 'A bolt that leaps between nearby foes.' },
  heal:      { name: 'Heal',         glyph: '∨', element: 'water', gems: 5,  lore: 'Restorative waters mend the old fool.' },
  frost:     { name: 'Frost Splash', glyph: '◯', element: 'water', gems: 5,  lore: 'A freezing burst that slows what it touches.' },
  spike:     { name: 'Arcane Spike', glyph: '∧', element: 'earth', gems: 7,  lore: 'A spear of stone erupts from the ground.' },
  nova:      { name: 'Fire Nova',    glyph: '★', element: 'fire',  gems: 10, lore: 'A ring of fire detonates all around you.' },
  acid:      { name: 'Acid Spray',   glyph: '@', element: 'water', gems: 6,  lore: 'A spray of corrosive bile that lingers.' },
  shield:    { name: 'Barrier',      glyph: '▢', element: 'earth', gems: 6,  lore: 'A wall of stone-light soaks the next hits.' },
  quake:     { name: 'Quake',        glyph: 'W', element: 'earth', gems: 8,  lore: 'A shockwave that ruptures the earth.' },
  orb:       { name: 'Arcane Orb',   glyph: 'S', element: 'fire',  gems: 8,  lore: 'A slow, searing orb that bores through ranks.' },
  blink:     { name: 'Blink Strike', glyph: '↻', element: 'air',   gems: 7,  lore: 'Flicker forward in a crackle of air.' },
};
export const SPELL_LIST = Object.keys(SPELL_META);
export const MAX_LEVEL = 5;
export function levelCost(level) { return 60 + (level - 1) * 55; } // cost from `level` -> level+1

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

// ---- Room build/place: a top-down grid you furnish with gold ("craft & place") ----
export const ROOM_GW = 6, ROOM_GH = 4;
export const BUILDABLES = [
  // functional stations — walk up to a placed one to use it (kept cheap so you
  // can get your workshop going early)
  { id: 'spelltable', name: 'Spell Table',  icon: '✦',  cost: 0,   comfort: 0, station: 'skilltree' },
  { id: 'library',    name: 'Arcane Library', icon: '📖', cost: 0,  comfort: 0, station: 'library' },
  { id: 'questboard', name: 'Quest Board',  icon: '📜', cost: 40,  comfort: 0, station: 'manager' },
  { id: 'ledger',     name: 'Ledger Desk',  icon: '📒', cost: 60,  comfort: 0, station: 'ledger' },
  { id: 'wardrobe',   name: 'Equipment Hall', icon: '🎽', cost: 70,  comfort: 0, station: 'wardrobe' },
  { id: 'cauldron',   name: 'Cauldron',     icon: '🜲', cost: 80,  comfort: 0, station: 'cauldron' },
  { id: 'anvil',      name: 'Anvil',        icon: '🔨', cost: 90,  comfort: 0, station: 'blacksmith' },
  // comforts — raise your rest bonus
  { id: 'rug',     name: 'Woven Rug',       icon: '🟫', cost: 55,  comfort: 1 },
  { id: 'chair',   name: 'Armchair',        icon: '🪑', cost: 60,  comfort: 1 },
  { id: 'table',   name: 'Oak Table',       icon: '🟤', cost: 80,  comfort: 1 },
  { id: 'lamp',    name: 'Mage Lamp',       icon: '🏮', cost: 75,  comfort: 1 },
  { id: 'plant',   name: 'Potted Mandrake', icon: '🪴', cost: 70,  comfort: 1 },
  { id: 'shelf',   name: 'Bookshelf',       icon: '📚', cost: 120, comfort: 2 },
  { id: 'trophy',  name: 'Trophy Plinth',   icon: '🏆', cost: 160, comfort: 3 },
  { id: 'chest',   name: 'Treasure Chest',  icon: '🧰', cost: 180, comfort: 3 },
];
export const buildableById = (id) => BUILDABLES.find(b => b.id === id);
export const placedItems = () => (state.room.placed || (state.room.placed = []));
export const cellOccupied = (gx, gy) => placedItems().some(p => p.gx === gx && p.gy === gy);
export const stationBuilt = (id) => placedItems().some(p => p.id === id);
export function placeItem(id, gx, gy) {
  const b = buildableById(id); if (!b) return false;
  if (gx < 0 || gy < 0 || gx >= ROOM_GW || gy >= ROOM_GH) return false;
  if (cellOccupied(gx, gy) || !canAfford(b.cost)) return false;
  if (b.station && stationBuilt(id)) return false; // only one of each station
  state.gold -= b.cost; placedItems().push({ id, gx, gy }); save(); return true;
}
export function removeAt(gx, gy) {
  const arr = placedItems(); const i = arr.findIndex(p => p.gx === gx && p.gy === gy);
  if (i < 0) return false;
  const b = buildableById(arr[i].id); if (b) state.gold += Math.floor(b.cost * 0.5); // half refund
  arr.splice(i, 1); save(); return true;
}
export const roomComfort = () => placedItems().reduce((s, p) => { const b = buildableById(p.id); return s + (b ? b.comfort : 0); }, 0);

// ---- RPG equipment: looted instances with rarity + level ----
export const GEAR_SLOTS = ['hat', 'robe', 'staff', 'charm'];
export const RARITIES = {
  common:    { name: 'Common',    mult: 1.0, color: '#cfcad6', extra: 0, weight: 54 },
  rare:      { name: 'Rare',      mult: 1.7, color: '#6fb0ff', extra: 1, weight: 28 },
  epic:      { name: 'Epic',      mult: 2.6, color: '#b97bff', extra: 1, weight: 13 },
  legendary: { name: 'Legendary', mult: 3.8, color: '#ffcf5c', extra: 2, weight: 5 },
};
export const GEAR_RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
const SLOT_DEF = {
  hat:   { noun: 'Hat',   primary: 'hpMax',      base: 16 },
  robe:  { noun: 'Robe',  primary: 'damageMult', base: 0.08 },
  staff: { noun: 'Staff', primary: 'damageMult', base: 0.12 },
  charm: { noun: 'Charm', primary: 'manaRegen',  base: 3 },
};
const SECONDARY_BASE = { hpMax: 14, damageMult: 0.06, moveSpeed: 0.6, manaRegen: 2.5, manaMax: 12, hpRegen: 1.2, pickupRadius: 0.6, thorns: 6, cooldownMult: -0.05, lifeOnKill: 2, critMult: 0.18, xpMult: 0.1 };
const PREFIX = { common: ['Worn', 'Plain', 'Sturdy'], rare: ['Fine', 'Keen', 'Warded'], epic: ['Arcane', 'Runed', 'Gilded'], legendary: ['Mythic', 'Dragonbone', 'Ancient'] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function roundStat(stat, v) { return (stat === 'damageMult' || stat === 'cooldownMult' || stat === 'moveSpeed' || stat === 'pickupRadius' || stat === 'critMult' || stat === 'xpMult' || stat === 'hpRegen') ? Math.round(v * 100) / 100 : Math.round(v); }
export function statLabel(stat, v) {
  const sign = v > 0 ? '+' : '';
  if (stat === 'damageMult') return `${sign}${Math.round(v * 100)}% dmg`;
  if (stat === 'cooldownMult') return `${Math.round(v * 100)}% cooldown`;
  if (stat === 'moveSpeed') return `${sign}${v} move`;
  if (stat === 'pickupRadius') return `${sign}${v} pickup`;
  if (stat === 'manaRegen') return `${sign}${Math.round(v * 2.2)} per gulp`;
  if (stat === 'hpMax') return `${sign}${v} HP`;
  if (stat === 'manaMax') return `${sign}${v} max mana`;
  if (stat === 'hpRegen') return `${sign}${v} HP/sec`;
  if (stat === 'thorns') return `${sign}${v} thorns`;
  if (stat === 'lifeOnKill') return `${sign}${v} HP/kill`;
  if (stat === 'critMult') return `${sign}${Math.round(v * 100)}% crit dmg`;
  if (stat === 'xpMult') return `${sign}${Math.round(v * 100)}% XP`;
  return `${sign}${v} ${stat}`;
}
export function rollRarity(boss) {
  const entries = Object.entries(RARITIES);
  let total = 0; for (const [, r] of entries) total += boss ? r.weight + r.mult * 6 : r.weight;
  let x = Math.random() * total;
  for (const [id, r] of entries) { x -= (boss ? r.weight + r.mult * 6 : r.weight); if (x <= 0) return id; }
  return 'common';
}
export function genGear(slot, rarity, level) {
  slot = slot || pick(GEAR_SLOTS); rarity = rarity || 'common'; level = Math.max(1, level || 1);
  const def = SLOT_DEF[slot], rd = RARITIES[rarity], lm = 1 + (level - 1) * 0.12;
  const mods = {}; mods[def.primary] = roundStat(def.primary, def.base * rd.mult * lm);
  const pool = Object.keys(SECONDARY_BASE).filter(s => s !== def.primary);
  for (let i = 0; i < rd.extra; i++) { const s = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; if (!s) break; mods[s] = roundStat(s, SECONDARY_BASE[s] * rd.mult * lm); }
  return { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), slot, rarity, level, mods, name: `${pick(PREFIX[rarity])} ${def.noun}` };
}

export const QUESTS = [
  { id: 'q_kill',   text: 'Vanquish 60 foes in one run',    type: 'kills', goal: 60,  reward: 200 },
  { id: 'q_wave',   text: 'Pass 2 forks in a single run',   type: 'wave',  goal: 2,   reward: 240 },
  { id: 'q_boss',   text: 'Defeat any region boss',          type: 'boss',  goal: 1,   reward: 420 },
  { id: 'q_kill2',  text: 'Vanquish 110 foes in one run',   type: 'kills', goal: 110, reward: 360 },
  { id: 'q_clear',  text: 'Conquer a whole region',          type: 'win',   goal: 1,   reward: 520 },
  { id: 'q_wave2',  text: 'Fight your way to the boss lair', type: 'wave',  goal: 3,   reward: 300 },
  { id: 'q_kill3',  text: 'Vanquish 170 foes in one run',   type: 'kills', goal: 170, reward: 540 },
  { id: 'q_clear2', text: 'Conquer another region',          type: 'win',   goal: 1,   reward: 640 },
];

// ---- Research: spend 💎 gems at the Arcane Library; projects finish after some
// DAYS pass (a day ticks each time you work a shift or return from a venture).
// Completed research applies its bonus to every future run. ----
export const RESEARCH = [
  { id: 'r_power',  name: 'Battle Magic',       icon: '🔥', days: 2, gems: 8,  desc: '+15% spell damage, always.',        apply: s => { s.damageMult += 0.15; } },
  { id: 'r_mana',   name: 'Deeper Draughts',    icon: '💧', days: 2, gems: 6,  desc: '+25 max mana, always.',             apply: s => { s.manaMax += 25; } },
  { id: 'r_focus',  name: 'Steady Focus',       icon: '🌬️', days: 3, gems: 10, desc: '−12% spell cooldowns, always.',     apply: s => { s.cooldownMult = Math.max(0.4, s.cooldownMult * 0.88); } },
  { id: 'r_vigor',  name: 'Iron Constitution',  icon: '🪨', days: 2, gems: 7,  desc: '+30 max HP, always.',               apply: s => { s.hpMax += 30; } },
  { id: 'r_crit',   name: 'Killer Edge',        icon: '🎯', days: 3, gems: 12, desc: '+35% crit damage, always.',         apply: s => { s.critMult = (s.critMult || 2) + 0.35; } },
  { id: 'r_divine', name: 'Gem Divining',       icon: '💎', days: 3, gems: 10, desc: '+60% gems won from every venture.', gemBonus: 0.6 },
];
export const researchById = (id) => RESEARCH.find(r => r.id === id);
export const currentDay = () => state.day || 1;
export const researchActive = () => state.research && state.research.activeId ? researchById(state.research.activeId) : null;
export const researchDaysLeft = () => (state.research && state.research.daysLeft) || 0;
export const researchDone = (id) => !!(state.research && state.research.done && state.research.done[id]);
export function startResearch(id) {
  const r = researchById(id);
  if (!r || researchActive() || researchDone(id)) return false;
  if (!spendGems(r.gems)) return false;
  state.research.activeId = id; state.research.daysLeft = r.days; save(); return true;
}
// returns the id that completed this tick (or null)
export function advanceDay() {
  state.day = (state.day || 1) + 1;
  let finished = null;
  if (state.research && state.research.activeId) {
    state.research.daysLeft = Math.max(0, (state.research.daysLeft || 0) - 1);
    if (state.research.daysLeft <= 0) { finished = state.research.activeId; state.research.done[finished] = true; state.research.activeId = null; }
  }
  save(); return finished;
}
export function gemBonusMult() { let m = 1; for (const r of RESEARCH) if (r.gemBonus && researchDone(r.id)) m += r.gemBonus; return m; }
// apply every completed research bonus to a fresh run's stats
export function applyResearch(stats) { for (const r of RESEARCH) if (r.apply && researchDone(r.id)) r.apply(stats); }

// ---- ✦ artifact collection: bosses drop them; you carry up to 3 into a run ----
export const MAX_ARTIFACTS = 3;
export const ownedArtifacts = () => state.artifacts || [];
export const hasArtifact = (id) => (state.artifacts || []).includes(id);
export function addArtifact(id) {
  if (!state.artifacts) state.artifacts = [];
  if (state.artifacts.includes(id)) return false;
  state.artifacts.push(id);
  if (!state.equippedArtifacts) state.equippedArtifacts = [];
  if (state.equippedArtifacts.length < MAX_ARTIFACTS) state.equippedArtifacts.push(id); // auto-carry a fresh one if there's room
  save(); return true;
}
export const equippedArtifacts = () => state.equippedArtifacts || [];
export const artifactEquipped = (id) => (state.equippedArtifacts || []).includes(id);
export function toggleArtifactEquip(id) {
  if (!hasArtifact(id)) return false;
  if (!state.equippedArtifacts) state.equippedArtifacts = [];
  const i = state.equippedArtifacts.indexOf(id);
  if (i >= 0) state.equippedArtifacts.splice(i, 1);
  else { if (state.equippedArtifacts.length >= MAX_ARTIFACTS) return false; state.equippedArtifacts.push(id); }
  save(); return true;
}

// ---- idle / tycoon: the Tipsy Toad earns coin while patrons drink ----
export const TAVERN_BASE_RATE = 2;   // gold / minute, before upgrades (kept modest)
export const TAVERN_BASE_CAP = 100;  // max gold banked while away
export const TAVERN_UPGRADES = [
  { id: 'bar',    name: 'Polished Bar',   baseCost: 110, rate: 2, desc: '+2 gold/min' },
  { id: 'tables', name: 'More Tables',    baseCost: 150, rate: 3, desc: '+3 gold/min' },
  { id: 'bard',   name: 'Hire a Bard',    baseCost: 220, rate: 5, desc: '+5 gold/min' },
  { id: 'cellar', name: 'Bigger Cellar',  baseCost: 180, cap: 150, desc: '+150 coin storage' },
  { id: 'rep',    name: 'Good Reputation', baseCost: 300, rate: 8, desc: '+8 gold/min' },
];

function defaultSave() {
  return {
    gold: 40,  // a little seed coin (gold is earned by WORKING the bar)
    gems: 6,   // 💎 a few starter gems to unlock your first spell
    day: 1,    // the tavern clock — work by day, venture by night
    research: { activeId: null, daysLeft: 0, done: {} },
    artifacts: [],          // ✦ artifacts collected from bosses (persistent)
    equippedArtifacts: [],  // which ones you carry into a run (max 3)
    owned: { fireball: true, gust: true },
    level: { fireball: 1, gust: 1 },
    combos: {},
    loadout: ['fireball', 'gust'],
    room: { owned: false, decor: {} },
    gear: [], equippedGear: { hat: null, robe: null, staff: null, charm: null },
    tavern: { owned: false, bank: 0, lastSeen: Date.now(), upgrades: {} },
    questIdx: 0, questDone: false,
    rested: false,
    cleared: [], // stage ids whose boss you've beaten (gates the world map)
  };
}

let state = defaultSave();
let activeSlot = 0;
const slotKey = (i) => `wonkywizard.save.v2.slot${i}`;

export function useSlot(i) { activeSlot = i; load(); return state; }
export function currentSlot() { return activeSlot; }

export function slotSummary(i) {
  try {
    const raw = localStorage.getItem(slotKey(i));
    if (!raw) return { exists: false };
    const s = JSON.parse(raw);
    const ownedSpells = Object.keys(s.owned || {}).length;
    return { exists: true, gold: s.gold || 0, spells: ownedSpells, tavern: !!(s.tavern && s.tavern.owned) };
  } catch (e) { return { exists: false }; }
}
export function eraseSlot(i) { try { localStorage.removeItem(slotKey(i)); } catch (e) {} if (i === activeSlot) state = defaultSave(); }

export function load() {
  try {
    const raw = localStorage.getItem(slotKey(activeSlot));
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
      state.gear = Array.isArray(state.gear) ? state.gear : [];
      state.equippedGear = Object.assign({ hat: null, robe: null, staff: null, charm: null }, state.equippedGear || {});
      state.tavern = Object.assign({ owned: false, bank: 0, lastSeen: Date.now(), upgrades: {} }, state.tavern || {});
      state.gems = state.gems || 0;
      state.day = state.day || 1;
      state.research = Object.assign({ activeId: null, daysLeft: 0, done: {} }, state.research || {});
      state.research.done = state.research.done || {};
      state.artifacts = Array.isArray(state.artifacts) ? state.artifacts : [];
      state.equippedArtifacts = Array.isArray(state.equippedArtifacts) ? state.equippedArtifacts.slice(0, 3) : [];
      // offline earnings since last seen (capped)
      const dt = Math.max(0, (Date.now() - (state.tavern.lastSeen || Date.now())) / 1000);
      if (state.tavern.owned) state.tavern.bank = Math.min(tavernCap(), state.tavern.bank + tavernRate() / 60 * dt);
      state.tavern.lastSeen = Date.now();
    } else {
      state = defaultSave();
    }
  } catch (e) { state = defaultSave(); }
  return state;
}
export function save() { try { state.tavern.lastSeen = Date.now(); localStorage.setItem(slotKey(activeSlot), JSON.stringify(state)); } catch (e) {} }
export function get() { return state; }

export const gold = () => state.gold;
export function addGold(n) { state.gold += n; save(); }
export function spendGold(n) { if (state.gold < n) return false; state.gold -= n; save(); return true; }
// 💎 gemstones — won in battle, spent on spells & research (gold is earned by WORKING)
export const gems = () => state.gems || 0;
export function addGems(n) { state.gems = (state.gems || 0) + n; save(); }
export function spendGems(n) { if ((state.gems || 0) < n) return false; state.gems -= n; save(); return true; }
export const canAffordGems = (n) => (state.gems || 0) >= n;
export const owns = (id) => !!state.owned[id];
export const spellLevel = (id) => state.level[id] || 0;
export const learned = (id) => !!state.combos[id];
export function spellDmgMult(id) { const l = state.level[id] || 1; return 1 + (l - 1) * 0.22; }
export function canAfford(n) { return state.gold >= n; }
// spells now cost GEMS to unlock & upgrade
export const spellUnlockGems = (id) => (SPELL_META[id] && SPELL_META[id].gems) || 0;
export const spellUpgradeGems = (level) => 3 + (level - 1) * 2;

export function unlockSpell(id) {
  const m = SPELL_META[id];
  if (!m || owns(id) || m.starter) return false;
  const c = spellUnlockGems(id);
  if (!spendGems(c)) return false;
  state.owned[id] = true; state.level[id] = 1; save(); return true;
}
export function upgradeSpell(id) {
  if (!owns(id)) return false;
  const l = state.level[id] || 1;
  if (l >= MAX_LEVEL) return false;
  if (!spendGems(spellUpgradeGems(l))) return false;
  state.level[id] = l + 1; save(); return true;
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
export function rest() { if (state.rested) return false; state.rested = true; save(); return true; } // the room is always yours now

// ---- world-map stage unlock (each boss opens the next haunt) ----
export const stageCleared = (id) => (state.cleared || []).includes(id);
export function markStageCleared(id) { if (!state.cleared) state.cleared = []; if (!state.cleared.includes(id)) { state.cleared.push(id); save(); } }
export const isRested = () => state.rested;
export function consumeRest() { const r = state.rested; if (r) { state.rested = false; save(); } return r; }

// ---- idle tavern tycoon ----
export const tavernOwned = () => state.tavern.owned;
export function setTavernOwned(v) { state.tavern.owned = v; if (v) state.tavern.lastSeen = Date.now(); save(); }
export const tavernUpgradeLevel = (id) => state.tavern.upgrades[id] || 0;
export function tavernUpgradeCost(id) { const u = TAVERN_UPGRADES.find(x => x.id === id); if (!u) return 0; return Math.round(u.baseCost * Math.pow(1.6, tavernUpgradeLevel(id))); }
export function tavernRate() { let r = TAVERN_BASE_RATE; for (const u of TAVERN_UPGRADES) if (u.rate) r += u.rate * tavernUpgradeLevel(u.id); return r; }
export function tavernCap() { let c = TAVERN_BASE_CAP; for (const u of TAVERN_UPGRADES) if (u.cap) c += u.cap * tavernUpgradeLevel(u.id); return c; }
export const tavernBank = () => Math.floor(state.tavern.bank);
export function accrueIdle(dtSec) { if (!state.tavern.owned) return; state.tavern.bank = Math.min(tavernCap(), state.tavern.bank + tavernRate() / 60 * dtSec); }
export function collectTavern() { const g = Math.floor(state.tavern.bank); if (g <= 0) return 0; state.gold += g; state.tavern.bank -= g; save(); return g; }
export function buyTavernUpgrade(id) {
  const u = TAVERN_UPGRADES.find(x => x.id === id);
  if (!u || !state.tavern.owned) return false;
  const c = tavernUpgradeCost(id);
  if (!canAfford(c)) return false;
  state.gold -= c; state.tavern.upgrades[id] = tavernUpgradeLevel(id) + 1; save(); return true;
}

// ---- gear inventory (looted equipment) ----
export const gearList = () => state.gear;
export const gearById = (id) => state.gear.find(g => g.id === id);
export const equippedGearId = (slot) => state.equippedGear[slot];
export function addGear(inst) { state.gear.push(inst); save(); return inst; }
// generate + grant a random drop (used when an enemy dies)
export function dropGear(level, boss) { const inst = genGear(null, rollRarity(boss), level); return inst; }

// ---- the Anvil GACHA: spend gold + gems to cast a random gear piece; richer
// ingredients tilt the rarity odds upward (better ingredients = better gear) ----
export const FORGE_TIERS = [
  { id: 'crude',  name: 'Crude Cast', icon: '🔩', gold: 40,  gems: 2,  w: { common: 60, rare: 30, epic: 9,  legendary: 1 } },
  { id: 'fine',   name: 'Fine Forge', icon: '⚒️', gold: 95,  gems: 5,  w: { common: 22, rare: 46, epic: 26, legendary: 6 } },
  { id: 'master', name: 'Masterwork', icon: '🏆', gold: 180, gems: 12, w: { common: 4,  rare: 28, epic: 46, legendary: 22 } },
];
export const forgeTierById = (id) => FORGE_TIERS.find(t => t.id === id);
function rollWeighted(w) { let tot = 0; for (const k in w) tot += w[k]; let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'common'; }
export const canForge = (id) => { const t = forgeTierById(id); return !!t && state.gold >= t.gold && (state.gems || 0) >= t.gems; };
export function forgeGear(id) {
  const t = forgeTierById(id); if (!t || !canForge(id)) return null;
  state.gold -= t.gold; state.gems -= t.gems;
  const lvl = 1 + ((state.cleared || []).length) + FORGE_TIERS.indexOf(t);
  const inst = genGear(null, rollWeighted(t.w), lvl);
  state.gear.push(inst); save(); return inst;
}
export function equipGear(id) {
  const inst = gearById(id); if (!inst) return false;
  state.equippedGear[inst.slot] = (state.equippedGear[inst.slot] === id) ? null : id; save(); return true;
}
export function gearValue(inst) { const r = RARITIES[inst.rarity]; return Math.round(20 * r.mult * inst.level); }
export function salvageGear(id) {
  const inst = gearById(id); if (!inst) return 0;
  for (const s in state.equippedGear) if (state.equippedGear[s] === id) state.equippedGear[s] = null;
  state.gear = state.gear.filter(g => g.id !== id);
  const v = gearValue(inst); state.gold += v; save(); return v;
}
export function upgradeGearCost(inst) { return Math.round(40 * RARITIES[inst.rarity].mult * inst.level); }
export function upgradeGear(id) {
  const inst = gearById(id); if (!inst || inst.level >= 10) return false;
  const cost = upgradeGearCost(inst); if (!canAfford(cost)) return false;
  state.gold -= cost;
  const factor = (1 + inst.level * 0.12) / (1 + (inst.level - 1) * 0.12);
  for (const k in inst.mods) inst.mods[k] = roundStat(k, inst.mods[k] * factor);
  inst.level++; save(); return true;
}
// total stat mods from all equipped gear
export function equipMods() {
  const out = {};
  for (const slot of GEAR_SLOTS) {
    const inst = gearById(state.equippedGear[slot]);
    if (!inst) continue;
    for (const k in inst.mods) out[k] = (out[k] || 0) + inst.mods[k];
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
