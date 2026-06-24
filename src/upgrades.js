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
  { id: 'beer_lager', name: '🍺 Hearty Lager',  icon: '🍺', tag: 'Brew', weight: 6,
    desc: 'Every chug also heals +35 HP.',
    apply: g => { g.stats.drinkHeal += 35; } },
  { id: 'beer_ale',   name: '🍻 Frothy Ale',    icon: '🍻', tag: 'Brew', weight: 6,
    desc: 'Every chug grants a 55-point shield.',
    apply: g => { g.stats.drinkShield += 55; } },
  { id: 'beer_mead',  name: '🍯 Honey Mead',     icon: '🍯', tag: 'Brew', weight: 5,
    desc: '+30 max mana, and chugging makes you 35% less woozy.',
    apply: g => { g.stats.manaMax += 30; g.wizard.mana += 30; g.stats.drinkChaos = Math.max(0.3, (g.stats.drinkChaos || 1) - 0.35); } },
  { id: 'beer_stout', name: '🖤 Imperial Stout', icon: '🖤', tag: 'Brew', weight: 5,
    desc: 'Every chug heals +20 HP and grants a 30-point shield.',
    apply: g => { g.stats.drinkHeal += 20; g.stats.drinkShield += 30; } },
];
// abilities = the level-up boon pool (kept under the legacy name for the tests)
export const ABILITIES = UPGRADES;

// Pick n distinct, currently-available abilities (weighted).
export function rollUpgrades(game, n = 3) {
  const pool = UPGRADES.filter(u => !u.available || u.available(game));
  const chosen = [];
  while (chosen.length < n && pool.length) {
    let total = 0;
    for (const u of pool) total += u.weight;
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { idx = i; break; } }
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
  { id: 'a_anchor', name: 'Spirit Anchor', icon: '🧿', tag: '✦ Artifact',
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
