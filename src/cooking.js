// cooking.js — the MONSTER-CUISINE heart of the game: every cookable beast drops an
// ingredient, ingredients combine into RECIPES for the restaurant's menu, and the 12
// ZODIAC signs form the wizard's arcane skill tree. PURE data + logic — imports
// nothing, touches no DOM/THREE, so the node test suite can drive it all.

// ---- ingredients: what the hunt brings home (id → display + rarity tier) ----
export const INGREDIENTS = {
  boarmeat:   { id: 'boarmeat',   name: 'Boar Haunch',     icon: '🥩', tier: 1, from: 'Tusker boars' },
  lizardtail: { id: 'lizardtail', name: 'Lizard Tail',     icon: '🦎', tier: 1, from: 'Saurian prowlers' },
  slimejelly: { id: 'slimejelly', name: 'Slime Jelly',     icon: '🟢', tier: 1, from: 'Wobbling slimes' },
  shroomcap:  { id: 'shroomcap',  name: 'Giant Shroomcap', icon: '🍄', tier: 1, from: 'Walking toadstools' },
  hydrawing:  { id: 'hydrawing',  name: 'Hydra-Bird Wing', icon: '🍗', tier: 2, from: 'Five-headed birds' },
  chamflank:  { id: 'chamflank',  name: 'Chameleon Flank', icon: '🌈', tier: 2, from: 'Shifting chameleons' },
  whaleblub:  { id: 'whaleblub',  name: 'Whale Blubber',   icon: '🐋', tier: 3, from: 'Mud whales' },
  batwing:    { id: 'batwing',    name: 'Bat Wing',        icon: '🦇', tier: 1, from: 'Cave bats' },
};
export const INGREDIENT_IDS = Object.keys(INGREDIENTS);

// ---- the menu: recipes learned & mastered BY DOING (cook-offs + dinner service) ----
// needs: {ingredientId: count} · price: base gold per plate · mastery multiplies it
export const RECIPES = [
  { id: 'alebread',   name: 'Ale & Black Bread',   icon: '🍞', needs: {},                              price: 6,  desc: 'The humble house staple — always on the menu.' },
  { id: 'boarchop',   name: 'Seared Boar Chop',    icon: '🥩', needs: { boarmeat: 1 },                 price: 14, desc: 'Crackling fat, pink centre, big flavour.' },
  { id: 'tailskewer', name: 'Lizard Tail Skewer',  icon: '🍢', needs: { lizardtail: 1 },               price: 12, desc: 'Charred over dragonfire, squeeze of lime.' },
  { id: 'jellyflan',  name: 'Slime Jelly Flan',    icon: '🍮', needs: { slimejelly: 2 },               price: 16, desc: 'It wobbles back at you. Dessert of champions.' },
  { id: 'shroomstew', name: 'Shroomcap Stew',      icon: '🍲', needs: { shroomcap: 2 },                price: 15, desc: 'Deep forest umami in a bubbling crock.' },
  { id: 'wingplatter',name: 'Hydra Wing Platter',  icon: '🍗', needs: { hydrawing: 2 },                price: 24, desc: 'Five heads, ten wings — extra napkins.' },
  { id: 'chamsteak',  name: 'Chameleon Rainbow Steak', icon: '🌈', needs: { chamflank: 1, shroomcap: 1 }, price: 28, desc: 'Changes colour as it sears. Diners gasp.' },
  { id: 'blubberpot', name: 'Whale Blubber Hotpot', icon: '🍲', needs: { whaleblub: 1, lizardtail: 1 }, price: 40, desc: 'Rich, glossy, outrageous. The house legend.' },
  { id: 'batsnack',   name: 'Crispy Bat Bites',    icon: '🦇', needs: { batwing: 2 },                  price: 10, desc: 'Like wings, but spookier.' },
];
export const RECIPE_BY_ID = {}; for (const r of RECIPES) RECIPE_BY_ID[r.id] = r;

// mastery: 0..5 stars — each star raises the plate price (learn by doing)
export const MASTERY_MAX = 5;
export const masteryMult = (lvl) => 1 + 0.18 * Math.min(MASTERY_MAX, Math.max(0, lvl | 0));
export const platePrice = (recipe, masteryLvl, quality = 1) =>
  Math.max(1, Math.round(recipe.price * masteryMult(masteryLvl) * quality));

