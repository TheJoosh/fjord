import { storageService } from '../services/storageService';

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
      population: 0,
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
      population: 0,
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
    "Fenris, Odin's Bane": {
      image: "Fenrir.png",
      cardType: "Beast",
      cost: 5,
      description:
        "Berserk - gains +2 strength while attacking",
      strength: 6,
      endurance: 4,
      value: 0,
      author: "Fjord",
    },
    "Hel, Goddess of Death": {
      image: "Hel.png",
      cardType: "God",
      cost: 5,
      description:
        "Spell - takes one slain allied card each turn and returns it to the deck",
      strength: 2,
      endurance: 6,
      value: 0,
      author: "Fjord",
    },
    "Eagle of the World Tree": {
      image: "Eagddrasil.png",
      cardType: "Beast",
      cost: 4,
      description:
        "Flight - requires +1 strength to be blocked by a card without flight",
      strength: 3,
      endurance: 4,
      value: 0,
      author: "Fjord",
    },
    "Jörmungandr": {
      image: "Jörmungandr.png",
      cardType: "Beast",
      cost: 5,
      description:
        "Spell - when played, all allied cards on the field die",
      strength: 8,
      endurance: 5,
      value: 0,
      author: "Fjord",
    },
    "Surtr, Fire Giant Lord": {
      image: "Surtr.png",
      cardType: "Chieftan",
      cost: 5,
      description:
        "Spell - when killed, the card that killed this card also dies",
      strength: 6,
      endurance: 4,
      value: 0,
      author: "Fjord",
    },
    "Freyja, Goddess of Love": {
      image: "Freyja.png",
      cardType: "God",
      cost: 5,
      description:
        "Passive - the endurance of all allied cards is increased by 5 while this card is in play", 
      strength: 2,
      endurance: 3,
        value: 0,
        author: "Fjord",
    },
    "Freyr, God of Prosperity": {
      image: "Freyr.png",
      cardType: "God",
      cost: 5,
      description:
        "Passive - the endurance of all enemy cards is reduced by 5 while this card is in play", 
      strength: 2,
      endurance: 3,
        value: 0,
        author: "Fjord",
    },
  },
  Mythical: {
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
    "Ymir, Primordial Giant": {
      image: "Ymir.png",
      cardType: "God",
      cost: 3,
      description:
        "Passive - +2 maximum fate while this card is in play",
      strength: 2,
      endurance: 3,
        value: 0,
        author: "Fjord",
    },
    "Sigurd, Dragon-Slayer": {
      image: "Sigurd.png",
      cardType: "Warrior",
      cost: 3,
      description:
        "Spell - all enemy beasts have -1 strength and -1 endurance against this card",
      strength: 3,
      endurance: 3,
        value: 0,
        author: "Fjord",
    },
    "Brynhildr, Shieldmaiden": {
      image: "Brynhildr.png",
      cardType: "Warrior",
      cost: 3,
      description:
        "Spell - Once per turn, if an allied Warrior is killed, it can be returned to the hand",
      strength: 2,
      endurance: 4,
        value: 0,
        author: "Fjord",
    },
  },
  Loric: {
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
    "Cnut the Great": {
      image: "Cnut.png",
      cardType: "Chieftan",
      cost: 2,
      description:
        "Command - can temporarily increase the strength of any three allied cards by 1 each turn",
      strength: 1,
      endurance: 2,
        value: 0,
        author: "Fjord",
    },
    "Skaði, Jötunn Huntress": {
      image: "Skaði.png",
      cardType: "God",
      cost: 3,
      description:
        "Spell - this card has +2 strength and +2 endurance against enemy beasts",
      strength: 2,
      endurance: 4,
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
    "Fire Jötunn": {
      image: "Fire Jötunn.png",
      cardType: "Warrior",
      cost: 3,
      description:
        "Spell - any enemy card that attacks or is attacked by this card permanently loses 1 endurance",
      strength: 4,
      endurance: 2,
        value: 0,
        author: "Fjord",
    },
    "Ice Jötunn": {
      image: "Ice Jötunn.png",
      cardType: "Warrior",
      cost: 3,
      description:
        "Spell - any enemy card that attacks or is attacked by this card permanently loses 1 strength",
      strength: 4,
      endurance: 2,
        value: 0,
        author: "Fjord",
    },
    "Einherji": {
      image: "Einherji.png",
      cardType: "Warrior",
      cost: 3,
      description:
        "Spell - if an allied warrior is killed after this card is killed, this card returns to the hand",
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
    "Corsair": {
      image: "Corsair.png",
      cardType: "Warrior",
      cost: 1,
      description: 
        "Swift - this card can attack on the same turn it enters play",
      strength: 2,
      endurance: 1,
        value: 0,
        author: "Fjord",
    },
    "Draugr": {
      image: "Draugr.png",
      cardType: "Warrior",
      cost: 1,
      description: 
        "Spell - when killed, this card returns to the deck",
      strength: 1,
      endurance: 1,
        value: 0,
        author: "Fjord",
    },
    "Stormborn": {
      image: "Stormborn.png",
      cardType: "Warrior",
      cost: 1,
      description: 
        "Swift - this card can attack on the same turn it enters play",
      strength: 2,
      endurance: 1,
        value: 0,
        author: "Fjord",
    },
    "Marauder": {
      image: "Marauder.png",
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
const PENDING_APPROVAL_STORAGE_KEY = 'pendingApproval';
export const pendingApproval = {};
let cardScarcityByName = {};

function recalcTotalPopulation() {
  let total = 0;
  for (const group of Object.values(cardsByRarity || {})) {
    if (!group || typeof group !== 'object') continue;
    for (const card of Object.values(group)) {
      if (!card || typeof card !== 'object') continue;
      total += normalizePopulationValue(card.population);
    }
  }

  cardsByRarity.totalPopulation = total;
  return total;
}

function normalizePopulationValue(value) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function ensurePopulationFields(source) {
  for (const group of Object.values(source || {})) {
    if (!group || typeof group !== 'object') continue;
    for (const card of Object.values(group)) {
      if (!card || typeof card !== 'object') continue;
      card.population = normalizePopulationValue(card.population);
    }
  }

  if (source === cardsByRarity) {
    recalcTotalPopulation();
  }
}

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
      persistableCard.population = normalizePopulationValue(persistableCard.population);

      result[rarity][name] = persistableCard;
    }
  }

  return result;
}

function toPersistablePendingApproval(source) {
  const result = {};

  for (const [name, card] of Object.entries(source || {})) {
    if (!card || typeof card !== 'object') continue;

    const persistableCard = { ...card };
    if (typeof persistableCard.image === 'string' && persistableCard.image.startsWith('data:')) {
      persistableCard.image = 'Default.png';
    }
    persistableCard.population = normalizePopulationValue(persistableCard.population);
    result[name] = persistableCard;
  }

  return result;
}

async function hydrateCardsByRarityFromStorage() {
  if (!canUseLocalStorage()) return;

  const defaultCardsByRarity = {};
  for (const [rarity, group] of Object.entries(cardsByRarity || {})) {
    defaultCardsByRarity[rarity] = { ...(group || {}) };
  }

  try {
    const parsed = await storageService.getJson(CARDS_STORAGE_KEY, null);
    if (parsed && typeof parsed === 'object') {
        const merged = {};

        for (const [rarity, group] of Object.entries(defaultCardsByRarity)) {
          merged[rarity] = { ...(group || {}) };
        }

        for (const [rarity, group] of Object.entries(parsed || {})) {
          if (!group || typeof group !== 'object') continue;
          if (!merged[rarity]) merged[rarity] = {};

          for (const [name, card] of Object.entries(group)) {
            if (!card || typeof card !== 'object') continue;
            merged[rarity][name] = card;
          }
        }

        for (const key of Object.keys(cardsByRarity)) {
          delete cardsByRarity[key];
        }
        Object.assign(cardsByRarity, merged);
    }
  } catch {
    // Ignore malformed localStorage data and continue with in-memory defaults.
  }

  ensurePopulationFields(cardsByRarity);

  try {
    const payload = toPersistableCardsByRarity(cardsByRarity);
    await storageService.setJson(CARDS_STORAGE_KEY, payload);
  } catch {
    // Ignore storage write failures on hydration.
  }
}

async function hydratePendingApprovalFromStorage() {
  if (!canUseLocalStorage()) return;

  let merged = {};

  try {
    const parsed = await storageService.getJson(PENDING_APPROVAL_STORAGE_KEY, null);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      merged = { ...parsed };
    }
  } catch {
    merged = {};
  }

  for (const key of Object.keys(pendingApproval)) {
    delete pendingApproval[key];
  }
  Object.assign(pendingApproval, merged);

  try {
    const payload = toPersistablePendingApproval(pendingApproval);
    await storageService.setJson(PENDING_APPROVAL_STORAGE_KEY, payload);
  } catch {
    // Ignore storage write failures on hydration.
  }
}

