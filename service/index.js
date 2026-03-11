const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

app.use(express.json());
app.use(cookieParser());

app.post('/api/auth', async (req, res) => {
  const username = sanitizeUsername(req.body?.username);
  const password = req.body?.password;

  if (!username || !password) {
    res.status(400).send({ msg: 'Username and password are required' });
    return;
  }

  if (await getUser('username', username)) {
    res.status(409).send({ msg: 'Existing user' });
  } else {
    const user = await createUser(username, password);
    setAuthCookie(res, user);

    res.send({ username: user.username });
  }
});

app.put('/api/auth', async (req, res) => {
  const username = sanitizeUsername(req.body?.username);
  const password = req.body?.password;

  if (!username || !password) {
    res.status(400).send({ msg: 'Username and password are required' });
    return;
  }

  const user = await getUser('username', username);
  if (user && (await bcrypt.compare(password, user.password))) {
    setAuthCookie(res, user);

    res.send({ username: user.username });
  } else {
    res.status(401).send({ msg: 'Unauthorized' });
  }
});

app.delete('/api/auth', async (req, res) => {
  const token = req.cookies['token'];
  const user = await getUser('token', token);
  if (user) {
    clearAuthCookie(res, user);
  }

  res.send({});
});

app.get('/api/user/me', async (req, res) => {
  const token = req.cookies['token'];
  const user = await getUser('token', token);
  if (user) {
    res.send({ username: user.username });
  } else {
    res.status(401).send({ msg: 'Unauthorized' });
  }
});

const tradeProfiles = new Map();
const pendingTrades = new Map();
const selectedTradeCardsByUser = new Map();
const bankInventory = {};
const bankWalletByUser = new Map();
const userPacksByUser = new Map();
const designedCountByUser = new Map();
const pendingApprovalByName = new Map();
const deckSortPreferenceByUser = new Map();

app.post('/api/trades/bootstrap', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const usersMap = req.body?.usersMap;
  if (!usersMap || typeof usersMap !== 'object') {
    res.send({ ok: true });
    return;
  }

  for (const [name, profile] of Object.entries(usersMap)) {
    if (!name) continue;
    const normalized = normalizeCardMap(profile?.cards || {});
    if (!tradeProfiles.has(name)) {
      tradeProfiles.set(name, { cards: normalized });
      continue;
    }

    const existing = tradeProfiles.get(name) || { cards: {} };
    tradeProfiles.set(name, { cards: { ...normalized, ...existing.cards } });
  }

  res.send({ ok: true });
});

app.post('/api/trades/owned', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const fallbackCards = normalizeCardMap(req.body?.fallbackCards || {});
  const profile = ensureTradeProfile(userName, fallbackCards);
  res.send({ ownedEntries: toOwnedEntries(profile.cards) });
});

app.get('/api/trades/pending', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.query?.userName);
  res.send({
    pendingTrade: pendingTrades.get(userName) || {
      otherUserLabel: 'Other User',
      otherUserName: '',
      otherTradeCards: [],
    },
  });
});

app.put('/api/trades/pending', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const pendingTrade = req.body?.pendingTrade;

  if (!userName || !pendingTrade || !pendingTrade.otherUserName) {
    pendingTrades.delete(userName);
    res.send({ ok: true });
    return;
  }

  pendingTrades.set(userName, {
    otherUserName: sanitizeUsername(pendingTrade.otherUserName),
    otherUserLabel: pendingTrade.otherUserLabel || pendingTrade.otherUserName,
    otherTradeCards: Array.isArray(pendingTrade.otherTradeCards) ? pendingTrade.otherTradeCards : [],
  });

  res.send({ ok: true });
});

app.get('/api/trades/selection', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.query?.userName);
  res.send({ selectedTradeCards: selectedTradeCardsByUser.get(userName) || [] });
});

app.put('/api/trades/selection', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const selectedTradeCards = Array.isArray(req.body?.selectedTradeCards)
    ? req.body.selectedTradeCards
    : [];

  selectedTradeCardsByUser.set(userName, selectedTradeCards);
  res.send({ ok: true });
});