// can this recipe be cooked from an inventory map {ingId: count}?
export const canCook = (recipe, inv) =>
  Object.entries(recipe.needs).every(([id, n]) => (inv[id] || 0) >= n);

// ---- the ZODIAC skill tree: 12 arcane signs, each a permanent passive boon ----
// Applied to run stats at arena entry (meta.applyZodiac). Costs escalate with tier.
export const ZODIAC = [
  { id: 'aries',       name: 'Aries',       icon: '♈', cost: 15, boon: 'dmg',       amt: 0.10, desc: '+10% spell damage' },
  { id: 'taurus',      name: 'Taurus',      icon: '♉', cost: 15, boon: 'hp',        amt: 25,   desc: '+25 max HP' },
  { id: 'gemini',      name: 'Gemini',      icon: '♊', cost: 20, boon: 'combo',     amt: 1.5,  desc: 'Kill-combo lasts longer' },
  { id: 'cancer',      name: 'Cancer',      icon: '♋', cost: 20, boon: 'shield',    amt: 20,   desc: 'Drinking grants a 20 HP shield' },
  { id: 'leo',         name: 'Leo',         icon: '♌', cost: 25, boon: 'critmult',  amt: 0.4,  desc: 'Perfect-glyph crits hit harder' },
  { id: 'virgo',       name: 'Virgo',       icon: '♍', cost: 25, boon: 'mana',      amt: 30,   desc: '+30 max mana' },
  { id: 'libra',       name: 'Libra',       icon: '♎', cost: 30, boon: 'speed',     amt: 0.9,  desc: '+move speed' },
  { id: 'scorpio',     name: 'Scorpio',     icon: '♏', cost: 30, boon: 'thorns',    amt: 4,    desc: 'Foes that touch you bleed' },
  { id: 'sagittarius', name: 'Sagittarius', icon: '♐', cost: 35, boon: 'cooldown',  amt: 0.88, desc: 'Spells recharge faster' },
  { id: 'capricorn',   name: 'Capricorn',   icon: '♑', cost: 35, boon: 'gold',      amt: 0.2,  desc: '+20% restaurant earnings' },
  { id: 'aquarius',    name: 'Aquarius',    icon: '♒', cost: 40, boon: 'manaregen', amt: 1.2,  desc: 'Mana trickles back over time' },
  { id: 'pisces',      name: 'Pisces',      icon: '♓', cost: 40, boon: 'hpregen',   amt: 0.8,  desc: 'Health slowly regenerates' },
];
export const ZODIAC_BY_ID = {}; for (const z of ZODIAC) ZODIAC_BY_ID[z.id] = z;

// fold a set of unlocked sign ids into a run-stats object (mutates + returns it)
export function applyZodiacTo(stats, unlockedIds) {
  for (const id of unlockedIds || []) {
    const z = ZODIAC_BY_ID[id]; if (!z) continue;
    if (z.boon === 'dmg') stats.damageMult = (stats.damageMult || 1) * (1 + z.amt);
    else if (z.boon === 'hp') stats.hpMax += z.amt;
    else if (z.boon === 'combo') stats.comboWindow = (stats.comboWindow || 0) + z.amt;
    else if (z.boon === 'shield') stats.drinkShield = (stats.drinkShield || 0) + z.amt;
    else if (z.boon === 'critmult') stats.critMult = (stats.critMult || 2) + z.amt;
    else if (z.boon === 'mana') stats.manaMax += z.amt;
    else if (z.boon === 'speed') stats.moveSpeed += z.amt;
    else if (z.boon === 'thorns') stats.thorns = (stats.thorns || 0) + z.amt;
    else if (z.boon === 'cooldown') stats.cooldownMult = (stats.cooldownMult || 1) * z.amt;
    else if (z.boon === 'gold') stats.goldMult = (stats.goldMult || 1) * (1 + z.amt);
    else if (z.boon === 'manaregen') stats.manaRegen = (stats.manaRegen || 0) + z.amt;
    else if (z.boon === 'hpregen') stats.hpRegen = (stats.hpRegen || 0) + z.amt;
  }
  return stats;
}