export function persistCardsByRarity() {
  if (!canUseLocalStorage()) return;

  const payload = toPersistableCardsByRarity(cardsByRarity);
  void storageService.setJson(CARDS_STORAGE_KEY, payload);
}

export function persistPendingApproval() {
  if (!canUseLocalStorage()) return;

  const payload = toPersistablePendingApproval(pendingApproval);
  void storageService.setJson(PENDING_APPROVAL_STORAGE_KEY, payload);
}

export function addCardToRarity(rarity, name, cardData) {
  if (!rarity || !name || !cardData) return false;

  if (!cardsByRarity[rarity] || typeof cardsByRarity[rarity] !== 'object') {
    cardsByRarity[rarity] = {};
  }

  cardsByRarity[rarity][name] = {
    ...cardData,
    population: normalizePopulationValue(cardData.population),
  };
  persistCardsByRarity();
  return true;
}

export function addCardToPendingApproval(name, cardData) {
  if (!name || !cardData) return false;

  pendingApproval[name] = {
    ...cardData,
    population: normalizePopulationValue(cardData.population),
  };
  persistPendingApproval();
  return true;
}

export function removeCardFromPendingApproval(name) {
  if (!name || !pendingApproval[name]) return false;

  delete pendingApproval[name];
  persistPendingApproval();
  return true;
}