app.post('/api/trades/request-user', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const currentUserName = sanitizeUsername(req.body?.currentUserName);
  const target = sanitizeUsername(req.body?.requestUserInput);
  const matchedUserName = resolveTradeUserName(target);

  if (!matchedUserName) {
    res.send({ error: 'User not found' });
    return;
  }

  if (currentUserName && matchedUserName.toLowerCase() === currentUserName.toLowerCase()) {
    res.send({ error: 'You cannot request a trade with yourself' });
    return;
  }

  const profile = ensureTradeProfile(matchedUserName, {});
  const pool = [];
  for (const [name, qty] of Object.entries(profile.cards || {})) {
    const count = normalizeQty(qty);
    for (let i = 0; i < count; i += 1) {
      pool.push(name);
    }
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const pickCount = Math.min(shuffled.length, Math.max(1, Math.floor(Math.random() * 5) + 1));
  const now = Date.now();
  const otherTradeCards = shuffled.slice(0, pickCount).map((name, index) => ({
    name,
    otherTradeEntryId: `${name}-${now}-${index}-${Math.random()}`,
  }));

  res.send({
    otherUserLabel: matchedUserName,
    otherUserName: matchedUserName,
    otherTradeCards,
  });
});

app.post('/api/trades/owned/decrement', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const cardName = req.body?.cardName;
  const fallbackCards = normalizeCardMap(req.body?.fallbackCards || {});
  const profile = ensureTradeProfile(userName, fallbackCards);

  const currentQty = normalizeQty(profile.cards[cardName]);
  if (currentQty <= 1) {
    delete profile.cards[cardName];
  } else {
    profile.cards[cardName] = currentQty - 1;
  }

  res.send({ ownedEntries: toOwnedEntries(profile.cards) });
});

app.post('/api/trades/owned/increment', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const cardName = req.body?.cardName;
  const fallbackCards = normalizeCardMap(req.body?.fallbackCards || {});
  const profile = ensureTradeProfile(userName, fallbackCards);

  profile.cards[cardName] = normalizeQty(profile.cards[cardName]) + 1;
  res.send({ ownedEntries: toOwnedEntries(profile.cards) });
});

app.post('/api/trades/cancel', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const selectedTradeCards = Array.isArray(req.body?.selectedTradeCards)
    ? req.body.selectedTradeCards
    : [];
  const fallbackCards = normalizeCardMap(req.body?.fallbackCards || {});
  const profile = ensureTradeProfile(userName, fallbackCards);

  for (const card of selectedTradeCards) {
    if (!card?.name) continue;
    profile.cards[card.name] = normalizeQty(profile.cards[card.name]) + 1;
  }

  selectedTradeCardsByUser.set(userName, []);
  pendingTrades.delete(userName);

  res.send({ ownedEntries: toOwnedEntries(profile.cards) });
});

app.post('/api/trades/accept', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const activeUserName = sanitizeUsername(req.body?.activeUserName);
  const otherUserName = sanitizeUsername(req.body?.otherUserName);
  const selectedTradeCards = Array.isArray(req.body?.selectedTradeCards)
    ? req.body.selectedTradeCards
    : [];
  const otherTradeCards = Array.isArray(req.body?.otherTradeCards)
    ? req.body.otherTradeCards
    : [];
  const activeFallbackCards = normalizeCardMap(req.body?.activeFallbackCards || {});
  const otherFallbackCards = normalizeCardMap(req.body?.otherFallbackCards || {});

  const activeProfile = ensureTradeProfile(activeUserName, activeFallbackCards);
  const otherProfile = ensureTradeProfile(otherUserName, otherFallbackCards);

  for (const card of selectedTradeCards) {
    if (!card?.name) continue;
    otherProfile.cards[card.name] = normalizeQty(otherProfile.cards[card.name]) + 1;
  }

  for (const card of otherTradeCards) {
    if (!card?.name) continue;
    const available = normalizeQty(otherProfile.cards[card.name]);
    if (available <= 0) continue;

    otherProfile.cards[card.name] = available - 1;
    if (otherProfile.cards[card.name] <= 0) {
      delete otherProfile.cards[card.name];
    }

    activeProfile.cards[card.name] = normalizeQty(activeProfile.cards[card.name]) + 1;
  }

  selectedTradeCardsByUser.set(activeUserName, []);
  pendingTrades.delete(activeUserName);

  res.send({
    nextActiveOwned: toOwnedEntries(activeProfile.cards),
    nextTargetOwned: toOwnedEntries(otherProfile.cards),
  });
});

