export const cardsByRarity = {
    Placeholder: {
    "Placeholder": {
      image: "Placeholder.png",
      cardType: "Card",
      cost: "-",
      description: 
        "This is a placeholder card. Please replace it with your own design!",
      strength: "-",
      endurance: "-",
      value: 0,
      author: "Fjord",
    },
    },
    Legendary: {
    "Loki, God of Mischief": {
      image: "loki.png",
      cardType: "God",
      cost: 5,
      description:
        "Spell - each turn, this card assumes the strength and endurance of any other card in play",
      strength: "-",
      endurance: "-",
      value: 0,
      author: "Fjord",
    },
    "Thrym, Frost Giant King": {
      image: "frost-giant.png",
      cardType: "Chieftan",
      cost: 5,
      description: "Berserk - gains +2 strength while attacking",
      strength: 3,
      endurance: 5,
      value: 0,
      author: "Fjord",
    },
    "Odin, King of the Gods": {
      image: "mythologyart-odin-10069805_1280.png",
      cardType: "God",
      cost: 5,
      description: "Passive - +2 maximum fate while this card is in play",
      strength: 4,
      endurance: 5,
      value: 0,
      author: "Fjord",
    },
    "Thor, God of Thunder": {
      image: "thor.png",
      cardType: "God",
      cost: 5,
      description:
        "Passive - the strength of all enemy cards is reduced by 1 while this card is in play",
      strength: 5,
      endurance: 3,
      value: 0,
      author: "Fjord",
    },
  },
  Mythical: {
    "Níðhǫggr, Curse Striker": {
      image: "Níðhǫggr.png",
      cardType: "Beast",
      cost: 5,
      description:
        "Spell - each turn, one slain allied card can return to your hand",
      strength: 6,
      endurance: 4,
      value: 0,
      author: "Fjord",
    },
  },
  Loric: {
    "Ratatoskr, The Messenger": {
      image: "Ratatoskr.png",
      cardType: "Beast",
      cost: 4,
      description:
        "Passive - the endurance of all enemy cards is reduced by 1 while this card is in play",
      strength: 4,
      endurance: 3,
        value: 0,
        author: "Fjord",
    },
    "Erik the Red": {
      image: "Erik the Red.png",
      cardType: "Chieftan",
      cost: 3,
      description:
        "Command - can temporarily increase the strength of any two allied cards by 1 each turn",
      strength: 2,
      endurance: 2,
        value: 0,
        author: "Fjord",
    },
  },
  Rare: {
    "Ragnar Lothbrok": {
      image: "Ragnar.png",
      cardType: "Chieftan",
      cost: 3,
      description:
        "Passive - the endurance of all allied cards is increased by 1 while this card is in play",
      strength: 3,
      endurance: 4,
        value: 0,
        author: "Fjord",
    },
    "Valkyrie": {
      image: "Valkyrie2.png",
      cardType: "Warrior",
      cost: 3,
      description:
        "Flight - requires +2 strength to be blocked by a card without flight",
      strength: 4,
      endurance: 2,
        value: 0,
        author: "Fjord",
    },
    "Leif Erikson": {
      image: "Leif Erikson.png",
      cardType: "Chieftan",
      cost: 3,
      description:
        "Command - can temporarily increase the endurance of any two allied cards by 1 each turn",
      strength: 3,
      endurance: 3,
        value: 0,
        author: "Fjord",
    },
  },
  Uncommon: {
    "Shield Maiden": {
      image: "Shield Maiden.png",
      cardType: "Warrior",
      cost: 1,
      description: "Berserk - gains +1 strength while attacking",
      strength: 1,
      endurance: 2,
        value: 0,
        author: "Fjord",
    },
    "Bear Shaman": {
      image: "Bear Shaman.png",
      cardType: "Warrior",
      cost: 3,
      description: "Berserk - gains +2 strength while attacking",
      strength: 4,
      endurance: 2,
        value: 0,
        author: "Fjord",
    },
    "Dökkálfr": {
      image: "Dokkalfr.png",
      cardType: "Warrior",
      cost: 2,
      description:
        "Spell - cannot be blocked during its first turn attacking",
      strength: 3,
      endurance: 1,
        value: 0,
        author: "Fjord",
    },
    "Ljósálfr": {
      image: "Ljosalfr.png",
      cardType: "Warrior",
      cost: 2,
      description:
        "Spell - can raise its endurance to 5 once per game; resets on death",
      strength: 2,
      endurance: 2,
        value: 0,
        author: "Fjord",
    },
    "Dvergr": {
      image: "Dvergr.png",
      cardType: "Warrior",
      cost: 2,
      description:
        "Forge - permanently increases the strength of any one allied card by 1 when played",
      strength: 3,
      endurance: 1,
        value: 0,
        author: "Fjord",
    },
  },
  Common: {
    "Drengr": {
      image: "grunt.png",
      cardType: "Warrior",
      cost: 1,
      description: 
        "Swift - this card can attack on the same turn it enters play",
      strength: 2,
      endurance: 1,
        value: 0,
        author: "Fjord",
    },
  },
};