export function updatePendingApprovalCard(previousName, nextName, cardData) {
  if (!previousName || !nextName || !cardData) return false;
  if (!pendingApproval[previousName]) return false;

  if (previousName !== nextName && pendingApproval[nextName]) {
    return false;
  }

  if (previousName !== nextName) {
    delete pendingApproval[previousName];
  }

  pendingApproval[nextName] = {
    ...cardData,
    population: normalizePopulationValue(cardData.population),
  };

  persistPendingApproval();
  return true;
}

function getKnownUserNames(usersObj) {
  const names = new Set(Object.keys(usersObj || {}));
  return Array.from(names);
}

export function syncCardPopulationsFromOwnedCards(usersObj) {
  ensurePopulationFields(cardsByRarity);

  const totals = {};
  const knownUsers = getKnownUserNames(usersObj);

  for (const userName of knownUsers) {
    let usedOwnedCardsStorage = false;

    if (!usedOwnedCardsStorage) {
      const fallbackUser = usersObj?.[userName];
      for (const [name, qty] of Object.entries(fallbackUser?.cards || {})) {
        totals[name] = (totals[name] || 0) + normalizePopulationValue(qty);
      }
    }
  }

  for (const group of Object.values(cardsByRarity)) {
    if (!group || typeof group !== 'object') continue;
    for (const card of Object.values(group)) {
      if (!card || typeof card !== 'object') continue;
      card.population = 0;
    }
  }

  for (const [rarity, group] of Object.entries(cardsByRarity)) {
    for (const [name, data] of Object.entries(group || {})) {
      if (!data || typeof data !== 'object') continue;
      cardsByRarity[rarity][name].population = normalizePopulationValue(totals[name]);
    }
  }

  recalcTotalPopulation();

  persistCardsByRarity();
  return cardsByRarity;
}

