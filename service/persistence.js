const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const DEFAULT_DB_NAME = 'Fjord';
const GLOBAL_BANK_INVENTORY_ID = 'global';

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
};
