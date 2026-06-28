// cards.js — a collectible "fun card" set won from minigames & side quests.
// PURE data + pure perk math: imports nothing, touches no DOM/Three, so it loads in
// node for the test suite. Art is emoji only (self-contained, no assets).

export const CARD_RARITY = {
  common:    { name: 'Common',    color: '#9fb0c0', w: 50 },
  uncommon:  { name: 'Uncommon',  color: '#6ee7a0', w: 28 },
  rare:      { name: 'Rare',      color: '#5cc8ff', w: 14 },
  epic:      { name: 'Epic',      color: '#c08bff', w: 6 },
  legendary: { name: 'Legendary', color: '#ffcf5c', w: 2 },
};

// 24 cards. ~half are pure collectibles (perk:null); the rest grant a TINY passive
// folded into a run at the start. Perk keys: gemMult, dmgMult, manaBonus, mgScoreBonus.
export const CARDS = [
  // --- common (8) ---
  { id: 'card_jester',   name: 'The Jester',   icon: '🃏', rarity: 'common',    flavor: 'Laughs in the face of the swarm.', perk: null },
  { id: 'card_clown',    name: 'The Clown',    icon: '🤡', rarity: 'common',    flavor: 'Honk. Honk. HONK.',                perk: null },
  { id: 'card_drunkard', name: 'The Drunkard', icon: '🍺', rarity: 'common',    flavor: 'One more for the road, eh?',        perk: null },
  { id: 'card_patron',   name: 'The Patron',   icon: '🧑', rarity: 'common',    flavor: 'A regular at the Tipsy Toad.',      perk: null },
  { id: 'card_mug',      name: 'Lucky Mug',    icon: '🍻', rarity: 'common',    flavor: 'Never quite empty.',                perk: null },
  { id: 'card_candle',   name: 'Wax & Wick',   icon: '🕯️', rarity: 'common',    flavor: 'A small, stubborn light.',          perk: null },
  { id: 'card_stool',    name: 'The Stool',    icon: '🪑', rarity: 'common',    flavor: 'Three legs of destiny.',            perk: null },
  { id: 'card_broom',    name: 'The Broom',    icon: '🧹', rarity: 'common',    flavor: 'Cleans up after the chaos.',        perk: null },
  // --- uncommon (6) ---
  { id: 'card_miser',    name: 'The Miser',    icon: '🪙', rarity: 'uncommon',  flavor: 'Counts every gem twice.',           perk: { gemMult: 1.05 } },
  { id: 'card_curator',  name: 'The Curator',  icon: '🖼️', rarity: 'uncommon',  flavor: 'Keeps the collection just so.',     perk: null },
  { id: 'card_tinker',   name: 'The Tinker',   icon: '🔧', rarity: 'uncommon',  flavor: 'Good with their hands.',            perk: { mgScoreBonus: 0.03 } },
  { id: 'card_herbalist', name: 'The Herbalist', icon: '🌿', rarity: 'uncommon', flavor: 'Knows which leaf is which.',       perk: null },
  { id: 'card_lantern',  name: 'Old Lantern',  icon: '🏮', rarity: 'uncommon',  flavor: 'Guides you through the dark.',       perk: null },
  { id: 'card_owl',      name: 'Night Owl',    icon: '🦉', rarity: 'uncommon',  flavor: 'Wiser than it looks.',              perk: { manaBonus: 8 } },
  // --- rare (5) ---
  { id: 'card_mallet',   name: 'Lucky Mallet', icon: '🔨', rarity: 'rare',      flavor: 'Bonks true, every time.',           perk: { mgScoreBonus: 0.05 } },
  { id: 'card_bard',     name: 'The Bard',     icon: '🎵', rarity: 'rare',      flavor: 'Always on the beat.',               perk: null },
  { id: 'card_alchemist', name: 'The Alchemist', icon: '⚗️', rarity: 'rare',    flavor: 'Turns spite into gold.',           perk: { gemMult: 1.08 } },
  { id: 'card_knight',   name: 'The Knight',   icon: '🛡️', rarity: 'rare',      flavor: 'Stands between you and harm.',       perk: { dmgMult: 1.03 } },
  { id: 'card_cat',      name: 'Tavern Cat',   icon: '🐈', rarity: 'rare',      flavor: 'Owns the place, really.',           perk: null },
  // --- epic (3) ---
  { id: 'card_ace',      name: 'The Ace',      icon: '🂡', rarity: 'epic',      flavor: 'Perfection, framed in gold.',       perk: { manaBonus: 16 } },
  { id: 'card_slayer',   name: 'Bossbane',     icon: '⚔️', rarity: 'epic',      flavor: 'Felled a giant, once.',             perk: { dmgMult: 1.05 } },
  { id: 'card_sage',     name: 'The Grey Sage', icon: '🧙', rarity: 'epic',     flavor: 'Has read every grimoire twice.',    perk: { gemMult: 1.10 } },
  // --- legendary (2) ---
  { id: 'card_hoarder',  name: 'The Hoarder',  icon: '🐉', rarity: 'legendary', flavor: 'A dragon\'s envy of treasures.',    perk: { gemMult: 1.12, dmgMult: 1.04 } },
  { id: 'card_king',     name: 'The Wizard King', icon: '👑', rarity: 'legendary', flavor: 'Crowned by the Tipsy Toad.',     perk: { dmgMult: 1.08, manaBonus: 20 } },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

// pure: fold the perks of all owned cards into one descriptor (game may be null in tests).
export function applyCardPerks(game, ownedIds) {
  const acc = { gemMult: 1, dmgMult: 1, manaBonus: 0, mgScoreBonus: 0 };
  for (const id of ownedIds || []) {
    const c = CARD_BY_ID[id]; const p = c && c.perk; if (!p) continue;
    if (p.gemMult) acc.gemMult *= p.gemMult;
    if (p.dmgMult) acc.dmgMult *= p.dmgMult;
    if (p.manaBonus) acc.manaBonus += p.manaBonus;
    if (p.mgScoreBonus) acc.mgScoreBonus += p.mgScoreBonus;
  }
  if (game) game.cardPerks = acc;
  return acc;
}

// pure: a rarity-weighted draw from the cards NOT yet in `owned`. Returns a card id or
// null when the set is complete. rng injectable for deterministic tests.
export function rollCard(owned, rng = Math.random) {
  const have = new Set(owned || []);
  const pool = CARDS.filter(c => !have.has(c.id));
  if (!pool.length) return null;
  let total = 0; for (const c of pool) total += (CARD_RARITY[c.rarity].w || 1);
  let r = rng() * total;
  for (const c of pool) { r -= (CARD_RARITY[c.rarity].w || 1); if (r <= 0) return c.id; }
  return pool[0].id;
}
