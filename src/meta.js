// meta.js — persistent meta-progression (3 save slots in localStorage): gold,
// spells/combos/loadout, room, equipment, quests, and the idle tavern tycoon.
import { UPGRADES } from './upgrades.js';
// one-way import only — story.js must never import meta.js (would create a cycle)
import { STAGE_ORDER, STAGES, STAGES_PER_REGION } from './story.js';
import { CARDS, CARD_BY_ID, rollCard } from './cards.js';
import { pickGearVariant } from './pixelicons.js';

// the four elements every spell belongs to (shown in the Grimoire & Spell Table)
export const ELEMENTS = {
  fire:  { name: 'Fire',  icon: '🔥', color: '#ff7a3a' },
  water: { name: 'Water', icon: '💧', color: '#5fb0ff' },
  air:   { name: 'Air',   icon: '🌬️', color: '#a6dcef' },
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
  { id: 'ledger',     name: 'Ledger Desk',  icon: '📒', cost: 60,  comfort: 0, station: 'ledger' },
  { id: 'library',    name: 'Arcane Library', icon: '📖', cost: 70, comfort: 0, station: 'library' },
  // feature-gated stations — unlocked by completing quests
  { id: 'wardrobe',   name: 'Character Hall', icon: '🧙', cost: 70,  comfort: 0, station: 'character',  feature: 'gear' },
  { id: 'cauldron',   name: 'Cauldron',     icon: '🜲', cost: 80,  comfort: 0, station: 'cauldron',   feature: 'combos' },
  { id: 'anvil',      name: 'TGC Terminal', icon: '🃏', cost: 90,  comfort: 0, station: 'blacksmith', feature: 'forge' },
  // comforts — raise your rest bonus
  { id: 'rug',     name: 'Woven Rug',       icon: '🟫', cost: 55,  comfort: 1 },
  { id: 'chair',   name: 'Armchair',        icon: '🪑', cost: 60,  comfort: 1 },
  { id: 'table',   name: 'Oak Table',       icon: '🟤', cost: 80,  comfort: 1 },
  { id: 'lamp',    name: 'Mage Lamp',       icon: '🏮', cost: 75,  comfort: 1 },
  { id: 'plant',   name: 'Potted Mandrake', icon: '🪴', cost: 70,  comfort: 1 },
  { id: 'shelf',   name: 'Bookshelf',       icon: '📚', cost: 120, comfort: 2 },
  { id: 'trophy',  name: 'Trophy Plinth',   icon: '🏆', cost: 160, comfort: 3 },
  { id: 'chest',   name: 'Treasure Chest',  icon: '🧰', cost: 180, comfort: 3 },
  // ---- 🪑 furniture: decorate your den (each with its own pixel sprite) ----
  { id: 'sofa',       name: 'Plush Sofa',        icon: 'furn_sofa',       cost: 90,  comfort: 2, cat: 'furniture' },
  { id: 'bookcase',   name: 'Grand Bookcase',    icon: 'furn_bookcase',   cost: 130, comfort: 2, cat: 'furniture' },
  { id: 'clock',      name: 'Grandfather Clock', icon: 'furn_clock',      cost: 110, comfort: 2, cat: 'furniture' },
  { id: 'aquarium',   name: 'Aquarium',          icon: 'furn_aquarium',   cost: 160, comfort: 3, cat: 'furniture' },
  { id: 'fountain',   name: 'Fountain',          icon: 'furn_fountain',   cost: 180, comfort: 3, cat: 'furniture' },
  { id: 'piano',      name: 'Grand Piano',       icon: 'furn_piano',      cost: 200, comfort: 3, cat: 'furniture' },
  { id: 'chandelier', name: 'Candelabra',        icon: 'furn_chandelier', cost: 220, comfort: 4, cat: 'furniture' },
  { id: 'throne',     name: 'Throne',            icon: 'furn_throne',     cost: 300, comfort: 5, cat: 'furniture' },
];
export const buildableById = (id) => BUILDABLES.find(b => b.id === id);
// Clash-of-Clans build time (seconds) — scales with the piece's cost; shown in the palette
export const buildTimeOf = (idOrB) => { const b = (idOrB && typeof idOrB === 'object') ? idOrB : buildableById(idOrB); return b ? Math.max(1, Math.round(b.cost / 60)) : 0; };
export const placedItems = () => (state.room.placed || (state.room.placed = []));
export const cellOccupied = (gx, gy) => placedItems().some(p => p.gx === gx && p.gy === gy);
export const stationBuilt = (id) => placedItems().some(p => p.id === id);
export function placeItem(id, gx, gy, rot = 0) {
  const b = buildableById(id); if (!b) return false;
  if (b.feature && !featureUnlocked(b.feature)) return false; // locked until a quest unlocks it
  if (gx < 0 || gy < 0 || gx >= ROOM_GW || gy >= ROOM_GH) return false;
  if (cellOccupied(gx, gy) || !canAfford(b.cost)) return false;
  if (b.station && stationBuilt(id)) return false; // only one of each station
  state.gold -= b.cost; placedItems().push({ id, gx, gy, rot: rot || 0 }); save(); return true;
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
  // classic RPG rarity ladder (grey -> blue -> purple -> orange) on the dark-fantasy UI
  common:    { name: 'Common',    mult: 1.0, color: '#c9c2b4', extra: 0, weight: 54 },
  rare:      { name: 'Rare',      mult: 1.7, color: '#3a8fe0', extra: 1, weight: 28 },
  epic:      { name: 'Epic',      mult: 2.6, color: '#a24be0', extra: 1, weight: 13 },
  legendary: { name: 'Legendary', mult: 3.8, color: '#f0a92e', extra: 2, weight: 5 },
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
  // pick one of the slot's 7–8 unique pixel-sprite variants — each has its own art + noun
  const variant = pickGearVariant(slot);
  const sprite = variant ? variant.sprite : slot;
  const noun = variant ? variant.name : def.noun;
  return { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), slot, rarity, level, mods, sprite, name: `${pick(PREFIX[rarity])} ${noun}` };
}

