// upgrades.js — the level-up boon pool (Vampire-Survivors style).
// Includes spell-UNLOCK cards (you start with only Fireball + Gust) and gates
// each spell's upgrades behind owning that spell.

export const UPGRADES = [
  // ----- spell unlocks (only offered while still locked) -----
  { id: 'unlock_lightning', name: 'Learn: Lightning', icon: 'ϟ', tag: 'New Spell', weight: 16,
    desc: 'Unlock Lightning (draw Z) — zaps and chains between foes.',
    available: g => !g.unlocked.has('lightning'),
    apply: g => g.unlock('lightning') },
  { id: 'unlock_frost', name: 'Learn: Frost Splash', icon: '◯', tag: 'New Spell', weight: 16,
    desc: 'Unlock Frost Splash (draw ◯) — an icy nova that slows. Also douses fires.',
    available: g => !g.unlocked.has('frost'),
    apply: g => g.unlock('frost') },
  { id: 'unlock_heal', name: 'Learn: Heal', icon: '∨', tag: 'New Spell', weight: 14,
    desc: 'Unlock Heal (draw V) — patch yourself up mid-fight.',
    available: g => !g.unlocked.has('heal'),
    apply: g => g.unlock('heal') },

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
  { id: 'mana',   name: 'Deep Flask',     icon: '🔷', tag: 'Mana', weight: 9,
    desc: '+25 max mana and +25% mana regen.',
    apply: g => { g.stats.manaMax += 25; g.wizard.mana += 25; g.stats.manaRegen *= 1.25; } },
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
];

// Pick n distinct upgrades that are currently available, weighted.
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
