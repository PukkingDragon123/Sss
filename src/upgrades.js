// upgrades.js — ABILITIES (the boons picked on level-up, shown top-left) and the
// rare, very-OP ARTIFACTS granted at the end of a level (previewed on the path,
// Binding-of-Isaac style). Both apply(game) the same way; artifacts just hit harder.

export const UPGRADES = [
  // ----- general -----
  { id: 'maxhp',  name: 'Iron Liver',     icon: '❤️', tag: 'Vitality', weight: 10,
    desc: '+30 max HP, and patch up by 30 right now.',
    apply: g => { g.stats.hpMax += 30; g.wizard.hp += 30; } },
  { id: 'damage', name: 'Arcane Potency', icon: '🔥', tag: 'Power', weight: 10,
    desc: '+20% damage for every spell.',
    apply: g => { g.stats.damageMult += 0.20; } },
  { id: 'haste',  name: 'Happy Feet',     icon: '👟', tag: 'Mobility', weight: 9,
    desc: '+12% movement speed (still wobbly).',
    apply: g => { g.stats.moveSpeed *= 1.12; } },
  { id: 'mana',   name: 'Deep Flask',     icon: '🍺', tag: 'Mana', weight: 9,
    desc: '+30 max mana, and every gulp restores +18 more.',
    apply: g => { g.stats.manaMax += 30; g.wizard.mana += 30; g.stats.drinkPower += 18; } },
  { id: 'cdr',    name: 'Quick Fingers',  icon: '⏱️', tag: 'Tempo', weight: 8,
    desc: '-12% spell cooldowns.',
    apply: g => { g.stats.cooldownMult = Math.max(0.3, g.stats.cooldownMult * 0.88); } },

  // ----- fireball (always owned) -----
  { id: 'fireball', name: 'Bigger Boom',  icon: '💥', tag: 'Fireball', weight: 7,
    desc: '+35% Fireball blast radius, +15% Fireball damage.',
    apply: g => { g.stats.fireballRadius *= 1.35; g.stats.fireballDmg *= 1.15; } },
  // ----- gust (always owned) -----
  { id: 'gust',   name: 'Howling Gale',   icon: '🌀', tag: 'Gust', weight: 6,
    desc: '+40% Gust force & range, +60% Gust damage.',
    apply: g => { g.stats.gustForce *= 1.4; g.stats.gustRange *= 1.4; g.stats.gustDmg *= 1.6; } },
  // ----- gated behind their unlock -----
  { id: 'chain',  name: 'Forked Bolt',    icon: 'ϟ', tag: 'Lightning', weight: 7,
    desc: '+1 Lightning chain, +10% Lightning damage.',
    available: g => g.unlocked.has('lightning'),
    apply: g => { g.stats.lightningChains += 1; g.stats.lightningDmg *= 1.10; } },
  { id: 'frost',  name: 'Deep Freeze',    icon: '❄️', tag: 'Frost', weight: 7,
    desc: '+30% Frost radius, stronger & longer slow.',
    available: g => g.unlocked.has('frost'),
    apply: g => { g.stats.frostRadius *= 1.30; g.stats.frostSlow = Math.min(0.9, g.stats.frostSlow + 0.1); g.stats.frostSlowTime += 1; } },
  { id: 'healup', name: 'Holy Hangover',  icon: '✨', tag: 'Heal', weight: 6,
    desc: '+20 Heal potency, -20% Heal cooldown.',
    available: g => g.unlocked.has('heal'),
    apply: g => { g.stats.healAmount += 20; g.spells.adjustCd('heal', 0.8); } },
  { id: 'spikeup', name: 'Piercing Spikes', icon: '∧', tag: 'Spike', weight: 6,
    desc: '+30% Arcane Spike damage, -15% cooldown.',
    available: g => g.unlocked.has('spike'),
    apply: g => { g.stats.spikeDmg *= 1.3; g.spells.adjustCd('spike', 0.85); } },
  { id: 'novaup', name: 'Supernova', icon: '★', tag: 'Nova', weight: 6,
    desc: '+25% Fire Nova damage & +25% radius.',
    available: g => g.unlocked.has('nova'),
    apply: g => { g.stats.novaDmg *= 1.25; g.stats.novaRadius *= 1.25; } },

  // ----- more general -----
  { id: 'pickup', name: 'Mote Magnet',    icon: '🧲', tag: 'Utility', weight: 7,
    desc: '+70% XP pickup radius.',
    apply: g => { g.stats.pickupRadius *= 1.7; } },
  { id: 'regen',  name: 'Second Wind',    icon: '💚', tag: 'Vitality', weight: 6,
    desc: '+1.5 HP regenerated per second.',
    apply: g => { g.stats.hpRegen += 1.5; } },
  { id: 'sober',  name: 'Sip of Coffee',  icon: '☕', tag: 'Control', weight: 5,
    desc: 'Sober up a little — steadier aim & movement.',
    apply: g => { g.stats.wobble = Math.max(0.4, g.stats.wobble - 0.25); } },
  { id: 'drunk',  name: 'Liquid Courage', icon: '🍺', tag: 'Risk', weight: 4,
    desc: 'Way wonkier… but +25% damage. Embrace the chaos.',
    apply: g => { g.stats.wobble += 0.45; g.stats.damageMult += 0.25; } },
  { id: 'thorns', name: 'Prickly Aura',   icon: '🌵', tag: 'Defense', weight: 5,
    desc: 'Enemies take damage when they bonk you.',
    apply: g => { g.stats.thorns += 12; } },

  // ----- richer "build-defining" boons -----
  { id: 'bloodthirst', name: 'Bloodthirst', icon: '🩸', tag: 'Lifesteal', weight: 6,
    desc: 'Heal +4 HP for every foe you slay.',
    apply: g => { g.stats.lifeOnKill += 4; } },
  { id: 'tipsytally', name: 'Tipsy Tally',  icon: '🍻', tag: 'Mana', weight: 6,
    desc: '+6 mana per kill — fight your way to a refill.',
    apply: g => { g.stats.manaOnKill += 6; } },
  { id: 'reckless', name: 'Reckless Hex',  icon: '💢', tag: 'Risk', weight: 5,
    desc: '+45% damage, but −25 max HP. Live fast.',
    apply: g => { g.stats.damageMult += 0.45; g.stats.hpMax = Math.max(40, g.stats.hpMax - 25); g.wizard.hp = Math.min(g.wizard.hp, g.stats.hpMax); } },
  { id: 'angrydrunk', name: 'Drunken Fury', icon: '😤', tag: 'Risk', weight: 5,
    desc: 'The drunker you are, the harder you hit (up to +60%).',
    apply: g => { g.stats.angryDrunk = 1; } },
  { id: 'critup', name: 'Killer Instinct', icon: '🎯', tag: 'Power', weight: 6,
    desc: 'Perfect-glyph CRITs hit for ×2.6 instead of ×2.',
    apply: g => { g.stats.critMult = (g.stats.critMult || 2) + 0.6; } },
  { id: 'study', name: 'Quick Study',     icon: '📚', tag: 'Utility', weight: 6,
    desc: '+30% XP from every mote.',
    apply: g => { g.stats.xpMult = (g.stats.xpMult || 1) + 0.3; } },
  { id: 'hollowleg', name: 'Hollow Leg',  icon: '🦵', tag: 'Control', weight: 5,
    desc: 'Hold your drink: gulps make you 35% less woozy.',
    apply: g => { g.stats.drinkChaos = Math.max(0.3, (g.stats.drinkChaos || 1) - 0.35); } },
  { id: 'biggulp', name: 'Big Gulp',      icon: '🍺', tag: 'Mana', weight: 6,
    desc: '+35 max mana — a deeper draught to chug.',
    apply: g => { g.stats.manaMax += 35; g.wizard.mana += 35; } },

  // ----- beer types: change what a drink does (besides filling mana) -----
  { id: 'beer_lager', name: 'Hearty Lager',     icon: '🍺', tag: 'Brew', weight: 6,
    desc: 'Every chug also heals +35 HP.',
    apply: g => { g.stats.drinkHeal += 35; } },
  { id: 'beer_ale',   name: 'Frothy Ale',       icon: '🍻', tag: 'Brew', weight: 6,
    desc: 'Every chug grants a 55-point shield.',
    apply: g => { g.stats.drinkShield += 55; } },
  { id: 'beer_mead',  name: 'Honey Mead',       icon: '🍯', tag: 'Brew', weight: 5,
    desc: '+30 max mana, and chugging makes you 35% less woozy.',
    apply: g => { g.stats.manaMax += 30; g.wizard.mana += 30; g.stats.drinkChaos = Math.max(0.3, (g.stats.drinkChaos || 1) - 0.35); } },
  { id: 'beer_stout', name: 'Imperial Stout',   icon: '🖤', tag: 'Brew', weight: 5,
    desc: 'Every chug heals +20 HP and grants a 30-point shield.',
    apply: g => { g.stats.drinkHeal += 20; g.stats.drinkShield += 30; } },

  // ----- more boons -----
  { id: 'trollblood', name: 'Troll Blood',  icon: '🩸', tag: 'Vitality', weight: 7,
    desc: '+50 max HP, healed now, and +1 HP per second.',
    apply: g => { g.stats.hpMax += 50; g.wizard.hp += 50; g.stats.hpRegen += 1; } },
  { id: 'spellfury', name: 'Spellfury',     icon: '⚡', tag: 'Power', weight: 8,
    desc: '+25% damage for every spell.',
    apply: g => { g.stats.damageMult += 0.25; } },
  { id: 'nimble',    name: 'Nimble Casting', icon: '🎐', tag: 'Tempo', weight: 7,
    desc: '−12% spell cooldowns.',
    apply: g => { g.stats.cooldownMult = Math.max(0.3, g.stats.cooldownMult * 0.88); } },
  { id: 'quicksilver', name: 'Quicksilver', icon: '🪽', tag: 'Mobility', weight: 7,
    desc: '+16% movement speed.',
    apply: g => { g.stats.moveSpeed *= 1.16; } },
  { id: 'spikedhide', name: 'Spiked Hide',  icon: '🦔', tag: 'Defense', weight: 6,
    desc: '+20 thorns and +20 max HP.',
    apply: g => { g.stats.thorns += 20; g.stats.hpMax += 20; g.wizard.hp += 20; } },
  { id: 'sanguine',  name: 'Sanguine Pact', icon: '🧛', tag: 'Lifesteal', weight: 6,
    desc: '+5 HP and +4 mana for every foe you slay.',
    apply: g => { g.stats.lifeOnKill += 5; g.stats.manaOnKill += 4; } },
  { id: 'greed',     name: 'Greedy Eyes',   icon: '🤑', tag: 'Utility', weight: 6,
    desc: '+90% pickup radius and +25% XP.',
    apply: g => { g.stats.pickupRadius *= 1.9; g.stats.xpMult = (g.stats.xpMult || 1) + 0.25; } },
  { id: 'glasscannon', name: 'Glass Cannon', icon: '💥', tag: 'Risk', weight: 5,
    desc: '+55% damage, but −20 max HP. All-in.',
    apply: g => { g.stats.damageMult += 0.55; g.stats.hpMax = Math.max(40, g.stats.hpMax - 20); g.wizard.hp = Math.min(g.wizard.hp, g.stats.hpMax); } },

  // ----- synergy boons (reward leaning into a playstyle) -----
  { id: 'wildfire', name: 'Wildfire', icon: '🔥', tag: 'Fireball', weight: 5,
    desc: 'Fireball blasts +25% bigger & +12% damage; Fire Nova feeds the flames (+15%).',
    apply: g => { g.stats.fireballRadius *= 1.25; g.stats.fireballDmg *= 1.12; g.stats.novaDmg *= 1.15; } },
  { id: 'overload', name: 'Overload', icon: '⚡', tag: 'Lightning', weight: 5,
    available: g => g.unlocked.has('lightning'),
    desc: '+1 Lightning chain, and +6% Lightning damage for each chain you have.',
    apply: g => { g.stats.lightningChains += 1; g.stats.lightningDmg *= (1 + 0.06 * g.stats.lightningChains); } },
  { id: 'shatter', name: 'Shatter', icon: '🧊', tag: 'Frost', weight: 5,
    available: g => g.unlocked.has('frost'),
    desc: 'Deeper freeze, and +35% damage to anything you\'ve slowed.',
    apply: g => { g.stats.frostSlow = Math.min(0.9, g.stats.frostSlow + 0.1); g.stats.shatterDmg = (g.stats.shatterDmg || 0) + 0.35; } },
  { id: 'berserkbrew', name: 'Berserker Brew', icon: '🍺', tag: 'Risk', weight: 5,
    desc: 'Embrace the chaos: Drunken Fury, AND every gulp leaves you wonkier (harder hits).',
    apply: g => { g.stats.angryDrunk = 1; g.stats.drinkChaos = (g.stats.drinkChaos || 1) + 0.4; } },
  { id: 'executioner', name: 'Executioner', icon: '🎯', tag: 'Power', weight: 5,
    desc: '+0.5 crit damage, and crits restore 6 mana — perfect casting pays for itself.',
    apply: g => { g.stats.critMult = (g.stats.critMult || 2) + 0.5; g.stats.manaOnCrit = (g.stats.manaOnCrit || 0) + 6; } },
  { id: 'gluttonous', name: 'Gluttonous Aura', icon: '🩸', tag: 'Lifesteal', weight: 5,
    desc: '+4 HP per kill, and your thorns heal you for half the damage they deal.',
    apply: g => { g.stats.lifeOnKill += 4; g.stats.thornsLifesteal = (g.stats.thornsLifesteal || 0) + 0.5; } },
];
// abilities = the level-up boon pool (kept under the legacy name for the tests)
export const ABILITIES = UPGRADES;

