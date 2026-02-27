const fs = require('fs');
const vm = require('vm');

function loadObject(path, startMarker, endMarker, replaceLine) {
  const text = fs.readFileSync(path, 'utf8');
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  const slice = text.slice(start, end).replace(startMarker, replaceLine);
  const ctx = {};
  vm.runInNewContext(`${slice}\nthis.__result = ${replaceLine.split('=')[0].replace('const','').trim()};`, ctx);
  return ctx.__result;
}

const cardsByRarity = loadObject('src/data/cards.js', 'export const cardsByRarity =', 'const CARDS_STORAGE_KEY', 'const cardsByRarity =');
const users = loadObject('src/data/users.js', 'export const users =', 'function getStoredUsersMap', 'const users =');

const rarityScores = { Common: 2, Uncommon: 4, Rare: 6, Loric: 8, Mythical: 10, Legendary: 12 };
const BASE_VALUE_SCALE = 0.0165;
const RARITY_SPREAD_EXPONENT = 1.16;

const packWeights = {
  Default:   { Common:47, Uncommon:28, Rare:14, Loric:7, Mythical:3, Legendary:1 },
  Saga:      { Common:32, Uncommon:30, Rare:23, Loric:7, Mythical:7, Legendary:1 },
  Heroic:    { Common:0,  Uncommon:35, Rare:30, Loric:18, Mythical:12, Legendary:5 },
  Mythbound: { Common:0,  Uncommon:0,  Rare:40, Loric:30, Mythical:20, Legendary:10 },
};

const rewardTargets = { Default: 35, Saga: 27, Heroic: 21, Mythbound: 17 };

const totals = {};
for (const user of Object.values(users || {})) {
  if (!user || typeof user !== 'object' || !user.cards) continue;
  for (const [name, qtyRaw] of Object.entries(user.cards)) {
    const qty = parseInt(qtyRaw, 10) || 0;
    totals[name] = (totals[name] || 0) + qty;
  }
}
const N = Object.values(totals).reduce((a,b)=>a+b,0);

const rarityAvgValue = {};
for (const [rarity, group] of Object.entries(cardsByRarity)) {
  const R = rarityScores[rarity] || 0;
  const rarityFactor = Math.pow(1 + (R * R) / 10, RARITY_SPREAD_EXPONENT);
  const vals = [];
  for (const name of Object.keys(group || {})) {
    const T = totals[name] || 0;
    const logTerm = Math.log(1 + N / (T + 3));
    vals.push(BASE_VALUE_SCALE * rarityFactor * Math.pow(logTerm, 1.5));
  }
  rarityAvgValue[rarity] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
}

function ev(weights, lookup) {
  const sumW = Object.values(weights).reduce((a,b)=>a+b,0);
  return 10 * Object.entries(weights).reduce((acc,[rarity,w]) => acc + (w/sumW) * (lookup[rarity] || 0), 0);
}

const packEV = {};
for (const [pack, w] of Object.entries(packWeights)) {
  packEV[pack] = ev(w, rarityAvgValue);
}

const rarityAvgScore = {};
for (const [rarity, score] of Object.entries(rarityScores)) rarityAvgScore[rarity] = score;
const packRarityStrength = {};
for (const [pack, w] of Object.entries(packWeights)) {
  packRarityStrength[pack] = ev(w, rarityAvgScore) / 10;
}

const totalRewards = Object.values(rewardTargets).reduce((a,b)=>a+b,0);
const rewardShare = Object.fromEntries(Object.entries(rewardTargets).map(([k,v])=>[k, v/totalRewards]));

console.log('Pack EV (current formulas):');
for (const [k,v] of Object.entries(packEV)) console.log(k, v.toFixed(3));

console.log('\nReward share vs EV share:');
const totalEV = Object.values(packEV).reduce((a,b)=>a+b,0);
for (const pack of Object.keys(packEV)) {
  const evShare = packEV[pack] / totalEV;
  console.log(pack, `reward=${(rewardShare[pack]*100).toFixed(1)}%`, `evShare=${(evShare*100).toFixed(1)}%`, `rarityAvg=${packRarityStrength[pack].toFixed(2)}`);
}

console.log('\nImplied reward count per unit EV (higher = more generous frequency):');
for (const pack of Object.keys(packEV)) {
  console.log(pack, (rewardTargets[pack] / packEV[pack]).toFixed(2));
}
