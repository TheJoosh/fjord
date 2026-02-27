const targets = [
  { pack: 'Default Pack', count: 35 },
  { pack: 'Saga Pack', count: 27 },
  { pack: 'Heroic Pack', count: 21 },
  { pack: 'Mythbound Pack', count: 17 },
];

function rewardAt(cyclePosition) {
  const assigned = {
    'Default Pack': 0,
    'Saga Pack': 0,
    'Heroic Pack': 0,
    'Mythbound Pack': 0,
  };

  let selectedPack = 'Default Pack';

  for (let position = 1; position <= cyclePosition; position++) {
    let bestPack = null;
    let bestDeficit = Number.NEGATIVE_INFINITY;

    for (const target of targets) {
      if (assigned[target.pack] >= target.count) continue;
      const expectedByNow = (position * target.count) / 100;
      const deficit = expectedByNow - assigned[target.pack];

      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestPack = target.pack;
      }
    }

    if (!bestPack) break;

    assigned[bestPack] += 1;
    if (position === cyclePosition) selectedPack = bestPack;
  }

  return selectedPack;
}

const totals = {
  'Default Pack': 0,
  'Saga Pack': 0,
  'Heroic Pack': 0,
  'Mythbound Pack': 0,
};

for (let i = 1; i <= 100; i++) {
  const pack = rewardAt(i);
  totals[pack] += 1;
}

console.log(totals);