export const QUESTS = [
  { id: 'q_wave',   text: 'Pass 2 forks in a single run',   type: 'wave',  goal: 2,   reward: 140 },
  { id: 'q_kill',   text: 'Vanquish 50 foes in one run',    type: 'kills', goal: 50,  reward: 120 },
  { id: 'q_wave2',  text: 'Fight your way to the boss lair', type: 'wave',  goal: 3,   reward: 180 },
  { id: 'q_boss',   text: 'Defeat any region boss',          type: 'boss',  goal: 1,   reward: 280 },
  { id: 'q_kill2',  text: 'Vanquish 110 foes in one run',   type: 'kills', goal: 110, reward: 280 },
  { id: 'q_clear',  text: 'Conquer a whole region',          type: 'win',   goal: 1,   reward: 420 },
  { id: 'q_kill3',  text: 'Vanquish 170 foes in one run',   type: 'kills', goal: 170, reward: 460 },
  { id: 'q_clear2', text: 'Conquer another region',          type: 'win',   goal: 1,   reward: 560 },
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

// ---- 🐾 creatures / pets: adopt a companion at the Menagerie; ONE follows you into a
// run (a little floating sprite beside the wizard) and grants a passive boost. Some tick
// automatically each second ("auto-XP", auto-mana, auto-heal); others are flat stat boons
// or a gem-find bonus. Owned pets persist; you carry one at a time. ----
export const PETS = [
  { id: 'wisp',  name: 'XP Wisp',      cost: 12, kind: 'autoxp',   val: 3,   desc: 'Auto-gains +3 XP every second in battle.' },
  { id: 'fairy', name: 'Mana Fairy',   cost: 12, kind: 'automana', val: 4,   desc: 'Trickles +4 mana every second.' },
  { id: 'bat',   name: 'Vampat',       cost: 14, kind: 'autoheal', val: 1.5, desc: 'Siphons +1.5 HP every second.' },
  { id: 'owl',   name: 'Wise Owl',     cost: 14, kind: 'stat', mods: { xpMult: 0.25 },      desc: '+25% XP gained.' },
  { id: 'cat',   name: 'Coin Cat',     cost: 12, kind: 'stat', mods: { pickupRadius: 2.5 }, desc: '+2.5 pickup range (auto-vacuum).' },
  { id: 'drake', name: 'Drakeling',    cost: 18, kind: 'stat', mods: { damageMult: 0.15 },  desc: '+15% spell damage.' },
  { id: 'golem', name: 'Pebble Golem', cost: 16, kind: 'stat', mods: { hpMax: 30 },         desc: '+30 max health.' },
  { id: 'slime', name: 'Gem Slime',    cost: 20, kind: 'gem',  val: 0.25,   desc: '+25% gems from every venture.' },
];
export const petById = (id) => PETS.find(p => p.id === id);
export const ownedPets = () => state.pets || [];
export const hasPet = (id) => (state.pets || []).includes(id);
export const equippedPetId = () => state.equippedPet || null;
export const equippedPet = () => petById(state.equippedPet);
export function adoptPet(id) {
  const p = petById(id); if (!p || hasPet(id)) return false;
  if (!spendGems(p.cost)) return false;
  if (!state.pets) state.pets = []; state.pets.push(id);
  if (!state.equippedPet) state.equippedPet = id; // your first adopted pet is carried automatically
  save(); return true;
}
export function equipPet(id) {
  if (id && !hasPet(id)) return false;
  state.equippedPet = (state.equippedPet === id) ? null : id; save(); return true;
}
// flat stat boons from the carried pet (folded into a run like gear mods)
export function petMods() { const p = equippedPet(); return (p && p.kind === 'stat' && p.mods) ? p.mods : {}; }
// gem-find multiplier from the carried pet (applied to venture rewards)
export function petGemMult() { const p = equippedPet(); return (p && p.kind === 'gem') ? 1 + p.val : 1; }
// the carried pet's per-second auto effect for the arena loop (or null)
export function petAuto() { const p = equippedPet(); return (p && /^auto/.test(p.kind)) ? { kind: p.kind, val: p.val } : null; }

// ---- deck-building: which abilities are allowed to appear on level-up ----
export const isDeckOff = (id) => !!(state.deckOff && state.deckOff[id]);
export const deckOffIds = () => Object.keys(state.deckOff || {});
export function toggleDeck(id) {
  if (!state.deckOff) state.deckOff = {};
  if (state.deckOff[id]) delete state.deckOff[id]; else state.deckOff[id] = 1;
  save(); return true;
}

// ---- upgrade unlock graph: 5 base boons; earn the rest via spells/combos/quests/wins/merchant ----
const BASE_UPGRADES = ['maxhp', 'damage', 'haste', 'mana', 'cdr'];
export const upgradeUnlocked = (id) => !!(state.unlockedUpgrades && state.unlockedUpgrades[id]);
export const unlockedUpgradeIds = () => Object.keys(state.unlockedUpgrades || {});
// earnable extras = boons that are neither base nor self-revealing spell upgrades (those appear when their spell is learned)
export const lockableUpgrades = () => UPGRADES.filter(u => !u.available && !BASE_UPGRADES.includes(u.id));
export const lockedUpgrades = () => lockableUpgrades().filter(u => !upgradeUnlocked(u.id));
export const unlockedUpgradeCount = () => unlockedUpgradeIds().length;
export const earnableUpgradeTotal = () => BASE_UPGRADES.length + lockableUpgrades().length;
export function unlockUpgrade(id) { if (!state.unlockedUpgrades) state.unlockedUpgrades = {}; if (state.unlockedUpgrades[id]) return false; state.unlockedUpgrades[id] = 1; save(); return true; }
export function unlockRandomUpgrade() { const pool = lockedUpgrades(); if (!pool.length) return null; const u = pool[Math.floor(Math.random() * pool.length)]; unlockUpgrade(u.id); return u; }

// ---- playstyle / archetype chosen for the next run (persists) ----
export const getArchetype = () => state.archetype || null;
export function setArchetype(id) { state.archetype = id || null; save(); }

// ---- quest-unlocked features (each claimed bounty opens the next) ----
export const FEATURE_ORDER = ['gear', 'combos', 'forge'];
export const FEATURE_LABELS = { gear: 'Character Hall', combos: 'Cauldron (combos)', forge: 'TGC.com Terminal' };
export const featureUnlocked = (id) => !!(state.features && state.features[id]);
export function unlockFeature(id) { if (!state.features) state.features = {}; if (!state.features[id]) { state.features[id] = 1; save(); return true; } return false; }
export function unlockNextFeature() { const next = FEATURE_ORDER.find(f => !featureUnlocked(f)); if (next) { unlockFeature(next); return next; } return null; }

// ---- the tavern DEBT (the main quest is to pay it off) ----
export const DEBT_TOTAL = 600;
export const debt = () => state.debt || 0;
export function payDebt(n) { const pay = Math.min(n, state.gold, state.debt || 0); if (pay <= 0) return 0; state.gold -= pay; state.debt -= pay; save(); return pay; }

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
    gold: 60,  // a little seed coin (gold is earned by WORKING the bar) — enough for a Quest Board
    gems: 8,   // 💎 a few starter gems to unlock your first spell
    herbs: 0,  // 🌿 brewing materials gathered while venturing
    gemstones: { fire: 0, water: 0, air: 0, earth: 0 }, // elemental gemstones won in battle
    brews: {}, // brewed-potion counts (each is a small permanent boon)
    ingredients: {},        // 🌿🍄 weird herbs & mushrooms gathered for cooking (per-id counts)
    menu: { houseale: 1 },  // unlocked recipes the kitchen can serve (house ale is free)
    staff: {},              // hired kitchen helpers (per-id level)
    cook: { served: 0, shifts: 0, best: 0 }, // lifetime cooking stats (for quests)
    cookClaims: {},         // claimed cooking-quest ids
    seen: {},  // which mechanics the player has tried (tutorial quest log)
    day: 1,    // the tavern clock — work by day, venture by night
    research: { activeId: null, daysLeft: 0, done: {} },
    artifacts: [],          // ✦ artifacts collected from bosses (persistent)
    equippedArtifacts: [],  // which ones you carry into a run (max 3)
    pets: [],               // 🐾 adopted creatures (persistent)
    equippedPet: null,      // the one companion you carry into a run
    deckOff: {},            // ability ids the player has removed from their level-up deck
    unlockedUpgrades: { maxhp: 1, damage: 1, haste: 1, mana: 1, cdr: 1 }, // 5 base boons; earn the rest
    archetype: null,        // chosen playstyle for the next run (null = none yet)
    features: {},           // quest-unlocked features (build / gear / combos / deck …)
    debt: 600,              // the tavern debt — the main quest is to pay it off (a multi-run arc)
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
    introSeen: false, // played the opening cutscene + guided fight (once per save)
    regionBest: {}, // furthest stage (1–10) reached per region id
    stars: {},      // ⭐ best star rating (0–3) per level, keyed [regionId][stageNum] — gates new regions
    customer: { active: [], seq: 1, done: 0 }, // walk-in customer quests (the RPG fetch/bounty loop)
    cards: [],            // collected card ids (fun rewards from minigames & side quests)
    sideClaims: {},       // claimed side-quest ids -> 1
    stats: { mgWins: 0, mgPerfect: 0, gemsEver: 0, bossKills: 0 }, // counters that side quests read
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
      state.herbs = (typeof state.herbs === 'number') ? state.herbs : 0;
      state.gemstones = Object.assign({ fire: 0, water: 0, air: 0, earth: 0 }, state.gemstones || {});
      state.brews = state.brews || {};
      state.ingredients = Object.assign({}, state.ingredients || {});
      state.menu = Object.assign({ houseale: 1 }, state.menu || {});
      state.staff = Object.assign({}, state.staff || {});
      state.cook = Object.assign({ served: 0, shifts: 0, best: 0 }, state.cook || {});
      if (state.customer && Array.isArray(state.customer.active)) state.customer.active = state.customer.active.filter(q => q && q.kind !== 'deliver'); // foraging removed
      state.cookClaims = Object.assign({}, state.cookClaims || {});
      state.seen = state.seen || {};
      state.day = state.day || 1;
      state.research = Object.assign({ activeId: null, daysLeft: 0, done: {} }, state.research || {});
      state.research.done = state.research.done || {};
      state.artifacts = Array.isArray(state.artifacts) ? state.artifacts : [];
      state.equippedArtifacts = Array.isArray(state.equippedArtifacts) ? state.equippedArtifacts.slice(0, 3) : [];
      state.pets = Array.isArray(state.pets) ? state.pets : [];
      state.equippedPet = (state.equippedPet && state.pets.includes(state.equippedPet)) ? state.equippedPet : null;
      state.deckOff = state.deckOff || {};
      state.unlockedUpgrades = Object.assign({ maxhp: 1, damage: 1, haste: 1, mana: 1, cdr: 1 }, state.unlockedUpgrades || {});
      state.features = state.features || {};
      state.regionBest = state.regionBest || {};
      state.stars = state.stars || {};
      // migrate pre-star saves: the world map is now star-gated, so grant retroactive
      // stars for prior progress (each cleared region = its 10 levels; partial regions up
      // to their furthest reached stage) so no already-earned region ever re-locks. Only
      // fills stages that have no rating yet, so it never lowers real stars.
      {
        const seed = (region, upto) => {
          if (!region || !(upto > 0)) return;
          state.stars[region] = state.stars[region] || {};
          for (let s = 1; s <= upto; s++) if (!state.stars[region][s]) state.stars[region][s] = 1;
        };
        for (const id of (state.cleared || [])) seed(id, 10);
        for (const id in (state.regionBest || {})) seed(id, state.regionBest[id]);
      }
      state.customer = Object.assign({ active: [], seq: 1, done: 0 }, state.customer || {});
      state.cards = Array.isArray(state.cards) ? state.cards : [];
      state.sideClaims = Object.assign({}, state.sideClaims || {});
      state.stats = Object.assign({ mgWins: 0, mgPerfect: 0, gemsEver: 0, bossKills: 0 }, state.stats || {});
      state.customer.active = Array.isArray(state.customer.active) ? state.customer.active : [];
      state.debt = (typeof state.debt === 'number') ? state.debt : 600;
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
export function addGems(n) { state.gems = (state.gems || 0) + n; if (n > 0) { if (!state.stats) state.stats = {}; state.stats.gemsEver = (state.stats.gemsEver || 0) + n; } save(); }
export function spendGems(n) { if ((state.gems || 0) < n) return false; state.gems -= n; save(); return true; }
export const canAffordGems = (n) => (state.gems || 0) >= n;
// 🌿 herbs (gathered venturing) + elemental gemstones (won in battle) — brewing materials, kept in the satchel
export const herbs = () => state.herbs || 0;
export function addHerbs(n) { state.herbs = (state.herbs || 0) + n; save(); }
export function spendHerbs(n) { if ((state.herbs || 0) < n) return false; state.herbs -= n; save(); return true; }
const _emptyGemstones = () => ({ fire: 0, water: 0, air: 0, earth: 0 });
export const gemstones = () => state.gemstones || _emptyGemstones();
export function addGemstone(el, n = 1) { if (!state.gemstones) state.gemstones = _emptyGemstones(); state.gemstones[el] = (state.gemstones[el] || 0) + n; markSeen('gemstone'); save(); }
export function spendGemstone(el, n = 1) { const g = state.gemstones || _emptyGemstones(); if ((g[el] || 0) < n) return false; g[el] -= n; state.gemstones = g; save(); return true; }
export const totalGemstones = () => { const g = state.gemstones || {}; return (g.fire || 0) + (g.water || 0) + (g.air || 0) + (g.earth || 0); };

// ==== the RESTAURANT: pantry of hunted ingredients + the menu you master + zodiac boons ====
// pantry: {ingredientId: count} — corpses hauled home in the caravan land here
// (distinct from the retired herb "ingredients" block below, which has no callers)
export const pantry = () => state.pantry || {};
export function pantryAdd(id, n = 1) { if (!state.pantry) state.pantry = {}; state.pantry[id] = (state.pantry[id] || 0) + n; save(); }
export function pantrySpend(needs) {
  const p = state.pantry || {};
  for (const [id, n] of Object.entries(needs || {})) if ((p[id] || 0) < n) return false;
  for (const [id, n] of Object.entries(needs || {})) p[id] -= n;
  state.pantry = p; save(); return true;
}
export const pantryCount = (id) => (state.pantry && state.pantry[id]) || 0;
export const pantryTotal = () => Object.values(state.pantry || {}).reduce((a, b) => a + b, 0);
// ---- the DINING HALL floor plan: owned table plots {plotId: {tier, chairs, deco}} ----
export const restoPlots = () => { state.resto = state.resto || { plots: {} }; return state.resto.plots; };
export function restoSetPlot(id, data) { state.resto = state.resto || { plots: {} }; state.resto.plots[id] = data; save(); }
// menu mastery: {recipeId: stars 0..5} — every plate cooked teaches you (learn by doing)
export const recipeMastery = (id) => (state.menuMastery && state.menuMastery[id]) || 0;
export function bumpMastery(id, max = 5) {
  if (!state.menuMastery) state.menuMastery = {};
  const cur = state.menuMastery[id] || 0;
  if (cur >= max) return false;
  state.menuMastery[id] = cur + 1; save(); return true;
}
export const platesServed = () => (state.stats && state.stats.plates) || 0;
export function notePlateServed() { if (!state.stats) state.stats = {}; state.stats.plates = (state.stats.plates || 0) + 1; save(); }
// zodiac: unlocked sign ids (the arcane skill tree — permanent passives)
export const zodiacSigns = () => state.zodiac || [];
export const zodiacHas = (id) => (state.zodiac || []).includes(id);
export function unlockZodiac(id, cost) {
  if (zodiacHas(id)) return false;
  if (!spendGems(cost)) return false;
  if (!state.zodiac) state.zodiac = [];
  state.zodiac.push(id); save(); return true;
}

// ---- brewing: spend elemental gemstones at the Cauldron for a lasting potion (a permanent boon) ----
export const POTIONS = [
  { id: 'vigor', name: 'Potion of Vigor',   icon: '🧪', el: 'fire',  herbs: 3, gems: 2, perHp: 8,     desc: '+8 max health, for good.' },
  { id: 'focus', name: 'Potion of Focus',   icon: '🧪', el: 'air',   herbs: 3, gems: 2, perMana: 6,   desc: '+6 max mana, for good.' },
  { id: 'might', name: 'Potion of Might',   icon: '🧪', el: 'earth', herbs: 3, gems: 2, perDmg: 0.04, desc: '+4% spell damage, for good.' },
  { id: 'ward',  name: 'Potion of Warding', icon: '🧪', el: 'water', herbs: 3, gems: 2, perRegen: 0.6, desc: '+0.6 health per second, for good.' },
];
export const potionById = (id) => POTIONS.find(p => p.id === id);
export const brewCount = (id) => (state.brews && state.brews[id]) || 0;
export function canBrew(id) { const p = potionById(id); if (!p) return false; return (gemstones()[p.el] || 0) >= p.gems; }
export function brewPotion(id) {
  const p = potionById(id); if (!p || !canBrew(id)) return false;
  spendHerbs(p.herbs); spendGemstone(p.el, p.gems);
  if (!state.brews) state.brews = {}; state.brews[id] = (state.brews[id] || 0) + 1; save(); return true;
}
export function applyBrews(stats) {
  const b = state.brews || {};
  for (const p of POTIONS) { const n = b[p.id] || 0; if (!n) continue;
    if (p.perHp) stats.hpMax += p.perHp * n;
    if (p.perMana) stats.manaMax += p.perMana * n;
    if (p.perDmg) stats.damageMult += p.perDmg * n;
    if (p.perRegen) stats.hpRegen += p.perRegen * n;
  }
}
// ================= COOKING: weird ingredients, a buyable menu, staff & quests =================
// Ingredients are foraged in runs (herbs & mushrooms, each its own kind) and rarely dropped by foes.
// tier 3 = rare (only from rare forage / enemy drops). color drives the 3D model.
export const INGREDIENTS = [
  { id: 'witchbasil',   name: 'Witch Basil',    icon: '🌿', kind: 'herb',   tier: 1, color: 0x5fb84a, desc: 'A common, peppery leaf.' },
  { id: 'eggflower',    name: 'Egg Flower',     icon: '🌼', kind: 'herb',   tier: 1, color: 0xf5e36a, desc: 'Smells faintly of breakfast.' },
  { id: 'moonpetal',    name: 'Moon Petal',     icon: '🌸', kind: 'herb',   tier: 1, color: 0xff9ad0, desc: 'Glows softly at dusk.' },
  { id: 'honeythistle', name: 'Honey Thistle',  icon: '🍯', kind: 'herb',   tier: 1, color: 0xe0a83c, desc: 'Sticky and sweet.' },
  { id: 'emberroot',    name: 'Ember Root',     icon: '🔥', kind: 'herb',   tier: 2, color: 0xff6a3a, desc: 'Warm to the touch.' },
  { id: 'dragonhead',   name: 'Dragon Head Herb', icon: '🐲', kind: 'herb', tier: 3, color: 0x9a3a2a, desc: 'Rare. Roars when picked. Allegedly.' },
  { id: 'starseed',     name: 'Star Seed',      icon: '⭐', kind: 'herb',   tier: 3, color: 0xffe08a, desc: 'Rare. Fell from the night sky.' },
  { id: 'glowshroom',   name: 'Glow Shroom',    icon: '🍄', kind: 'shroom', tier: 1, color: 0xc8402a, desc: 'A cheerful little cap.' },
  { id: 'pufflesack',   name: 'Puffle Sack',    icon: '🎈', kind: 'shroom', tier: 1, color: 0xff8ac0, desc: 'Squishy. Pops if squeezed.' },
  { id: 'frostcap',     name: 'Frost Cap',      icon: '❄️', kind: 'shroom', tier: 2, color: 0x9fe0ff, desc: 'Cold even indoors.' },
  { id: 'inkcap',       name: 'Ink Cap',        icon: '🖤', kind: 'shroom', tier: 2, color: 0x6a4ad0, desc: 'Leaks dark, tasty ink.' },
  { id: 'bogwart',      name: 'Bog Wart',       icon: '🐸', kind: 'shroom', tier: 2, color: 0x6a8e3a, desc: 'Found near swamp water.' },
];
export const ingredientById = (id) => INGREDIENTS.find(x => x.id === id);
export const ingredientsByKind = (kind) => INGREDIENTS.filter(x => x.kind === kind);
export const ingredientCount = (id) => (state.ingredients && state.ingredients[id]) || 0;
export const totalIngredients = () => Object.values(state.ingredients || {}).reduce((a, b) => a + b, 0);
export function addIngredient(id, n = 1) { if (!state.ingredients) state.ingredients = {}; state.ingredients[id] = (state.ingredients[id] || 0) + n; save(); }
export function spendIngredient(id, n = 1) { const g = state.ingredients || {}; if ((g[id] || 0) < n) return false; g[id] -= n; state.ingredients = g; save(); return true; }
export const randomIngredient = (maxTier = 2) => { const pool = INGREDIENTS.filter(x => x.tier <= maxTier); return pool[Math.floor(Math.random() * pool.length)]; };
export const randomRareIngredient = () => { const pool = INGREDIENTS.filter(x => x.tier >= 2); return pool[Math.floor(Math.random() * pool.length)]; };

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

// ===== the PLAYER LEVEL: one persistent level that unlocks spells, recipes &
// ingredients as you adventure (replaces the old stage/region gating) =====
export const LEVEL_UNLOCKS = {
  1: { spells: ['fireball', 'gust'], recipes: ['alebread', 'boarchop'], ings: ['boarmeat', 'wildherb', 'shroomcap'] },
  2: { recipes: ['herbsalad', 'shroomstew'] },
  3: { ings: ['lizardtail'], recipes: ['tailskewer'] },
  4: { spells: ['lightning'], ings: ['slimejelly'], recipes: ['jellyflan'] },
  5: { ings: ['batwing'], recipes: ['batsnack'] },
  6: { spells: ['frost'], ings: ['hydrawing'], recipes: ['wingplatter'] },
  7: { ings: ['chamflank'], recipes: ['chamsteak'] },
  8: { spells: ['heal'], ings: ['whaleblub'], recipes: ['blubberpot'] },
};
export function playerLevel() { return state.plevel || 1; }
export function playerXp() { return state.pxp || 0; }
export function setPlayerProgress(level, xp) { state.plevel = Math.max(1, level | 0); state.pxp = Math.max(0, Math.round(xp || 0)); save(); }
export function grantSpell(id) {
  if (state.owned[id]) return false;
  state.owned[id] = true; state.level[id] = state.level[id] || 1;
  if (Array.isArray(state.loadout) && state.loadout.length < 3 && !state.loadout.includes(id)) state.loadout.push(id);
  save(); return true;
}
const _unlockLevelOf = (kind, id) => { for (const lv in LEVEL_UNLOCKS) { const u = LEVEL_UNLOCKS[lv]; if (u[kind] && u[kind].includes(id)) return +lv; } return 1; };
export const recipeUnlockLevel = (id) => _unlockLevelOf('recipes', id);
export const recipeUnlocked = (id) => playerLevel() >= recipeUnlockLevel(id);
export const ingredientUnlocked = (id) => playerLevel() >= _unlockLevelOf('ings', id);
export const unlocksAtLevel = (lv) => LEVEL_UNLOCKS[lv] || null;

// ---- world-map stage unlock (each boss opens the next haunt) ----
export const introSeen = () => !!state.introSeen;
export function setIntroSeen() { state.introSeen = true; save(); }
export const stageCleared = (id) => (state.cleared || []).includes(id);
export function markStageCleared(id) { if (!state.cleared) state.cleared = []; if (!state.cleared.includes(id)) { state.cleared.push(id); save(); } }
// furthest of the region's 10 inner stages you've reached (best X/10 on the world map)
export const regionBest = (id) => (state.regionBest && state.regionBest[id]) || 0;
export function setRegionBest(id, n) { if (!state.regionBest) state.regionBest = {}; if (n > (state.regionBest[id] || 0)) { state.regionBest[id] = n; save(); } }
export const maxRegionBest = () => Object.values(state.regionBest || {}).reduce((a, b) => Math.max(a, b), 0);

// ---- ⭐ candy-crush stars: each of a region's 10 levels earns up to 3 stars (best
// kept). Accumulated stars gate the next region on the world map. Gates are set so
// clearing the region before it always earns more than enough — you can never soft-lock,
// but chasing 3-stars lets keen players race ahead. ----
export const MAX_STARS = 3;
// total stars needed to open the Nth region (index into the world-map order). Each region
// yields up to 30 stars, and unlocking region i means regions 0…i-1 are already cleared
// (≥10·i stars), so every gate here is comfortably reachable.
export const REGION_STAR_GATE = [0, 6, 14, 22, 30, 38, 46, 54];
export const regionStarReq = (idx) => (idx <= 0 ? 0 : (REGION_STAR_GATE[idx] != null ? REGION_STAR_GATE[idx] : idx * 8));
export const stageStars = (region, stageNum) => ((state.stars && state.stars[region] && state.stars[region][stageNum]) || 0);
// record a level's star result, keeping the player's best; returns how many NEW stars were gained
export function awardStars(region, stageNum, n) {
  n = Math.max(0, Math.min(MAX_STARS, n | 0));
  if (!state.stars) state.stars = {};
  if (!state.stars[region]) state.stars[region] = {};
  const cur = state.stars[region][stageNum] || 0;
  if (n > cur) { state.stars[region][stageNum] = n; save(); return n - cur; }
  return 0;
}
export function regionStars(region) { const r = (state.stars && state.stars[region]) || {}; let s = 0; for (const k in r) s += r[k] || 0; return s; }
export function totalStars() { let s = 0; const all = state.stars || {}; for (const region in all) for (const k in all[region]) s += all[region][k] || 0; return s; }
// is the Nth world-map region unlocked? (region 0 is always open; the rest are star-gated)
export const regionUnlockedByStars = (idx) => totalStars() >= regionStarReq(idx);

// ===================== generic stat counters (read by side quests) =====================
export function bumpStat(name, n = 1) { if (!state.stats) state.stats = {}; state.stats[name] = (state.stats[name] || 0) + n; save(); }
export const stat = (name) => (state.stats && state.stats[name]) || 0;

// ===================== collectible cards =====================
export const cardsOwned = () => state.cards || [];
export const hasCard = (id) => (state.cards || []).includes(id);
export const cardCount = () => (state.cards || []).length;
export function addCard(id) {
  if (!CARD_BY_ID[id]) return false;                 // unknown id
  if (!state.cards) state.cards = [];
  if (state.cards.includes(id)) return false;        // already owned
  state.cards.push(id); save(); return true;
}
// rarity-weighted draw from the unowned set; returns the card object (or null if complete)
export function grantRandomCard() {
  const id = rollCard(state.cards || []);
  if (!id) return null;
  addCard(id);
  return CARD_BY_ID[id];
}

// ===================== side quests (award specific cards) =====================
export const SIDE_QUESTS = [
  { id: 'sq_first_win',  text: 'Win your first minigame',        stat: 'mgWins',    goal: 1,  card: 'card_jester' },
  { id: 'sq_mg_5',       text: 'Win 5 minigames',                stat: 'mgWins',    goal: 5,  card: 'card_clown' },
  { id: 'sq_perfect',    text: 'Score a perfect minigame',       stat: 'mgPerfect', goal: 1,  card: 'card_ace' },
  { id: 'sq_mole_pro',   text: 'Win Whack-a-Goblin',             stat: 'won_mole',  goal: 1,  card: 'card_mallet' },
  { id: 'sq_rhythm_pro', text: 'Win the Beat Tap game',          stat: 'won_rhythm', goal: 1, card: 'card_bard' },
  { id: 'sq_gems_50',    text: 'Earn 50 gems (lifetime)',        stat: 'gemsEver',  goal: 50, card: 'card_miser' },
  { id: 'sq_reach_4',    text: 'Reach stage 4 of any region',    stat: 'bestStage', goal: 4,  card: 'card_owl' },
  { id: 'sq_boss_1',     text: 'Defeat a region boss',           stat: 'bossKills', goal: 1,  card: 'card_slayer' },
  { id: 'sq_cards_6',    text: 'Collect 6 cards',                stat: 'cardCount', goal: 6,  card: 'card_curator' },
  { id: 'sq_collector',  text: 'Collect 14 cards',               stat: 'cardCount', goal: 14, card: 'card_king' },
];
const _sideStatValue = (q) => q.stat === 'cardCount' ? cardCount() : q.stat === 'bestStage' ? maxRegionBest() : stat(q.stat);
export function sideQuestReady(id) { const q = SIDE_QUESTS.find(s => s.id === id); return !!q && _sideStatValue(q) >= q.goal; }
export function sideQuests() {
  return SIDE_QUESTS.map(q => ({ ...q, have: _sideStatValue(q), claimed: !!(state.sideClaims && state.sideClaims[q.id]), ready: sideQuestReady(q.id), cardName: CARD_BY_ID[q.card] ? CARD_BY_ID[q.card].name : q.card }));
}
export function claimSideQuest(id) {
  const q = SIDE_QUESTS.find(s => s.id === id); if (!q) return null;
  if (!state.sideClaims) state.sideClaims = {};
  if (state.sideClaims[q.id] || !sideQuestReady(id)) return null;
  state.sideClaims[q.id] = 1;
  const fresh = addCard(q.card);
  save();
  return { card: CARD_BY_ID[q.card], fresh };
}

// ===================== unique tavern customers (RPG quest-givers) =====================
// Distinct walk-in patrons who roam the bar and either request an item or hand you a
// quest (reach a deep stage / fell a boss). Always tracked against persistent state, so
// progress carries across runs. This is the RPG loop that replaced the cooking minigame.
// Each walk-in patron has a unique 3D "pixel" model (kind → src/charmodels.js).
export const CUSTOMER_CAST = [
  { name: 'Old Maple',      icon: '🧓', color: 0xc98a4a, kind: 'elder',    line: 'A working wizard! Lend an old soul a hand?' },
  { name: 'Pip the Bard',   icon: '🎻', color: 0x6f9bd0, kind: 'bard',     line: 'A song wants a deed behind it. Be my hero?' },
  { name: 'Sister Vex',     icon: '🐈', color: 0x7a6fb0, kind: 'catfolk',  line: 'The order pays well for small favours.' },
  { name: 'Grumble',        icon: '👺', color: 0x6fb08a, kind: 'goblin',   line: 'Hmf. You. I need a thing done.' },
  { name: 'Lady Ember',     icon: '👰', color: 0xcf6f6f, kind: 'noble',    line: 'A refined request, for a refined fee.' },
  { name: 'Two-Coin Tom',   icon: '🤠', color: 0xc9a24a, kind: 'merchant', line: 'Got a job, got coin. We talkin\'?' },
  { name: 'Hooded Knox',    icon: '🥷', color: 0x5a6a7a, kind: 'rogue',    line: '…psst. Quiet work, good pay.' },
  { name: 'Granny Sloe',    icon: '👵', color: 0xb06fa0, kind: 'granny',   line: 'Be a dear and fetch an old witch a thing?' },
  { name: 'Sir Gallan',     icon: '⚔️', color: 0x9aa3ad, kind: 'knight',   line: 'Honour to you, mage. A worthy task awaits.' },
  { name: 'Brother Bog',    icon: '🐸', color: 0x6cae54, kind: 'frogfolk', line: 'Ribbit. The marsh has need of you, friend.' },
  { name: 'Mossy the Cap',  icon: '🍄', color: 0xcf3a3a, kind: 'mushroom', line: 'Spore-greetings! A little errand, perhaps?' },
  { name: 'Old Cobble',     icon: '🗿', color: 0x8a8f86, kind: 'golem',    line: '…rock… needs… doing. You help.' },
  { name: 'Durga Ironbeard', icon: '🪓', color: 0xb5651d, kind: 'dwarf',   line: 'Aye! A stout job for a stout reward, eh?' },
  { name: 'Wisp o\' Wynn',  icon: '👻', color: 0xdfeaff, kind: 'ghost',    line: 'Ooo… a living soul. Do me one small favour?' },
];
const _maxRegionBest = () => Object.values(state.regionBest || {}).reduce((a, b) => Math.max(a, b), 0);
function _genCustomerQuest() {
  if (!state.customer) state.customer = { active: [], seq: 1, done: 0 };
  const npc = CUSTOMER_CAST[Math.floor(Math.random() * CUSTOMER_CAST.length)];
  const id = 'cq' + (state.customer.seq++);
  const roll = Math.random();
  // regions whose boss you've yet to fell (for the "champion" quest)
  const uncleared = STAGE_ORDER.filter(r => !(state.cleared || []).includes(r));
  let q;
  if (roll < 0.45 && uncleared.length > 0) {
    const region = uncleared[0];
    q = { kind: 'clear', region, icon: '👑',
      ask: `Fell the champion of ${STAGES[region].name}.`, reward: { gold: 45, gems: 6 } };
  } else {
    // reach quest (also the safe fallback when every region is already cleared)
    const target = Math.min(10, _maxRegionBest() + 1 + Math.floor(Math.random() * 3));
    q = { kind: 'reach', stage: target, icon: '🗺️',
      ask: `Push to Stage ${target} of any region.`, reward: { gold: 18 + target * 3, gems: 2 } };
  }
  return Object.assign({ id, accepted: false, npc: { name: npc.name, icon: npc.icon, color: npc.color, kind: npc.kind, line: npc.line } }, q);
}
export const customerQuests = () => (state.customer && state.customer.active) || [];
// RPG accept flow: quests are OFFERED by patrons; only the ones you accept enter your log
export const acceptedQuests = () => customerQuests().filter(q => q.accepted);
export function acceptCustomerQuest(id) {
  const q = customerQuests().find(x => x.id === id);
  if (!q || q.accepted) return false;
  q.accepted = true; save(); return true;
}
export const customersDone = () => (state.customer && state.customer.done) || 0;
// top up the active board to `max` walk-in requests (called on entering the bar)
export function refreshCustomers(max = 2) {
  if (!state.customer) state.customer = { active: [], seq: 1, done: 0 };
  let added = false;
  while (state.customer.active.length < max) { state.customer.active.push(_genCustomerQuest()); added = true; }
  if (added) save();
  return state.customer.active;
}
// has the player met this quest's goal?
export function customerQuestReady(q) {
  if (!q) return false;
  if (q.kind === 'reach') return _maxRegionBest() >= q.stage;
  if (q.kind === 'clear') return (state.cleared || []).includes(q.region);
  return false;
}
// a short progress string for the talk dialog
export function customerQuestProgress(q) {
  if (!q) return '';
  if (q.kind === 'reach') return `Best stage reached: ${_maxRegionBest()} / ${q.stage}`;
  if (q.kind === 'clear') return (state.cleared || []).includes(q.region) ? 'Champion felled!' : 'Not yet conquered.';
  return '';
}
// turn in a ready quest: consume any goods, pay the reward, drop it from the board
export function claimCustomerQuest(id) {
  if (!state.customer) return null;
  const i = state.customer.active.findIndex(q => q.id === id);
  if (i < 0) return null;
  const q = state.customer.active[i];
  if (!customerQuestReady(q)) return null;
  if (q.reward.gems) state.gems += q.reward.gems;
  if (q.reward.gold) state.gold += q.reward.gold;
  state.customer.active.splice(i, 1);
  state.customer.done = (state.customer.done || 0) + 1;
  save();
  return { reward: q.reward, npc: q.npc, kind: q.kind };
}
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
  state.gear.push(inst); markSeen('forge'); save(); return inst;
}

