const fs = require('fs');
const vm = require('vm');
function load(path, startMarker, endMarker, replaceLine) {
  const text = fs.readFileSync(path, 'utf8');
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  const slice = text.slice(start, end).replace(startMarker, replaceLine);
  const context = {};
  vm.runInNewContext(`${slice}\nthis.__result = ${replaceLine.split('=')[0].replace('const','').trim()};`, context);
  return context.__result;
}
const cardsByRarity = load('src/data/cards.js','export const cardsByRarity =','const CARDS_STORAGE_KEY','const cardsByRarity =');
const users = load('src/data/users.js','export const users =','function getStoredUsersMap','const users =');
const rarityScores = { Common: 2, Uncommon: 4, Rare: 6, Loric: 8, Mythical: 10, Legendary: 12 };
const packs = {
  default: { Common:47, Uncommon:28, Rare:14, Loric:7, Mythical:3, Legendary:1 },
  saga: { Common:30, Uncommon:29, Rare:22, Loric:11, Mythical:6, Legendary:2 },
  heroic: { Common:0, Uncommon:35, Rare:30, Loric:18, Mythical:12, Legendary:5 },
  mythbound: { Common:0, Uncommon:0, Rare:40, Loric:30, Mythical:20, Legendary:10 },
};
const gamma=1.16;
let totals={},N=0;
for (const user of Object.values(users)) {
  if (!user?.cards) continue;
  for (const [name, qtyRaw] of Object.entries(user.cards)) {
    const qty = parseInt(qtyRaw, 10) || 0;
    totals[name] = (totals[name] || 0) + qty;
    N += qty;
  }
}
const avgAtK1 = {};
for (const [rarity, group] of Object.entries(cardsByRarity)) {
  const R = rarityScores[rarity] || 0;
  const rarityFactor = Math.pow(1 + (R * R) / 10, gamma);
  let sum = 0;
  let count = 0;
  for (const name of Object.keys(group || {})) {
    const T = totals[name] || 0;
    const logTerm = Math.log(1 + N / (T + 3));
    sum += rarityFactor * Math.pow(logTerm, 1.5);
    count += 1;
  }
  avgAtK1[rarity] = count ? sum / count : 0;
}
const evAtK1 = (weights) => {
  const totalW = Object.values(weights).reduce((a,b)=>a+b,0);
  return 10 * Object.entries(weights).reduce((sum,[r,w]) => sum + (w/totalW)*(avgAtK1[r]||0),0);
};
const targetDefault = 3.5;
const k = targetDefault / evAtK1(packs.default);
const rarityAvg = Object.fromEntries(Object.entries(avgAtK1).map(([r,v]) => [r, v*k]));
const ev = Object.fromEntries(Object.entries(packs).map(([name,w]) => [name, evAtK1(w)*k]));
console.log('k', k.toFixed(6));
console.log('rarityAvg', Object.fromEntries(Object.entries(rarityAvg).map(([k,v])=>[k,Number(v.toFixed(3))])));
console.log('ev', Object.fromEntries(Object.entries(ev).map(([k,v])=>[k,Number(v.toFixed(3))])));
console.log('ratio L/C', (rarityAvg.Legendary/rarityAvg.Common).toFixed(3));