app.post('/api/bank/inventory', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const fallbackEntries = Array.isArray(req.body?.fallbackEntries)
    ? req.body.fallbackEntries
    : [];

  if (Object.keys(bankInventory).length === 0 && fallbackEntries.length > 0) {
    for (const entry of fallbackEntries) {
      if (!entry?.name) continue;
      const qty = normalizeQty(entry.qty);
      if (qty > 0) {
        bankInventory[entry.name] = qty;
      }
    }
  }

  res.send({ bankEntries: toOwnedEntries(bankInventory) });
});

app.post('/api/bank/buy', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const cardName = req.body?.cardName;
  const buyPrice = normalizeWalletValue(req.body?.buyPrice);
  const fallbackCards = normalizeCardMap(req.body?.fallbackCards || {});
  const fallbackWallet = normalizeWalletValue(req.body?.fallbackWallet);

  const profile = ensureTradeProfile(userName, fallbackCards);
  const currentWallet = ensureBankWallet(userName, fallbackWallet);
  const availableQty = normalizeQty(bankInventory[cardName]);

  if (!userName || !cardName || availableQty <= 0 || currentWallet < buyPrice) {
    res.send({
      ok: false,
      bankEntries: toOwnedEntries(bankInventory),
      ownedEntries: toOwnedEntries(profile.cards),
      wallet: currentWallet,
    });
    return;
  }

  const nextWallet = normalizeWalletValue(currentWallet - buyPrice);
  bankWalletByUser.set(userName, nextWallet);

  const nextQty = Math.max(0, availableQty - 1);
  if (nextQty > 0) {
    bankInventory[cardName] = nextQty;
  } else {
    delete bankInventory[cardName];
  }

  profile.cards[cardName] = normalizeQty(profile.cards[cardName]) + 1;

  res.send({
    ok: true,
    bankEntries: toOwnedEntries(bankInventory),
    ownedEntries: toOwnedEntries(profile.cards),
    wallet: nextWallet,
  });
});

app.post('/api/bank/sell', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const cardName = req.body?.cardName;
  const payoutAmount = normalizeWalletValue(req.body?.payoutAmount);
  const fallbackCards = normalizeCardMap(req.body?.fallbackCards || {});
  const fallbackWallet = normalizeWalletValue(req.body?.fallbackWallet);

  const profile = ensureTradeProfile(userName, fallbackCards);
  const currentWallet = ensureBankWallet(userName, fallbackWallet);
  const ownedQty = normalizeQty(profile.cards[cardName]);

  if (!userName || !cardName || ownedQty <= 0) {
    res.send({
      ok: false,
      bankEntries: toOwnedEntries(bankInventory),
      ownedEntries: toOwnedEntries(profile.cards),
      wallet: currentWallet,
    });
    return;
  }

  const nextOwnedQty = Math.max(0, ownedQty - 1);
  if (nextOwnedQty > 0) {
    profile.cards[cardName] = nextOwnedQty;
  } else {
    delete profile.cards[cardName];
  }

  bankInventory[cardName] = normalizeQty(bankInventory[cardName]) + 1;

  const nextWallet = normalizeWalletValue(currentWallet + payoutAmount);
  bankWalletByUser.set(userName, nextWallet);

  res.send({
    ok: true,
    bankEntries: toOwnedEntries(bankInventory),
    ownedEntries: toOwnedEntries(profile.cards),
    wallet: nextWallet,
  });
});