// ---- TGC.com booster packs: buy a pack, watch it open, then CHOOSE one of the
// revealed pieces to keep (the rest are discarded). Same rarity odds as the forge tiers,
// reframed as a card-pack shop. buyPack spends the cost and returns the revealed options;
// nothing enters your inventory until you keepGear() the one you pick. ----
export const PACKS = [
  { id: 'starter', name: 'Starter Booster', icon: '🎴', gold: 40,  gems: 2,  picks: 3, w: { common: 60, rare: 30, epic: 9,  legendary: 1 } },
  { id: 'prime',   name: 'Prime Booster',   icon: '🎴', gold: 95,  gems: 5,  picks: 3, w: { common: 22, rare: 46, epic: 26, legendary: 6 } },
  { id: 'legend',  name: 'Legend Booster',  icon: '🎴', gold: 180, gems: 12, picks: 3, w: { common: 4,  rare: 28, epic: 46, legendary: 22 } },
];
export const packById = (id) => PACKS.find(p => p.id === id);
export const canBuyPack = (id) => { const p = packById(id); return !!p && state.gold >= p.gold && (state.gems || 0) >= p.gems; };
// spend the cost and roll the pack's revealed options (NOT yet owned — caller picks one)
export function buyPack(id) {
  const p = packById(id); if (!p || !canBuyPack(id)) return null;
  state.gold -= p.gold; state.gems -= p.gems; save();
  const lvl = 1 + ((state.cleared || []).length) + PACKS.indexOf(p);
  const opts = []; for (let i = 0; i < (p.picks || 3); i++) opts.push(genGear(null, rollWeighted(p.w), lvl));
  return opts;
}
// keep a chosen revealed piece (adds it to the inventory)
export function keepGear(inst) { if (!inst) return false; state.gear.push(inst); markSeen('forge'); save(); return true; }
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
// what's worn per slot (rarity or null) — drives the wizard's visible gear models
export function equippedGearSummary() {
  const out = {};
  for (const slot of GEAR_SLOTS) { const inst = gearById(state.equippedGear[slot]); out[slot] = inst ? inst.rarity : null; }
  return out;
}
// the full worn instance per slot (rarity + sprite variant) — drives the ACTUAL 3D gear models
export function equippedGearFull() {
  const out = {};
  for (const slot of GEAR_SLOTS) out[slot] = gearById(state.equippedGear[slot]) || null;
  return out;
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
  state.gold += r; state.questIdx += 1; state.questDone = false;
  const unlocked = unlockNextFeature(); // each claimed bounty opens the next facility
  save();
  return { reward: r, unlocked };
}

