const fs = require('fs');
const vm = require('vm');

function loadObjectFromFile(path, startMarker, endMarker, replaceLine) {
  const text = fs.readFileSync(path, 'utf8');
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Unable to extract object from ${path}`);
  const slice = text.slice(start, end).replace(startMarker, replaceLine);
  const context = {};
  vm.runInNewContext(`${slice}\nthis.__result = ${replaceLine.split('=')[0].replace('const','').trim()};`, context);
  return context.__result;
}

const cardsByRarity = loadObjectFromFile(
  'src/data/cards.js',
  'export const cardsByRarity =',
  'const CARDS_STORAGE_KEY',
  'const cardsByRarity ='
);

const users = loadObjectFromFile(
  'src/data/users.js',
  'export const users =',
  'function getStoredUsersMap',
  'const users ='
);

const rarityScores = { Common: 2, Uncommon: 4, Rare: 6, Loric: 8, Mythical: 10, Legendary: 12 };
const packDefs = {
  default: { qty: 10, weights: { Common:47, Uncommon:28, Rare:14, Loric:7, Mythical:3, Legendary:1 }, zeros: [] },
  saga: { qty: 10, weights: { Common:30, Uncommon:29, Rare:22, Loric:11, Mythical:6, Legendary:2 }, zeros: [] },
  heroic: { qty: 10, weights: { Common:0, Uncommon:35, Rare:30, Loric:18, Mythical:12, Legendary:5 }, zeros: ['Common'] },
  mythbound: { qty: 10, weights: { Common:0, Uncommon:0, Rare:40, Loric:30, Mythical:20, Legendary:10 }, zeros: ['Common','Uncommon'] },
};

function getTotals() {
  const totals = {};
  let N = 0;
  for (const user of Object.values(users || {})) {
    if (!user || typeof user !== 'object' || !user.cards) continue;
    for (const [name, qtyRaw] of Object.entries(user.cards)) {
      const qty = parseInt(qtyRaw, 10) || 0;
      totals[name] = (totals[name] || 0) + qty;
      N += qty;
    }
  }
  return { totals, N };
}

function buildValues(gamma, k) {
  const { totals, N } = getTotals();
  const valuesByRarity = {};

  for (const [rarity, group] of Object.entries(cardsByRarity)) {
    const R = rarityScores[rarity] || 0;
    const rarityFactor = Math.pow(1 + (R * R) / 10, gamma);
    const vals = [];
    for (const name of Object.keys(group || {})) {
      const T = totals[name] || 0;
      const logTerm = Math.log(1 + N / (T + 3));
      const value = k * rarityFactor * Math.pow(logTerm, 1.5);
      vals.push(value);
    }
    valuesByRarity[rarity] = vals;
  }
  return valuesByRarity;
}

function rarityAverages(gamma, k) {
  const values = buildValues(gamma, k);
  const avg = {};
  for (const [rarity, arr] of Object.entries(values)) {
    avg[rarity] = arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  }
  return avg;
}

function packEV(weights, rarityAvg, qty=10) {
  const totalW = Object.values(weights).reduce((a,b)=>a+b,0);
  if (!totalW) return 0;
  let evPerCard = 0;
  for (const [r,w] of Object.entries(weights)) {
    evPerCard += (w/totalW) * (rarityAvg[r] || 0);
  }
  return evPerCard * qty;
}

function normalizeWeights(raw, zeroRarities=[]) {
  const rarities = ['Common','Uncommon','Rare','Loric','Mythical','Legendary'];
  const arr = rarities.map(r => zeroRarities.includes(r) ? 0 : Math.max(0, Math.round(raw[r] || 0)));
  let sum = arr.reduce((a,b)=>a+b,0);
  if (sum === 0) {
    for (let i=0;i<rarities.length;i++) if (!zeroRarities.includes(rarities[i])) arr[i]=1;
    sum = arr.reduce((a,b)=>a+b,0);
  }
  // force sum=100 for readability
  const target = 100;
  const scaled = arr.map(v => Math.max(0, Math.round(v * target / sum)));
  let s = scaled.reduce((a,b)=>a+b,0);
  const allowed = rarities.map((r,i)=>({r,i})).filter(({r})=>!zeroRarities.includes(r));
  while (s < target) { scaled[allowed[Math.floor(Math.random()*allowed.length)].i]++; s++; }
  while (s > target) {
    const cand = allowed.filter(({i})=>scaled[i]>0);
    if (!cand.length) break;
    scaled[cand[Math.floor(Math.random()*cand.length)].i]--; s--;
  }
  const out = {};
  rarities.forEach((r,i)=>out[r]=scaled[i]);
  return out;
}

const targets = { default: 3.5, saga: 4.5, heroic: 7.25, mythbound: 9.5 };

let best = null;
for (let gamma = 1.15; gamma <= 1.45; gamma += 0.01) {
  // set k so default stays at target with current default weights
  const avgAtK1 = rarityAverages(gamma, 1);
  const defaultAtK1 = packEV(packDefs.default.weights, avgAtK1);
  const k = targets.default / defaultAtK1;

  const rarityAvg = rarityAverages(gamma, k);

  // optimize only saga/heroic/mythbound weights near existing profile
  for (let iter=0; iter<30000; iter++) {
    const cand = {
      default: { ...packDefs.default.weights },
      saga: normalizeWeights({
        Common: 30 + (Math.random()*24-12),
        Uncommon: 29 + (Math.random()*22-11),
        Rare: 22 + (Math.random()*20-10),
        Loric: 11 + (Math.random()*14-7),
        Mythical: 6 + (Math.random()*10-5),
        Legendary: 2 + (Math.random()*8-4),
      }),
      heroic: normalizeWeights({
        Common: 0,
        Uncommon: 35 + (Math.random()*24-12),
        Rare: 30 + (Math.random()*20-10),
        Loric: 18 + (Math.random()*16-8),
        Mythical: 12 + (Math.random()*14-7),
        Legendary: 5 + (Math.random()*10-5),
      }, ['Common']),
      mythbound: normalizeWeights({
        Common: 0,
        Uncommon: 0,
        Rare: 40 + (Math.random()*24-12),
        Loric: 30 + (Math.random()*20-10),
        Mythical: 20 + (Math.random()*16-8),
        Legendary: 10 + (Math.random()*14-7),
      }, ['Common','Uncommon']),
    };

    const ev = {
      default: packEV(cand.default, rarityAvg),
      saga: packEV(cand.saga, rarityAvg),
      heroic: packEV(cand.heroic, rarityAvg),
      mythbound: packEV(cand.mythbound, rarityAvg),
    };

    const sse = Object.keys(targets).reduce((sum, key) => sum + Math.pow(ev[key]-targets[key],2), 0);

    if (!best || sse < best.sse) {
      best = { gamma, k, rarityAvg, weights: cand, ev, sse };
    }
  }
}

function fmt(n){ return Number(n).toFixed(4); }
console.log('BEST');
console.log('gamma', fmt(best.gamma), 'k', fmt(best.k), 'sse', fmt(best.sse));
console.log('rarityAvg', Object.fromEntries(Object.entries(best.rarityAvg).map(([k,v])=>[k,Number(v.toFixed(3))])));
console.log('ev', Object.fromEntries(Object.entries(best.ev).map(([k,v])=>[k,Number(v.toFixed(3))])));
console.log('weights', best.weights);

// also print spread ratios
const c = best.rarityAvg.Common;
const l = best.rarityAvg.Legendary;
console.log('Legendary/Common ratio', (l/c).toFixed(3));