app.post('/api/packs/state', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const fallbackPacks = normalizePacksMap(req.body?.fallbackPacks || {});
  const fallbackWallet = normalizeWalletValue(req.body?.fallbackWallet);

  if (!userName) {
    res.send({ ok: false, packs: normalizePacksMap({}), wallet: 0 });
    return;
  }

  const packs = ensureUserPacks(userName, fallbackPacks);
  const wallet = ensureBankWallet(userName, fallbackWallet);

  res.send({ ok: true, packs, wallet });
});

app.post('/api/packs/buy', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const packName = req.body?.packName;
  const packPrice = normalizeWalletValue(req.body?.packPrice);
  const fallbackPacks = normalizePacksMap(req.body?.fallbackPacks || {});
  const fallbackWallet = normalizeWalletValue(req.body?.fallbackWallet);

  if (!userName || !isKnownPackName(packName)) {
    res.send({ ok: false, packs: normalizePacksMap({}), wallet: 0 });
    return;
  }

  const packs = ensureUserPacks(userName, fallbackPacks);
  const currentWallet = ensureBankWallet(userName, fallbackWallet);
  if (currentWallet < packPrice) {
    res.send({ ok: false, packs, wallet: currentWallet });
    return;
  }

  const nextWallet = normalizeWalletValue(currentWallet - packPrice);
  bankWalletByUser.set(userName, nextWallet);

  packs[packName] = normalizeQty(packs[packName]) + 1;
  userPacksByUser.set(userName, normalizePacksMap(packs));

  res.send({ ok: true, packs: normalizePacksMap(packs), wallet: nextWallet });
});

app.post('/api/packs/open', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const packName = req.body?.packName;
  const fallbackPacks = normalizePacksMap(req.body?.fallbackPacks || {});

  if (!userName || !isKnownPackName(packName)) {
    res.send({ ok: false, packs: normalizePacksMap({}) });
    return;
  }

  const packs = ensureUserPacks(userName, fallbackPacks);
  const currentCount = normalizeQty(packs[packName]);
  if (currentCount <= 0) {
    res.send({ ok: false, packs: normalizePacksMap(packs) });
    return;
  }

  packs[packName] = Math.max(0, currentCount - 1);
  userPacksByUser.set(userName, normalizePacksMap(packs));
  res.send({ ok: true, packs: normalizePacksMap(packs) });
});

app.post('/api/packs/claim', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const openedCards = Array.isArray(req.body?.openedCards) ? req.body.openedCards : [];
  const fallbackCards = normalizeCardMap(req.body?.fallbackCards || {});

  if (!userName) {
    res.send({ ok: false, ownedEntries: [] });
    return;
  }

  const profile = ensureTradeProfile(userName, fallbackCards);
  for (const card of openedCards) {
    if (!card?.name) continue;
    profile.cards[card.name] = normalizeQty(profile.cards[card.name]) + 1;
  }

  res.send({ ok: true, ownedEntries: toOwnedEntries(profile.cards) });
});

app.post('/api/designer/submit', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const fallbackDesigned = normalizeQty(req.body?.fallbackDesigned);
  const fallbackPacks = normalizePacksMap(req.body?.fallbackPacks || {});

  if (!userName) {
    res.send({ ok: false, nextDesigned: 0, rewardPackKey: 'Default Pack', packs: normalizePacksMap({}) });
    return;
  }

  const currentDesigned = ensureDesignedCount(userName, fallbackDesigned);
  const nextDesigned = currentDesigned + 1;
  designedCountByUser.set(userName, nextDesigned);

  const rewardPackKey = getRewardPackKeyForDesignCount(nextDesigned);
  const packs = ensureUserPacks(userName, fallbackPacks);
  packs[rewardPackKey] = normalizeQty(packs[rewardPackKey]) + 1;
  userPacksByUser.set(userName, normalizePacksMap(packs));

  res.send({
    ok: true,
    nextDesigned,
    rewardPackKey,
    packs: normalizePacksMap(packs),
  });
});