// ---- "up next" breadcrumbs: the player's next few concrete goals, in priority order.
// Shown on the results screen so every run ends with a reason to take one more. ----
export function nextGoals() {
  const goals = [];
  if (questDone()) goals.push({ icon: '📜', text: 'Claim your bounty reward in the quest log' });
  const q = !questDone() && currentQuest();
  // a bounty-unlocked facility that still needs building comes first — it's one tap away
  for (const f of FEATURE_ORDER) {
    if (featureUnlocked(f)) { const b = BUILDABLES.find(x => x.feature === f); if (b && !stationBuilt(b.id)) { goals.push({ icon: '🔨', text: `Build the ${b.name} in your room` }); break; } }
  }
  const r = researchActive();
  if (r) { const left = researchDaysLeft(); goals.push({ icon: '🔬', text: `${r.name} finishes in ${left} day${left === 1 ? '' : 's'}` }); }
  else if (stationBuilt('library') && RESEARCH.some(x => !researchDone(x.id) && canAffordGems(x.gems))) goals.push({ icon: '🔬', text: 'Fund a research project at your Arcane Library' });
  if (q) goals.push({ icon: '📌', text: `Bounty: ${q.text} (+${q.reward}🪙)` });
  const next = STAGE_ORDER.find(id => !stageCleared(id));
  if (next) { const best = regionBest(next); goals.push({ icon: '👑', text: `Conquer ${STAGES[next].name}${best > 0 ? ` — best: stage ${best}/${STAGES_PER_REGION}` : ''}` }); }
  else goals.unshift({ icon: '👑', text: 'All 8 realms conquered — the land is saved!' });
  if (debt() > 0) goals.push({ icon: '🪙', text: `${debt()} gold of tavern debt left — serve, chat & finish requests` });
  return goals.slice(0, 3);
}

