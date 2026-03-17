const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');

const DEFAULT_DB_NAME = 'Fjord';
const GLOBAL_BANK_INVENTORY_ID = 'global';
const STATE_CARDS_META_ID = '__meta__';
const CARDS_ROOT_DOC_ID = process.env.CARDS_ROOT_DOC_ID || '69b045d736b3687c61767638';

const RARITY_SCORES = {
  Common: 2,
  Uncommon: 4,
  Rare: 6,
  Loric: 8,
  Mythical: 10,
  Legendary: 12,
};

const BASE_VALUE_SCALE = 0.0165;
const RARITY_SPREAD_EXPONENT = 1.16;

let clientPromise;

function readDbConfigFromFile() {
  try {
    const configPath = path.join(__dirname, '..', 'DBConfig.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const config = readDbConfigFromFile();
  const host = config?.hostname;
  const userName = config?.userName;
  const password = config?.password;

  if (!host || !userName || !password) {
    throw new Error('Missing MongoDB configuration. Set MONGODB_URI or provide DBConfig.json.');
  }

  return `mongodb+srv://${encodeURIComponent(userName)}:${encodeURIComponent(password)}@${host}/?retryWrites=true&w=majority&appName=fjord`;
}

function getClient() {
  if (!clientPromise) {
    const uri = buildMongoUri();
    const client = new MongoClient(uri);
    clientPromise = client.connect().then(() => client);
  }

  return clientPromise;
}

async function getDb() {
  const client = await getClient();
  const dbName = process.env.MONGODB_DB || DEFAULT_DB_NAME;
  return client.db(dbName);
}

function normalizeQty(value) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function normalizeWalletValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
}

function normalizeCardMap(cards) {
  const result = {};
  for (const [name, qty] of Object.entries(cards || {})) {
    const normalized = normalizeQty(qty);
    if (normalized > 0) {
      result[name] = normalized;
    }
  }
  return result;
}

function normalizePacksMap(packs) {
  const source = packs && typeof packs === 'object' ? packs : {};
  return {
    'Default Pack': normalizeQty(source['Default Pack']),
    'Saga Pack': normalizeQty(source['Saga Pack']),
    'Heroic Pack': normalizeQty(source['Heroic Pack']),
    'Mythbound Pack': normalizeQty(source['Mythbound Pack']),
  };
}

function normalizeDeckSort(value) {
  const next = String(value || 'Rarity');
  if (next === 'Value' || next === 'Name' || next === 'Rarity') {
    return next;
  }
  return 'Rarity';
}

function normalizeRarity(value) {
  const rarity = String(value || '').trim();
  if (Object.prototype.hasOwnProperty.call(RARITY_SCORES, rarity)) {
    return rarity;
  }
  return 'Common';
}

function computeCardValue(rarity, totalOwned, totalPopulation) {
  const R = RARITY_SCORES[normalizeRarity(rarity)] || 0;
  const T = normalizeQty(totalOwned);
  const N = normalizeQty(totalPopulation);
  const logTerm = Math.log(1 + N / (T + 3));
  const rarityFactor = Math.pow(1 + (R * R) / 10, RARITY_SPREAD_EXPONENT);
  const raw = BASE_VALUE_SCALE * rarityFactor * Math.pow(logTerm, 1.5);
  return Number(raw.toFixed(2));
}

async function initPersistence() {
  const db = await getDb();

  await Promise.all([
    db.collection('users_auth').createIndex({ username: 1 }, { unique: true }),
    db.collection('users_auth').createIndex({ token: 1 }),
  ]);
}

async function createUser(username, passwordHash) {
  const db = await getDb();
  const users = db.collection('users_auth');
  const doc = { username, password: passwordHash, token: null, admin: false };
  await users.insertOne(doc);
  return doc;
}

async function getUserByField(field, value) {
  if (!value) return null;
  if (field !== 'username' && field !== 'token') return null;

  const db = await getDb();
  return db.collection('users_auth').findOne({ [field]: value });
}

async function ensureUserAdmin(username, fallbackAdmin = false) {
  if (!username) return false;

  const db = await getDb();
  const users = db.collection('users_auth');
  const normalizedFallback = Boolean(fallbackAdmin);

  await users.updateOne(
    { username },
    { $setOnInsert: { admin: normalizedFallback } },
    { upsert: true }
  );

  const doc = await users.findOne({ username });
  const admin = Boolean(doc?.admin);
  await users.updateOne({ username }, { $set: { admin } });
  return admin;
}

async function setUserToken(username, token) {
  if (!username) return;
  const db = await getDb();
  await db.collection('users_auth').updateOne({ username }, { $set: { token: token || null } });
}

async function clearUserToken(username) {
  if (!username) return;
  const db = await getDb();
  await db.collection('users_auth').updateOne({ username }, { $set: { token: null } });
}

async function ensureTradeProfile(userName, fallbackCards) {
  if (!userName) {
    return { cards: {} };
  }

  const db = await getDb();
  const collection = db.collection('trade_profiles');
  const fallback = normalizeCardMap(fallbackCards || {});

  await collection.updateOne(
    { _id: userName },
    { $setOnInsert: { cards: fallback } },
    { upsert: true }
  );

  const profile = await collection.findOne({ _id: userName });
  const cards = normalizeCardMap(profile?.cards || {});

  if (JSON.stringify(cards) !== JSON.stringify(profile?.cards || {})) {
    await collection.updateOne({ _id: userName }, { $set: { cards } });
  }

  return { cards };
}

async function setTradeProfileCards(userName, cards) {
  if (!userName) return;

  const db = await getDb();
  const collection = db.collection('trade_profiles');
  await collection.updateOne(
    { _id: userName },
    { $set: { cards: normalizeCardMap(cards || {}) } },
    { upsert: true }
  );
}

async function listTradeProfileNames() {
  const db = await getDb();
  const docs = await db
    .collection('trade_profiles')
    .find({}, { projection: { _id: 1 } })
    .toArray();
  return docs.map((doc) => doc._id).filter(Boolean);
}

async function getPendingTrade(userName) {
  if (!userName) return null;
  const db = await getDb();
  return db.collection('pending_trades').findOne({ _id: userName });
}

async function setPendingTrade(userName, pendingTrade) {
  if (!userName) return;
  const db = await getDb();
  await db.collection('pending_trades').updateOne(
    { _id: userName },
    {
      $set: {
        otherUserName: pendingTrade?.otherUserName || '',
        otherUserLabel: pendingTrade?.otherUserLabel || pendingTrade?.otherUserName || '',
        otherTradeCards: Array.isArray(pendingTrade?.otherTradeCards) ? pendingTrade.otherTradeCards : [],
      },
    },
    { upsert: true }
  );
}

async function deletePendingTrade(userName) {
  if (!userName) return;
  const db = await getDb();
  await db.collection('pending_trades').deleteOne({ _id: userName });
}

async function getSelectedTradeCards(userName) {
  if (!userName) return [];
  const db = await getDb();
  const doc = await db.collection('selected_trade_cards').findOne({ _id: userName });
  return Array.isArray(doc?.cards) ? doc.cards : [];
}

async function setSelectedTradeCards(userName, cards) {
  if (!userName) return;
  const db = await getDb();
  await db.collection('selected_trade_cards').updateOne(
    { _id: userName },
    { $set: { cards: Array.isArray(cards) ? cards : [] } },
    { upsert: true }
  );
}

async function getBankInventory() {
  const db = await getDb();
  const doc = await db.collection('bank_inventory').findOne({ _id: GLOBAL_BANK_INVENTORY_ID });
  return normalizeCardMap(doc?.cards || {});
}

async function setBankInventory(cards) {
  const db = await getDb();
  await db.collection('bank_inventory').updateOne(
    { _id: GLOBAL_BANK_INVENTORY_ID },
    { $set: { cards: normalizeCardMap(cards || {}) } },
    { upsert: true }
  );
}

async function ensureBankWallet(userName, fallbackWallet) {
  if (!userName) return 0;

  const db = await getDb();
  const wallets = db.collection('bank_wallets');

  await wallets.updateOne(
    { _id: userName },
    { $setOnInsert: { wallet: normalizeWalletValue(fallbackWallet) } },
    { upsert: true }
  );

  const doc = await wallets.findOne({ _id: userName });
  const wallet = normalizeWalletValue(doc?.wallet);
  await wallets.updateOne({ _id: userName }, { $set: { wallet } });
  return wallet;
}

async function setBankWallet(userName, wallet) {
  if (!userName) return;
  const db = await getDb();
  await db.collection('bank_wallets').updateOne(
    { _id: userName },
    { $set: { wallet: normalizeWalletValue(wallet) } },
    { upsert: true }
  );
}

async function ensureUserPacks(userName, fallbackPacks) {
  if (!userName) return normalizePacksMap({});

  const db = await getDb();
  const packsCollection = db.collection('user_packs');
  const fallback = normalizePacksMap(fallbackPacks || {});

  await packsCollection.updateOne(
    { _id: userName },
    { $setOnInsert: { packs: fallback } },
    { upsert: true }
  );

  const doc = await packsCollection.findOne({ _id: userName });
  const packs = normalizePacksMap(doc?.packs || {});
  await packsCollection.updateOne({ _id: userName }, { $set: { packs } });

  return packs;
}

async function setUserPacks(userName, packs) {
  if (!userName) return;
  const db = await getDb();
  await db.collection('user_packs').updateOne(
    { _id: userName },
    { $set: { packs: normalizePacksMap(packs || {}) } },
    { upsert: true }
  );
}

async function ensureDesignedCount(userName, fallbackDesigned) {
  if (!userName) return 0;

  const db = await getDb();
  const designed = db.collection('designed_counts');
  const fallback = normalizeQty(fallbackDesigned);

  await designed.updateOne(
    { _id: userName },
    { $setOnInsert: { count: fallback } },
    { upsert: true }
  );

  const doc = await designed.findOne({ _id: userName });
  const count = normalizeQty(doc?.count);
  await designed.updateOne({ _id: userName }, { $set: { count } });

  return count;
}

async function setDesignedCount(userName, count) {
  if (!userName) return;
  const db = await getDb();
  await db.collection('designed_counts').updateOne(
    { _id: userName },
    { $set: { count: normalizeQty(count) } },
    { upsert: true }
  );
}

async function listPendingApprovals() {
  const db = await getDb();
  return db
    .collection('pending_approvals')
    .find({}, { projection: { _id: 1, card: 1 } })
    .sort({ _id: 1 })
    .toArray();
}

async function getPendingApproval(name) {
  if (!name) return null;
  const db = await getDb();
  return db.collection('pending_approvals').findOne({ _id: name });
}

async function setPendingApproval(name, card) {
  if (!name || !card) return;
  const db = await getDb();
  await db.collection('pending_approvals').updateOne(
    { _id: name },
    { $set: { card: { ...card } } },
    { upsert: true }
  );
}

async function deletePendingApproval(name) {
  if (!name) return;
  const db = await getDb();
  await db.collection('pending_approvals').deleteOne({ _id: name });
}

async function renamePendingApproval(originalName, nextName, card) {
  if (!originalName || !nextName || !card) return;

  if (originalName === nextName) {
    await setPendingApproval(nextName, card);
    return;
  }

  const db = await getDb();
  const collection = db.collection('pending_approvals');
  await collection.deleteOne({ _id: originalName });
  await collection.updateOne({ _id: nextName }, { $set: { card: { ...card } } }, { upsert: true });
}

async function ensureDeckSortPreference(userName, fallbackSort) {
  if (!userName) return normalizeDeckSort(fallbackSort);

  const db = await getDb();
  const prefs = db.collection('deck_preferences');
  const fallback = normalizeDeckSort(fallbackSort);

  await prefs.updateOne(
    { _id: userName },
    { $setOnInsert: { sortBy: fallback } },
    { upsert: true }
  );

  const doc = await prefs.findOne({ _id: userName });
  const sortBy = normalizeDeckSort(doc?.sortBy);
  await prefs.updateOne({ _id: userName }, { $set: { sortBy } });

  return sortBy;
}

async function setDeckSortPreference(userName, sortBy) {
  if (!userName) return;
  const db = await getDb();
  await db.collection('deck_preferences').updateOne(
    { _id: userName },
    { $set: { sortBy: normalizeDeckSort(sortBy) } },
    { upsert: true }
  );
}

async function upsertCardCatalogEntries(entries) {
  const normalizedEntries = Array.isArray(entries)
    ? entries
        .map((entry) => ({
          name: String(entry?.name || '').trim(),
          rarity: normalizeRarity(entry?.rarity),
        }))
        .filter((entry) => entry.name)
    : [];

  if (!normalizedEntries.length) return;

  const db = await getDb();
  const catalog = db.collection('card_catalog');

  const operations = normalizedEntries.map((entry) => ({
    updateOne: {
      filter: { _id: entry.name },
      update: { $set: { rarity: entry.rarity } },
      upsert: true,
    },
  }));

  await catalog.bulkWrite(operations, { ordered: false });
}

async function getCardValuesMap() {
  const db = await getDb();
  const docs = await db
    .collection('state_cards')
    .find({}, { projection: { _id: 1, value: 1, rarity: 1, population: 1, scarcity: 1, totalPopulation: 1 } })
    .toArray();

  const map = {};
  let totalPopulation = 0;
  for (const doc of docs) {
    if (!doc?._id) continue;
    if (doc._id === STATE_CARDS_META_ID) {
      totalPopulation = normalizeQty(doc.totalPopulation);
      continue;
    }

    map[doc._id] = {
      value: Number.isFinite(Number(doc.value)) ? Number(doc.value) : 0,
      rarity: normalizeRarity(doc.rarity),
      population: normalizeQty(doc.population),
      scarcity: Number.isFinite(Number(doc.scarcity)) ? Number(doc.scarcity) : 0,
    };
  }

  return {
    valuesByName: map,
    totalPopulation,
  };
}

async function getCardsPoolByRarity() {
  const db = await getDb();
  const cardsCollection = db.collection('cards');

  let cardsRootFilter;
  try {
    cardsRootFilter = { _id: new ObjectId(CARDS_ROOT_DOC_ID) };
  } catch {
    cardsRootFilter = { _id: CARDS_ROOT_DOC_ID };
  }

  const cardsRootDoc = await cardsCollection.findOne(cardsRootFilter, {
    projection: {
      Common: 1,
      Uncommon: 1,
      Rare: 1,
      Loric: 1,
      Mythical: 1,
      Legendary: 1,
    },
  });

  const pool = {
    Common: [],
    Uncommon: [],
    Rare: [],
    Loric: [],
    Mythical: [],
    Legendary: [],
  };

  if (!cardsRootDoc) {
    return pool;
  }

  for (const rarity of Object.keys(pool)) {
    const bucket = cardsRootDoc[rarity];
    if (!bucket || typeof bucket !== 'object') continue;

    pool[rarity] = Object.entries(bucket)
      .filter(([name, card]) => {
        if (!name || name === 'totalPopulation') return false;
        return card && typeof card === 'object';
      })
      .map(([name]) => name);
  }

  return pool;
}

async function upsertApprovedCardToCards(name, card) {
  const cardName = String(name || '').trim();
  if (!cardName || !card || typeof card !== 'object') return;

  const rarity = normalizeRarity(card.rarity);
  const safeName = cardName.replace(/\./g, '\uFF0E').replace(/\$/g, '\uFF04');

  const db = await getDb();
  const cardsCollection = db.collection('cards');

  let cardsRootFilter;
  try {
    cardsRootFilter = { _id: new ObjectId(CARDS_ROOT_DOC_ID) };
  } catch {
    cardsRootFilter = { _id: CARDS_ROOT_DOC_ID };
  }

  const projection = {
    [`${rarity}.${safeName}.population`]: 1,
  };
  const existing = await cardsCollection.findOne(cardsRootFilter, { projection });
  const currentPopulation = normalizeQty(existing?.[rarity]?.[safeName]?.population);

  const cardDoc = {
    image: card.image || 'Default.png',
    cost: card.cost != null ? card.cost : '-',
    rarity,
    cardType: card.cardType || 'Type',
    description: card.description || '',
    strength: card.strength != null ? card.strength : '-',
    endurance: card.endurance != null ? card.endurance : '-',
    author: card.author || 'Unknown',
    value: Number.isFinite(Number(card.value)) ? Number(card.value) : 0,
    population: currentPopulation,
  };

  const unset = {};
  for (const bucket of Object.keys(RARITY_SCORES)) {
    if (bucket === rarity) continue;
    unset[`${bucket}.${safeName}`] = '';
  }

  await cardsCollection.updateOne(
    cardsRootFilter,
    {
      $set: {
        [`${rarity}.${safeName}`]: cardDoc,
        updatedAt: new Date(),
      },
      $unset: unset,
    },
    { upsert: true }
  );
}

async function getCardDetailsByNames(cardNames) {
  const names = Array.isArray(cardNames)
    ? Array.from(new Set(cardNames.map((name) => String(name || '').trim()).filter(Boolean)))
    : [];

  if (names.length === 0) return {};

  const db = await getDb();
  const cardsCollection = db.collection('cards');

  let cardsRootFilter;
  try {
    cardsRootFilter = { _id: new ObjectId(CARDS_ROOT_DOC_ID) };
  } catch {
    cardsRootFilter = { _id: CARDS_ROOT_DOC_ID };
  }

  const cardsRootDoc = await cardsCollection.findOne(cardsRootFilter, {
    projection: {
      Common: 1,
      Uncommon: 1,
      Rare: 1,
      Loric: 1,
      Mythical: 1,
      Legendary: 1,
    },
  });

  const byName = {};
  if (!cardsRootDoc) return byName;

  for (const name of names) {
    const safeName = name.replace(/\./g, '\uFF0E').replace(/\$/g, '\uFF04');

    for (const rarity of Object.keys(RARITY_SCORES)) {
      const bucket = cardsRootDoc[rarity];
      if (!bucket || typeof bucket !== 'object') continue;

      const card = bucket[name] || bucket[safeName];
      if (!card || typeof card !== 'object') continue;

      byName[name] = {
        name,
        image: card.image || 'Default.png',
        cost: card.cost != null ? card.cost : '-',
        rarity: normalizeRarity(card.rarity || rarity),
        cardType: card.cardType || 'Type',
        description: card.description || '',
        strength: card.strength != null ? card.strength : '-',
        endurance: card.endurance != null ? card.endurance : '-',
        author: card.author || 'Unknown',
        value: Number.isFinite(Number(card.value)) ? Number(card.value) : 0,
        population: normalizeQty(card.population),
      };
      break;
    }
  }

  return byName;
}

async function recalculateAndStoreCardValues() {
  const db = await getDb();

  let cardsRootFilter;
  try {
    cardsRootFilter = { _id: new ObjectId(CARDS_ROOT_DOC_ID) };
  } catch {
    cardsRootFilter = { _id: CARDS_ROOT_DOC_ID };
  }

  const [tradeProfiles, catalogDocs, stateDocs, cardsRootDoc] = await Promise.all([
    db
      .collection('trade_profiles')
      .find({}, { projection: { cards: 1 } })
      .toArray(),
    db
      .collection('card_catalog')
      .find({}, { projection: { _id: 1, rarity: 1 } })
      .toArray(),
    db
      .collection('state_cards')
      .find({}, { projection: { _id: 1, rarity: 1 } })
      .toArray(),
    db
      .collection('cards')
      .findOne(cardsRootFilter, {
        projection: {
          Common: 1,
          Uncommon: 1,
          Rare: 1,
          Loric: 1,
          Mythical: 1,
          Legendary: 1,
        },
      }),
  ]);

  const ownedTotalsByName = {};
  for (const profile of tradeProfiles) {
    for (const [name, qty] of Object.entries(profile?.cards || {})) {
      const normalizedName = String(name || '').trim();
      if (!normalizedName) continue;
      ownedTotalsByName[normalizedName] =
        normalizeQty(ownedTotalsByName[normalizedName]) + normalizeQty(qty);
    }
  }

  const rarityByName = {};
  for (const doc of catalogDocs) {
    if (!doc?._id) continue;
    const name = String(doc._id);
    if (rarityByName[name]) continue;
    rarityByName[name] = normalizeRarity(doc.rarity);
  }
  for (const doc of stateDocs) {
    if (!doc?._id || doc._id === STATE_CARDS_META_ID) continue;
    const name = String(doc._id);
    if (rarityByName[name]) continue;
    rarityByName[name] = normalizeRarity(doc.rarity);
  }

  const existingCardsPathByName = {};
  for (const rarity of Object.keys(RARITY_SCORES)) {
    const bucket = cardsRootDoc?.[rarity];
    if (!bucket || typeof bucket !== 'object') continue;

    for (const key of Object.keys(bucket)) {
      if (!key || key === 'totalPopulation') continue;

      const normalizedName = String(key)
        .replace(/\uFF0E/g, '.')
        .replace(/\uFF04/g, '$');

      if (!existingCardsPathByName[normalizedName]) {
        existingCardsPathByName[normalizedName] = [];
      }

      existingCardsPathByName[normalizedName].push({ rarity, key });
      if (!rarityByName[normalizedName]) {
        rarityByName[normalizedName] = rarity;
      }
    }
  }

  const allNames = new Set([
    ...Object.keys(ownedTotalsByName),
    ...Object.keys(rarityByName),
  ]);

  const totalPopulation = Object.values(ownedTotalsByName).reduce(
    (sum, qty) => sum + normalizeQty(qty),
    0
  );

  const operations = [];
  const valuesMap = {};
  const now = new Date();

  for (const name of allNames) {
    const population = normalizeQty(ownedTotalsByName[name]);
    const rarity = normalizeRarity(rarityByName[name]);
    const scarcity = totalPopulation / (population + 3);
    const value = computeCardValue(rarity, population, totalPopulation);

    valuesMap[name] = {
      value,
      rarity,
      population,
      scarcity,
    };

    operations.push({
      updateOne: {
        filter: { _id: name },
        update: {
          $set: {
            value,
            rarity,
            population,
            scarcity,
            totalPopulation,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    });
  }

  operations.push({
    updateOne: {
      filter: { _id: STATE_CARDS_META_ID },
      update: {
        $set: {
          totalPopulation,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  });

  await db.collection('state_cards').bulkWrite(operations, { ordered: false });

  const cardsPopulationSet = {
    totalPopulation,
    updatedAt: now,
  };

  for (const paths of Object.values(existingCardsPathByName)) {
    for (const pathInfo of paths) {
      cardsPopulationSet[`${pathInfo.rarity}.${pathInfo.key}.population`] = 0;
    }
  }

  for (const name of allNames) {
    const population = normalizeQty(ownedTotalsByName[name]);
    const targetRarity = normalizeRarity(rarityByName[name]);
    const existingPaths = existingCardsPathByName[name] || [];
    const inTarget = existingPaths.find((pathInfo) => pathInfo.rarity === targetRarity);
    const key = inTarget
      ? inTarget.key
      : String(name).replace(/\./g, '\uFF0E').replace(/\$/g, '\uFF04');

    cardsPopulationSet[`${targetRarity}.${key}.population`] = population;
  }

  await db.collection('cards').updateOne(
    cardsRootFilter,
    { $set: cardsPopulationSet },
    { upsert: true }
  );

  return {
    valuesByName: valuesMap,
    totalPopulation,
  };
}

async function incrementCardsPopulation(cardEntries) {
  const normalizedEntries = Array.isArray(cardEntries)
    ? cardEntries
        .map((entry) => {
          if (entry && typeof entry === 'object') {
            const name = String(entry.name || '').trim();
            if (!name) return null;
            const rawRarity = String(entry.rarity || '').trim();
            const rarity = Object.prototype.hasOwnProperty.call(RARITY_SCORES, rawRarity)
              ? rawRarity
              : '';
            return { name, rarity };
          }

          const name = String(entry || '').trim();
          if (!name) return null;
          return { name, rarity: '' };
        })
        .filter(Boolean)
    : [];

  if (normalizedEntries.length === 0) return;

  const countsByName = {};
  const providedRarityByName = {};
  for (const entry of normalizedEntries) {
    countsByName[entry.name] = (countsByName[entry.name] || 0) + 1;
    if (!providedRarityByName[entry.name] && entry.rarity) {
      providedRarityByName[entry.name] = entry.rarity;
    }
  }

  const db = await getDb();
  let cardsRootFilter;
  try {
    cardsRootFilter = { _id: new ObjectId(CARDS_ROOT_DOC_ID) };
  } catch {
    cardsRootFilter = { _id: CARDS_ROOT_DOC_ID };
  }

  const cardsCollection = db.collection('cards');

  const [catalogDocs, stateCardDocs, cardsRootDoc] = await Promise.all([
    db
      .collection('card_catalog')
      .find({}, { projection: { _id: 1, rarity: 1 } })
      .toArray(),
    db
      .collection('state_cards')
      .find({}, { projection: { _id: 1, rarity: 1 } })
      .toArray(),
    cardsCollection.findOne(cardsRootFilter, {
      projection: {
        Common: 1,
        Uncommon: 1,
        Rare: 1,
        Loric: 1,
        Mythical: 1,
        Legendary: 1,
      },
    }),
  ]);

  const rarityByName = {};
  for (const [name, rarity] of Object.entries(providedRarityByName)) {
    rarityByName[name] = rarity;
  }

  for (const doc of catalogDocs) {
    if (!doc?._id) continue;
    rarityByName[String(doc._id)] = normalizeRarity(doc.rarity);
  }
  for (const doc of stateCardDocs) {
    if (!doc?._id || doc._id === STATE_CARDS_META_ID) continue;
    if (rarityByName[String(doc._id)]) continue;
    rarityByName[String(doc._id)] = normalizeRarity(doc.rarity);
  }

  for (const name of Object.keys(countsByName)) {
    if (rarityByName[name]) continue;

    let bestRarity = '';
    let bestScore = -1;
    for (const rarity of Object.keys(RARITY_SCORES)) {
      const rarityBucket = cardsRootDoc?.[rarity];
      if (!rarityBucket || typeof rarityBucket !== 'object') continue;

      if (Object.prototype.hasOwnProperty.call(rarityBucket, name)) {
        const cardDoc = rarityBucket[name];
        const hasMetadata =
          cardDoc &&
          typeof cardDoc === 'object' &&
          (
            Object.prototype.hasOwnProperty.call(cardDoc, 'image') ||
            Object.prototype.hasOwnProperty.call(cardDoc, 'cardType') ||
            Object.prototype.hasOwnProperty.call(cardDoc, 'description') ||
            Object.prototype.hasOwnProperty.call(cardDoc, 'author')
          );
        const score = hasMetadata ? 2 : 1;
        if (score > bestScore) {
          bestScore = score;
          bestRarity = rarity;
        }
      }
    }

    if (bestRarity) {
      rarityByName[name] = bestRarity;
    }
  }

  const incUpdate = {};
  for (const [name, incrementBy] of Object.entries(countsByName)) {
    const rarity = normalizeRarity(rarityByName[name]);
    const safeName = String(name).replace(/\./g, '\uFF0E').replace(/\$/g, '\uFF04');
    incUpdate[`${rarity}.${safeName}.population`] = incrementBy;
  }
  incUpdate.totalPopulation = normalizedEntries.length;

  await cardsCollection.updateOne(
    cardsRootFilter,
    {
      $inc: incUpdate,
      $set: { updatedAt: new Date() },
      $setOnInsert: {},
    },
    { upsert: true }
  );
}

module.exports = {
  initPersistence,
  createUser,
  getUserByField,
  ensureUserAdmin,
  setUserToken,
  clearUserToken,
  ensureTradeProfile,
  setTradeProfileCards,
  listTradeProfileNames,
  getPendingTrade,
  setPendingTrade,
  deletePendingTrade,
  getSelectedTradeCards,
  setSelectedTradeCards,
  getBankInventory,
  setBankInventory,
  ensureBankWallet,
  setBankWallet,
  ensureUserPacks,
  setUserPacks,
  ensureDesignedCount,
  setDesignedCount,
  listPendingApprovals,
  getPendingApproval,
  setPendingApproval,
  deletePendingApproval,
  renamePendingApproval,
  ensureDeckSortPreference,
  setDeckSortPreference,
  upsertCardCatalogEntries,
  getCardValuesMap,
  getCardsPoolByRarity,
  upsertApprovedCardToCards,
  getCardDetailsByNames,
  recalculateAndStoreCardValues,
  incrementCardsPopulation,
};