app.get('/api/approvals/pending', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const pendingCards = Array.from(pendingApprovalByName.entries())
    .map(([name, card]) => ({ name, card: { ...card } }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.send({ pendingCards });
});

app.post('/api/approvals/pending', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const name = sanitizeCardName(req.body?.name);
  const card = normalizePendingCard(req.body?.card);

  if (!name || !card) {
    res.send({ ok: false, error: 'Card name and card data are required' });
    return;
  }

  if (pendingApprovalByName.has(name)) {
    res.send({ ok: false, error: 'A pending card with that name already exists' });
    return;
  }

  pendingApprovalByName.set(name, card);
  res.send({ ok: true });
});

app.put('/api/approvals/pending', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const originalName = sanitizeCardName(req.body?.originalName);
  const nextName = sanitizeCardName(req.body?.nextName);
  const nextCard = normalizePendingCard(req.body?.card);

  if (!originalName || !nextName || !nextCard) {
    res.send({ ok: false, error: 'Invalid pending card edit request' });
    return;
  }

  if (!pendingApprovalByName.has(originalName)) {
    res.send({ ok: false, error: 'Pending card not found' });
    return;
  }

  if (originalName !== nextName && pendingApprovalByName.has(nextName)) {
    res.send({ ok: false, error: 'Another pending card already uses that name' });
    return;
  }

  if (originalName !== nextName) {
    pendingApprovalByName.delete(originalName);
  }
  pendingApprovalByName.set(nextName, nextCard);

  res.send({ ok: true });
});

app.delete('/api/approvals/pending', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const name = sanitizeCardName(req.query?.name);
  if (!name) {
    res.send({ ok: false });
    return;
  }

  pendingApprovalByName.delete(name);
  res.send({ ok: true });
});

app.post('/api/approvals/approve', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const name = sanitizeCardName(req.body?.name);
  if (!name || !pendingApprovalByName.has(name)) {
    res.send({ ok: false, error: 'Pending card not found' });
    return;
  }

  const card = pendingApprovalByName.get(name);
  pendingApprovalByName.delete(name);

  res.send({
    ok: true,
    approvedCard: {
      name,
      card: { ...card },
    },
  });
});

app.get('/api/preferences/deck-sort', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.query?.userName);
  const fallbackSort = normalizeDeckSort(req.query?.fallback);
  const current = ensureDeckSortPreference(userName, fallbackSort);
  res.send({ sortBy: current });
});

app.put('/api/preferences/deck-sort', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const sortBy = normalizeDeckSort(req.body?.sortBy);
  const current = ensureDeckSortPreference(userName, sortBy);
  res.send({ ok: true, sortBy: current });
});

const users = [];

async function createUser(username, password) {
  const passwordHash = await bcrypt.hash(password, 10);

  const user = {
    username: username,
    password: passwordHash,
  };

  users.push(user);

  return user;
}

async function getUser(field, value) {
  if (value) {
    return users.find((user) => user[field] === value);
  }
  return null;
}

async function getAuthUser(req) {
  const token = req.cookies['token'];
  return await getUser('token', token);
}

function sanitizeUsername(username) {
  if (!username) {
    return '';
  }

  return String(username).trim();
}

function sanitizeCardName(name) {
  if (!name) return '';
  return String(name).trim();
}