export function incrementCardPopulations(cards) {
  ensurePopulationFields(cardsByRarity);

  if (!Array.isArray(cards) || cards.length === 0) {
    return cardsByRarity;
  }

  for (const cardEntry of cards) {
    const cardName = typeof cardEntry === 'string' ? cardEntry : cardEntry?.name;
    if (!cardName) continue;

    for (const group of Object.values(cardsByRarity)) {
      if (!group || typeof group !== 'object') continue;
      if (!group[cardName]) continue;
      group[cardName].population = normalizePopulationValue(group[cardName].population) + 1;
      break;
    }
  }

  recalcTotalPopulation();

  persistCardsByRarity();
  return cardsByRarity;
}

void hydrateCardsByRarityFromStorage();
void hydratePendingApprovalFromStorage();


export function getCardByName(name) {
  for (const rarity in cardsByRarity) {
    if (cardsByRarity[rarity][name]) {
      return { rarity, name, ...cardsByRarity[rarity][name] };
    }
  }
  return null;
}

export function cardNameExists(name) {
  const normalizeCardName = (value) =>
    (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  const normalized = normalizeCardName(name);
  if (!normalized) return false;

  for (const group of Object.values(cardsByRarity || {})) {
    for (const existingName of Object.keys(group || {})) {
      if (normalizeCardName(existingName) === normalized) {
        return true;
      }
    }
  }

  for (const existingName of Object.keys(pendingApproval || {})) {
    if (normalizeCardName(existingName) === normalized) {
      return true;
    }
  }

  return false;
}


export function recalcCardValues() {
  
  const rarityScores = {
    Common: 2,
    Uncommon: 4,
    Rare: 6,
    Loric: 8,
    Mythical: 10,
    Legendary: 12,
  };

  const BASE_VALUE_SCALE = 0.0165;
  const RARITY_SPREAD_EXPONENT = 1.16;

  
  ensurePopulationFields(cardsByRarity);

  const totals = {};
  for (const group of Object.values(cardsByRarity || {})) {
    if (!group || typeof group !== 'object') continue;
    for (const [name, data] of Object.entries(group)) {
      if (!data || typeof data !== 'object') continue;
      const population = normalizePopulationValue(data.population);
      totals[name] = population;
    }
  }

  const totalPopulation = normalizePopulationValue(cardsByRarity.totalPopulation);

  
  const compute = (rarity, name) => {
    const R = rarityScores[rarity] || 0;
    const T = totals[name] || 0;
    const N = totalPopulation;
    const logTerm = Math.log(1 + N / (T + 3));
    const rarityFactor = Math.pow(1 + (R * R) / 10, RARITY_SPREAD_EXPONENT);
    return BASE_VALUE_SCALE * rarityFactor * Math.pow(logTerm, 1.5);
  };

  const nextScarcityByName = {};
  for (const [rarity, group] of Object.entries(cardsByRarity)) {
    for (const [name, data] of Object.entries(group)) {
      if (typeof data !== 'object' || data === null) continue;
      const T = totals[name] || 0;
      const N = totalPopulation;
      nextScarcityByName[name] = N / (T + 3);
    }
  }
  cardScarcityByName = nextScarcityByName;

  for (const [rarity, group] of Object.entries(cardsByRarity)) {
    for (const [name, data] of Object.entries(group)) {
      if (typeof data !== 'object' || data === null) continue;
      data.value = Number(compute(rarity, name).toFixed(2));
    }
  }

  persistCardsByRarity();
  return cardsByRarity;
}

export function getCardScarcityScore(name) {
  if (!name) return 0;
  return Number(cardScarcityByName[name]) || 0;
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