// RPG rarity — derived from how common a boon is (its roll weight). Rarer boons hit harder & glow brighter.
export const UPGRADE_RARITY = [
  // bright hues tuned to read on the dark felt (Balatro-style) UI
  { key: 'common',    name: 'Common',    color: '#cfcad6', min: 9 },
  { key: 'rare',      name: 'Rare',      color: '#6fb0ff', min: 7 },
  { key: 'epic',      name: 'Epic',      color: '#b97bff', min: 5 },
  { key: 'legendary', name: 'Legendary', color: '#ffcf5c', min: 0 },
];
export function upgradeRarity(u) {
  if (!u) return UPGRADE_RARITY[0];
  if (u.unique) return UPGRADE_RARITY[3];   // artifacts are always legendary
  const w = u.weight || 5;
  for (const r of UPGRADE_RARITY) if (w >= r.min) return r;
  return UPGRADE_RARITY[0];
}

// Pick n distinct, currently-available abilities (weighted). Honours the player's
// curated deck (game._deckOff = a Set of ability ids removed from the pool).
// A boon is offerable if its spell is owned (available) AND it has been unlocked.
// Spell-tied boons self-reveal via available(); other boons need an explicit unlock.
// With no unlock set on `game` (e.g. the unit tests), nothing is restricted.
export function isUpgradeUnlocked(game, u) {
  if (u.available) return true;
  if (game && game._unlockedUpg) return game._unlockedUpg.has(u.id);
  return true;
}
export function rollUpgrades(game, n = 3) {
  const avail = UPGRADES.filter(u => (!u.available || u.available(game)) && isUpgradeUnlocked(game, u));
  const off = game && game._deckOff;
  let pool = off ? avail.filter(u => !off.has(u.id)) : avail;
  if (pool.length < n) pool = avail; // deck too thin → fall back to the full pool
  else pool = pool.slice();
  // a chosen playstyle (game._archetype) doubles the weight of its favoured tags.
  // With no archetype (e.g. the unit tests), wOf === u.weight, so behaviour is unchanged.
  const arch = game && game._archetype;
  const wOf = (u) => (arch && arch.favorTags && arch.favorTags.includes(u.tag)) ? u.weight * 2.2 : u.weight;
  const chosen = [];
  while (chosen.length < n && pool.length) {
    let total = 0;
    for (const u of pool) total += wOf(u);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) { r -= wOf(pool[i]); if (r <= 0) { idx = i; break; } }
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return chosen;
}
export const rollAbilities = rollUpgrades; // clearer alias