function normalizePendingCard(card) {
  if (!card || typeof card !== 'object') return null;
  return {
    image: card.image || 'Default.png',
    cost: card.cost != null ? card.cost : '-',
    rarity: card.rarity || 'Common',
    cardType: card.cardType || 'Type',
    description: card.description || '',
    strength: card.strength != null ? card.strength : '-',
    endurance: card.endurance != null ? card.endurance : '-',
    author: card.author || 'Unknown',
    value: Number.isFinite(Number(card.value)) ? Number(card.value) : 0,
  };
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

function toOwnedEntries(cards) {
  return Object.entries(cards || {})
    .map(([name, qty]) => ({ name, qty: normalizeQty(qty) }))
    .filter((entry) => entry.qty > 0);
}

function ensureTradeProfile(userName, fallbackCards) {
  if (!userName) {
    return { cards: {} };
  }

  if (!tradeProfiles.has(userName)) {
    tradeProfiles.set(userName, { cards: normalizeCardMap(fallbackCards) });
  }

  const profile = tradeProfiles.get(userName);
  if (!profile.cards || typeof profile.cards !== 'object') {
    profile.cards = {};
  }

  return profile;
}

function ensureBankWallet(userName, fallbackWallet) {
  if (!userName) return 0;
  if (!bankWalletByUser.has(userName)) {
    bankWalletByUser.set(userName, normalizeWalletValue(fallbackWallet));
  }
  return normalizeWalletValue(bankWalletByUser.get(userName));
}

function ensureUserPacks(userName, fallbackPacks) {
  if (!userName) {
    return normalizePacksMap({});
  }

  if (!userPacksByUser.has(userName)) {
    userPacksByUser.set(userName, normalizePacksMap(fallbackPacks || {}));
  }

  const current = normalizePacksMap(userPacksByUser.get(userName));
  userPacksByUser.set(userName, current);
  return current;
}

function ensureDesignedCount(userName, fallbackDesigned) {
  if (!userName) return 0;
  if (!designedCountByUser.has(userName)) {
    designedCountByUser.set(userName, normalizeQty(fallbackDesigned));
  }
  return normalizeQty(designedCountByUser.get(userName));
}

function normalizeDeckSort(value) {
  const next = String(value || 'Rarity');
  if (next === 'Value' || next === 'Name' || next === 'Rarity') {
    return next;
  }
  return 'Rarity';
}

function ensureDeckSortPreference(userName, fallbackSort) {
  if (!userName) {
    return normalizeDeckSort(fallbackSort);
  }

  if (!deckSortPreferenceByUser.has(userName)) {
    deckSortPreferenceByUser.set(userName, normalizeDeckSort(fallbackSort));
  }

  const current = normalizeDeckSort(deckSortPreferenceByUser.get(userName));
  deckSortPreferenceByUser.set(userName, current);
  return current;
}

function getRewardPackKeyForDesignCount(designCount) {
  const safeCount = Math.max(1, normalizeQty(designCount));
  const cyclePosition = ((safeCount - 1) % 100) + 1;

  const targets = [
    { pack: 'Default Pack', count: 40 },
    { pack: 'Saga Pack', count: 30 },
    { pack: 'Heroic Pack', count: 18 },
    { pack: 'Mythbound Pack', count: 12 },
  ];

  const assigned = {
    'Default Pack': 0,
    'Saga Pack': 0,
    'Heroic Pack': 0,
    'Mythbound Pack': 0,
  };

  let selectedPack = 'Default Pack';

  for (let position = 1; position <= cyclePosition; position += 1) {
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
    if (position === cyclePosition) {
      selectedPack = bestPack;
    }
  }

  return selectedPack;
}

function isKnownPackName(packName) {
  return (
    packName === 'Default Pack' ||
    packName === 'Saga Pack' ||
    packName === 'Heroic Pack' ||
    packName === 'Mythbound Pack'
  );
}

function resolveTradeUserName(rawName) {
  const target = sanitizeUsername(rawName);
  if (!target) return null;

  const names = Array.from(tradeProfiles.keys());
  const exact = names.find((name) => name === target);
  if (exact) return exact;

  const insensitive = names.find((name) => name.toLowerCase() === target.toLowerCase());
  if (insensitive) return insensitive;

  return null;
}

function setAuthCookie(res, user) {
  user.token = crypto.randomUUID();

  res.cookie('token', user.token, {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
  });
}

function clearAuthCookie(res, user) {
  delete user.token;
  res.clearCookie('token');
}

const staticCandidates = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, '..', 'dist'),
];
const distPath = staticCandidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));

if (!distPath) {
  throw new Error(`Unable to find frontend build output. Checked: ${staticCandidates.join(', ')}`);
}

app.use(express.static(distPath));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const port = 4000;
app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});