// ---- tutorial quest log: a checklist that tracks trying every mechanic (mostly derived from save state) ----
export const TUTORIAL_QUESTS = [
  { id: 'cast',      text: 'Cast a spell by drawing its glyph' },
  { id: 'chug',      text: 'Chug a beer to refill your mana' },
  { id: 'level',     text: 'Level up and pick a power' },
  { id: 'boss',      text: 'Defeat a region boss' },
  { id: 'work',      text: 'Serve a drink at the bar for gold' },
  { id: 'spell',     text: 'Learn a new spell at the Spell Table' },
  { id: 'build',     text: 'Build a station in your room' },
  { id: 'gemstone',  text: 'Collect an elemental gemstone' },
  { id: 'brew',      text: 'Brew a potion at the Cauldron' },
  { id: 'forge',     text: 'Forge gear at the Anvil' },
  { id: 'combo',     text: 'Learn a spell combo' },
  { id: 'cards',     text: 'Collect a card from a minigame or quest' },
  { id: 'artifact',  text: 'Carry an artifact into a run' },
];
export const hasSeen = (id) => !!(state.seen && state.seen[id]);
export function markSeen(id) { if (!state.seen) state.seen = {}; if (state.seen[id]) return false; state.seen[id] = 1; save(); return true; }
export function tutDone(id) {
  switch (id) {
    case 'spell':     return SPELL_LIST.some(x => owns(x) && !(SPELL_META[x] && SPELL_META[x].starter));
    case 'build':     return placedItems().some(p => { const b = buildableById(p.id); return b && b.station; });
    case 'brew':      return Object.values(state.brews || {}).some(n => n > 0);
    case 'combo':     return Object.keys(state.combos || {}).length > 0;
    case 'cards':     return cardCount() > 0;
    case 'artifact':  return (state.equippedArtifacts || []).length > 0;
    default:          return hasSeen(id); // cast/chug/level/boss/work/forge/gemstone (flagged as you do them)
  }
}
export const tutorialChecklist = () => TUTORIAL_QUESTS.map(q => ({ id: q.id, text: q.text, done: tutDone(q.id) }));
export const tutorialProgress = () => { let n = 0; for (const q of TUTORIAL_QUESTS) if (tutDone(q.id)) n++; return { done: n, total: TUTORIAL_QUESTS.length }; };