// ===== ARTIFACTS — rare, very-OP relics. Guaranteed at the end of a level
// (and from golden kegs / rune shrines). Each is build-defining; they don't repeat. =====
export const ARTIFACTS = [
  { id: 'a_tankard', name: 'The Bottomless Tankard', icon: '🍺', tag: '✦ Artifact',
    desc: 'Drinks restore +45 mana, +40 max mana, and leave you 50% less woozy. It never runs dry.',
    apply: g => { g.stats.drinkPower += 45; g.stats.manaMax += 40; g.wizard.mana += 40; g.stats.drinkChaos = Math.max(0.2, (g.stats.drinkChaos || 1) - 0.5); } },
  { id: 'a_eye', name: 'The All-Seeing Eye', icon: '👁️', tag: '✦ Artifact',
    desc: '+90% crit damage, +120% pickup radius, and +15% damage. Nothing escapes its gaze.',
    apply: g => { g.stats.critMult = (g.stats.critMult || 2) + 0.9; g.stats.pickupRadius *= 2.2; g.stats.damageMult += 0.15; } },
  { id: 'a_fang', name: 'Vampiric Fang', icon: '🦷', tag: '✦ Artifact',
    desc: '+11 HP per kill and +30% damage. Drink deep of the swarm.',
    apply: g => { g.stats.lifeOnKill += 11; g.stats.damageMult += 0.30; } },
  { id: 'a_chrono', name: 'The Cracked Hourglass', icon: '⏳', tag: '✦ Artifact',
    desc: '−40% spell cooldowns and +22% movement. Time bends, tipsily.',
    apply: g => { g.stats.cooldownMult = Math.max(0.18, g.stats.cooldownMult * 0.6); g.stats.moveSpeed *= 1.22; } },
  { id: 'a_cinder', name: 'Cinder Heart', icon: '🔥', tag: '✦ Artifact',
    desc: '+48% damage and +4 HP regenerated per second. A furnace for a soul.',
    apply: g => { g.stats.damageMult += 0.48; g.stats.hpRegen += 4; } },
  { id: 'a_reaper', name: "The Reaper's Tab", icon: '☠️', tag: '✦ Artifact',
    desc: '+120% damage… but −45 max HP. The debt always comes due.',
    apply: g => { g.stats.damageMult += 1.2; g.stats.hpMax = Math.max(35, g.stats.hpMax - 45); g.wizard.hp = Math.min(g.wizard.hp, g.stats.hpMax); } },
  { id: 'a_anchor', name: 'Iron Anchor', icon: '⚓', tag: '✦ Artifact',
    desc: '+80 max HP (healed now), a thorny aura, and +6 HP/sec. Steady the old fool.',
    apply: g => { g.stats.hpMax += 80; g.wizard.hp += 80; g.stats.thorns += 24; g.stats.hpRegen += 6; } },
  { id: 'a_luck', name: "Drunkard's Luck", icon: '🍀', tag: '✦ Artifact',
    desc: '+80% XP, +9 mana per kill, and +5 HP per kill. Fortune favours the sloshed.',
    apply: g => { g.stats.xpMult = (g.stats.xpMult || 1) + 0.8; g.stats.manaOnKill += 9; g.stats.lifeOnKill += 5; } },
  { id: 'a_storm', name: 'The Tempest Coil', icon: '🌩️', tag: '✦ Artifact',
    desc: '+50% damage, −25% cooldowns, and a +1 lightning chain. A walking storm.',
    apply: g => { g.stats.damageMult += 0.5; g.stats.cooldownMult = Math.max(0.18, g.stats.cooldownMult * 0.75); g.stats.lightningChains += 1; } },
  { id: 'a_phoenix', name: 'Phoenix Feather', icon: '🪶', tag: '✦ Artifact',
    desc: '+60 max HP (healed now), +8 HP/sec, and +8 HP per kill. Rise, and rise again.',
    apply: g => { g.stats.hpMax += 60; g.wizard.hp += 60; g.stats.hpRegen += 8; g.stats.lifeOnKill += 8; } },
  { id: 'a_gluttony', name: 'Glutton\'s Chalice', icon: '🍷', tag: '✦ Artifact',
    desc: 'The drunker you get, the harder you hit (up to +60%), +40 max mana, +35 per gulp.',
    apply: g => { g.stats.angryDrunk = 1; g.stats.manaMax += 40; g.wizard.mana += 40; g.stats.drinkPower += 35; } },
  { id: 'a_juggernaut', name: 'Juggernaut Plate', icon: '🛡️', tag: '✦ Artifact',
    desc: '+70 max HP (healed now), +30 thorns, and +20% damage. An unstoppable, sloshing tank.',
    apply: g => { g.stats.hpMax += 70; g.wizard.hp += 70; g.stats.thorns += 30; g.stats.damageMult += 0.2; } },
];
export const artifactById = (id) => ARTIFACTS.find(a => a.id === id);