const CARDS_STORAGE_KEY = 'cardsByRarity';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function toPersistableCardsByRarity(source) {
  const result = {};

  for (const [rarity, group] of Object.entries(source || {})) {
    if (!group || typeof group !== 'object') continue;

    result[rarity] = {};
    for (const [name, card] of Object.entries(group)) {
      if (!card || typeof card !== 'object') continue;

      const persistableCard = { ...card };
      if (typeof persistableCard.image === 'string' && persistableCard.image.startsWith('data:')) {
        persistableCard.image = 'Default.png';
      }

      result[rarity][name] = persistableCard;
    }
  }

  return result;
}

function hydrateCardsByRarityFromStorage() {
  if (!canUseLocalStorage()) return;

  try {
    const raw = localStorage.getItem(CARDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(cardsByRarity)) {
          delete cardsByRarity[key];
        }
        Object.assign(cardsByRarity, parsed);
      }
    }
  } catch {
    // Ignore malformed localStorage data and continue with in-memory defaults.
  }

  try {
    const payload = toPersistableCardsByRarity(cardsByRarity);
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures on hydration.
  }
}

export function persistCardsByRarity() {
  if (!canUseLocalStorage()) return;

  const payload = toPersistableCardsByRarity(cardsByRarity);
  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(payload));
}

export function addCardToRarity(rarity, name, cardData) {
  if (!rarity || !name || !cardData) return false;

  if (!cardsByRarity[rarity] || typeof cardsByRarity[rarity] !== 'object') {
    cardsByRarity[rarity] = {};
  }

  cardsByRarity[rarity][name] = { ...cardData };
  persistCardsByRarity();
  return true;
}

hydrateCardsByRarityFromStorage();


export function getCardByName(name) {
  for (const rarity in cardsByRarity) {
    if (cardsByRarity[rarity][name]) {
      return { rarity, name, ...cardsByRarity[rarity][name] };
    }
  }
  return null;
}


export function recalcCardValues(usersObj) {
  
  const rarityScores = {
    Common: 2,
    Uncommon: 4,
    Rare: 6,
    Loric: 8,
    Mythical: 10,
    Legendary: 12,
  };

  
  const totals = {};
  for (const user of Object.values(usersObj || {})) {
    if (user.cards) {
      for (const [name, qty] of Object.entries(user.cards)) {
        totals[name] = (totals[name] || 0) + (parseInt(qty, 10) || 0);
      }
    }
  }

  
  const compute = (rarity, name) => {
    const R = rarityScores[rarity] || 0;
    const T = totals[name] || 0;
    if (T <= 0) return 0;
    return 0.05 * (1 + (R * R) / 10) * Math.sqrt(1000 / T);
  };

  for (const [rarity, group] of Object.entries(cardsByRarity)) {
    for (const [name, data] of Object.entries(group)) {
      if (typeof data !== 'object' || data === null) continue;
      data.value = compute(rarity, name);
    }
  }

  persistCardsByRarity();
  return cardsByRarity;
}


export function drawWeightedCards(
  quantity,
  commonWeight,
  uncommonWeight,
  rareWeight,
  loricWeight,
  mythicalWeight,
  legendaryWeight
) {
  const count = Math.max(0, parseInt(quantity, 10) || 0);

  const weightedRarities = [
    { rarity: 'Common', weight: Math.max(0, Number(commonWeight) || 0) },
    { rarity: 'Uncommon', weight: Math.max(0, Number(uncommonWeight) || 0) },
    { rarity: 'Rare', weight: Math.max(0, Number(rareWeight) || 0) },
    { rarity: 'Loric', weight: Math.max(0, Number(loricWeight) || 0) },
    { rarity: 'Mythical', weight: Math.max(0, Number(mythicalWeight) || 0) },
    { rarity: 'Legendary', weight: Math.max(0, Number(legendaryWeight) || 0) },
  ].filter(entry => {
    if (entry.weight <= 0) return false;
    const group = cardsByRarity[entry.rarity];
    return group && Object.keys(group).length > 0;
  });

  if (count === 0 || weightedRarities.length === 0) {
    return [];
  }

  const totalWeight = weightedRarities.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return [];
  }

  const chooseRarity = () => {
    let roll = Math.random() * totalWeight;
    for (const entry of weightedRarities) {
      roll -= entry.weight;
      if (roll < 0) {
        return entry.rarity;
      }
    }
    return weightedRarities[weightedRarities.length - 1].rarity;
  };

  const picks = [];
  for (let i = 0; i < count; i++) {
    const rarity = chooseRarity();
    const group = cardsByRarity[rarity] || {};
    const names = Object.keys(group);
    if (names.length === 0) continue;

    const randomName = names[Math.floor(Math.random() * names.length)];
    const cardData = group[randomName];
    picks.push({ rarity, name: randomName, ...cardData });
  }

  return picks;
}