// Pick ONE artifact not already claimed this run (game._artifactsTaken is a Set of ids).
export function rollArtifact(game) {
  const taken = (game && game._artifactsTaken) || new Set();
  const pool = ARTIFACTS.filter(a => !taken.has(a.id));
  const src = pool.length ? pool : ARTIFACTS;
  return src[Math.floor(Math.random() * src.length)];
}
export const rollArtifacts = (game, n = 3) => { // legacy alias: n distinct artifacts
  const taken = new Set((game && game._artifactsTaken) || []);
  const out = [];
  while (out.length < n) { const pool = ARTIFACTS.filter(a => !taken.has(a.id)); if (!pool.length) break; const a = pool[Math.floor(Math.random() * pool.length)]; out.push(a); taken.add(a.id); }
  return out;
};

// ===== PLAYSTYLES — pick one at the start of a run. Each biases your boon pool
// (favourite tags weigh ×2.2 in rollUpgrades), forces a signature starter spell,
// and grants a build-shaping passive. Pure data + a passive(g) like any apply(). =====
export const ARCHETYPES = [
  { id: 'pyromancer', name: 'Pyromancer', icon: '🔥', element: 'fire',
    desc: 'Born of cinders — fire hits harder. Boons favour Power & Fireball.',
    starter: 'fireball', favorTags: ['Fireball', 'Nova', 'Power', 'Risk'],
    passive: g => { g.stats.fireballDmg *= 1.15; g.stats.novaDmg *= 1.15; g.stats.damageMult += 0.10; } },
  { id: 'frostbinder', name: 'Frostbinder', icon: '❄️', element: 'water',
    desc: 'Freeze the swarm — slows bite deeper. Favours Frost, Heal & Defense.',
    starter: 'frost', favorTags: ['Frost', 'Heal', 'Defense', 'Vitality'],
    passive: g => { g.stats.frostSlow = Math.min(0.9, g.stats.frostSlow + 0.12); g.stats.frostSlowTime += 1; g.stats.hpMax += 20; g.wizard.hp += 20; } },
  { id: 'stormcaller', name: 'Stormcaller', icon: '⚡', element: 'air',
    desc: 'Chain death across the horde. Favours Lightning, Tempo & Mobility.',
    starter: 'lightning', favorTags: ['Lightning', 'Tempo', 'Mobility'],
    passive: g => { g.stats.lightningChains += 1; g.stats.cooldownMult = Math.max(0.3, g.stats.cooldownMult * 0.9); g.stats.moveSpeed *= 1.08; } },
  { id: 'brawler', name: 'Brawler', icon: '🍺', element: null,
    desc: 'The more you drink, the harder you swing. Favours Brew, Risk & Lifesteal.',
    starter: 'gust', favorTags: ['Brew', 'Risk', 'Lifesteal', 'Control'],
    passive: g => { g.stats.angryDrunk = 1; g.stats.lifeOnKill += 3; g.stats.drinkHeal += 20; } },
];
export const archetypeById = (id) => ARCHETYPES.find(a => a.id === id);
