const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const persistence = require('./persistence');

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
    await setAuthCookie(res, user);

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
    await setAuthCookie(res, user);

    res.send({ username: user.username });
  } else {
    res.status(401).send({ msg: 'Unauthorized' });
  }
});

app.delete('/api/auth', async (req, res) => {
  const token = req.cookies['token'];
  const user = await getUser('token', token);
  if (user) {
    await clearAuthCookie(res, user);
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

app.get('/api/user/profile', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const username = sanitizeUsername(authUser.username);
  const admin = await persistence.ensureUserAdmin(username, Boolean(authUser.admin));
  const wallet = await ensureBankWallet(username, 0);

  res.send({
    username,
    admin,
    wallet,
  });
});

app.post('/api/trades/owned', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const profile = await ensureTradeProfile(userName, {});
  res.send({ ownedEntries: toOwnedEntries(profile.cards) });
});

app.get('/api/trades/pending', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.query?.userName);
  const pendingTrade = await persistence.getPendingTrade(userName);
  res.send({
    pendingTrade: pendingTrade
      ? {
          otherUserLabel: pendingTrade.otherUserLabel || pendingTrade.otherUserName || 'Other User',
          otherUserName: pendingTrade.otherUserName || '',
          otherTradeCards: Array.isArray(pendingTrade.otherTradeCards)
            ? pendingTrade.otherTradeCards
            : [],
        }
      : {
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
    await persistence.deletePendingTrade(userName);
    res.send({ ok: true });
    return;
  }

  await persistence.setPendingTrade(userName, {
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
  const selectedTradeCards = await persistence.getSelectedTradeCards(userName);
  res.send({ selectedTradeCards });
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

  await persistence.setSelectedTradeCards(userName, selectedTradeCards);
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
  const matchedUserName = await resolveTradeUserName(target);

  if (!matchedUserName) {
    res.send({ error: 'User not found' });
    return;
  }

  if (currentUserName && matchedUserName.toLowerCase() === currentUserName.toLowerCase()) {
    res.send({ error: 'You cannot request a trade with yourself' });
    return;
  }

  const profile = await ensureTradeProfile(matchedUserName, {});
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
  const profile = await ensureTradeProfile(userName, {});

  const currentQty = normalizeQty(profile.cards[cardName]);
  if (currentQty <= 1) {
    delete profile.cards[cardName];
  } else {
    profile.cards[cardName] = currentQty - 1;
  }

  await persistence.setTradeProfileCards(userName, profile.cards);

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
  const profile = await ensureTradeProfile(userName, {});

  profile.cards[cardName] = normalizeQty(profile.cards[cardName]) + 1;
  await persistence.setTradeProfileCards(userName, profile.cards);
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
  const profile = await ensureTradeProfile(userName, {});

  for (const card of selectedTradeCards) {
    if (!card?.name) continue;
    profile.cards[card.name] = normalizeQty(profile.cards[card.name]) + 1;
  }

  await persistence.setSelectedTradeCards(userName, []);
  await persistence.deletePendingTrade(userName);
  await persistence.setTradeProfileCards(userName, profile.cards);

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
  const activeProfile = await ensureTradeProfile(activeUserName, {});
  const otherProfile = await ensureTradeProfile(otherUserName, {});

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

  await persistence.setSelectedTradeCards(activeUserName, []);
  await persistence.deletePendingTrade(activeUserName);
  await persistence.setTradeProfileCards(activeUserName, activeProfile.cards);
  await persistence.setTradeProfileCards(otherUserName, otherProfile.cards);

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

  const bankInventory = await persistence.getBankInventory();

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
  const profile = await ensureTradeProfile(userName, {});
  const currentWallet = await ensureBankWallet(userName, 0);
  const bankInventory = await persistence.getBankInventory();
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
  await persistence.setBankWallet(userName, nextWallet);

  const nextQty = Math.max(0, availableQty - 1);
  if (nextQty > 0) {
    bankInventory[cardName] = nextQty;
  } else {
    delete bankInventory[cardName];
  }

  profile.cards[cardName] = normalizeQty(profile.cards[cardName]) + 1;
  await persistence.setBankInventory(bankInventory);
  await persistence.setTradeProfileCards(userName, profile.cards);

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
  const profile = await ensureTradeProfile(userName, {});
  const currentWallet = await ensureBankWallet(userName, 0);
  const bankInventory = await persistence.getBankInventory();
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
  await persistence.setBankWallet(userName, nextWallet);
  await persistence.setBankInventory(bankInventory);
  await persistence.setTradeProfileCards(userName, profile.cards);

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
  if (!userName) {
    res.send({ ok: false, packs: normalizePacksMap({}), wallet: 0 });
    return;
  }

  const packs = await ensureUserPacks(userName, {});
  const wallet = await ensureBankWallet(userName, 0);

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
  if (!userName || !isKnownPackName(packName)) {
    res.send({ ok: false, packs: normalizePacksMap({}), wallet: 0 });
    return;
  }

  const packs = await ensureUserPacks(userName, {});
  const currentWallet = await ensureBankWallet(userName, 0);
  if (currentWallet < packPrice) {
    res.send({ ok: false, packs, wallet: currentWallet });
    return;
  }

  const nextWallet = normalizeWalletValue(currentWallet - packPrice);
  await persistence.setBankWallet(userName, nextWallet);

  packs[packName] = normalizeQty(packs[packName]) + 1;
  await persistence.setUserPacks(userName, packs);

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
  if (!userName || !isKnownPackName(packName)) {
    res.send({ ok: false, packs: normalizePacksMap({}) });
    return;
  }

  const packs = await ensureUserPacks(userName, {});
  const currentCount = normalizeQty(packs[packName]);
  if (currentCount <= 0) {
    res.send({ ok: false, packs: normalizePacksMap(packs) });
    return;
  }

  packs[packName] = Math.max(0, currentCount - 1);
  await persistence.setUserPacks(userName, packs);
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
  if (!userName) {
    res.send({ ok: false, ownedEntries: [] });
    return;
  }

  const profile = await ensureTradeProfile(userName, {});
  for (const card of openedCards) {
    if (!card?.name) continue;
    profile.cards[card.name] = normalizeQty(profile.cards[card.name]) + 1;
  }

  await persistence.setTradeProfileCards(userName, profile.cards);

  res.send({ ok: true, ownedEntries: toOwnedEntries(profile.cards) });
});

app.post('/api/designer/submit', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  if (!userName) {
    res.send({ ok: false, nextDesigned: 0, rewardPackKey: 'Default Pack', packs: normalizePacksMap({}) });
    return;
  }

  const currentDesigned = await ensureDesignedCount(userName, 0);
  const nextDesigned = currentDesigned + 1;
  await persistence.setDesignedCount(userName, nextDesigned);

  const rewardPackKey = getRewardPackKeyForDesignCount(nextDesigned);
  const packs = await ensureUserPacks(userName, {});
  packs[rewardPackKey] = normalizeQty(packs[rewardPackKey]) + 1;
  await persistence.setUserPacks(userName, packs);

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

  const pendingCards = (await persistence.listPendingApprovals())
    .map((entry) => ({ name: entry._id, card: { ...(entry.card || {}) } }))
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

  if (await persistence.getPendingApproval(name)) {
    res.send({ ok: false, error: 'A pending card with that name already exists' });
    return;
  }

  await persistence.setPendingApproval(name, card);
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

  if (!(await persistence.getPendingApproval(originalName))) {
    res.send({ ok: false, error: 'Pending card not found' });
    return;
  }

  if (originalName !== nextName && (await persistence.getPendingApproval(nextName))) {
    res.send({ ok: false, error: 'Another pending card already uses that name' });
    return;
  }

  await persistence.renamePendingApproval(originalName, nextName, nextCard);

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

  await persistence.deletePendingApproval(name);
  res.send({ ok: true });
});

app.post('/api/approvals/approve', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const name = sanitizeCardName(req.body?.name);
  const pending = await persistence.getPendingApproval(name);
  if (!name || !pending) {
    res.send({ ok: false, error: 'Pending card not found' });
    return;
  }

  const card = pending.card;
  await persistence.deletePendingApproval(name);

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
  const current = await ensureDeckSortPreference(userName, 'Rarity');
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
  await persistence.setDeckSortPreference(userName, sortBy);
  const current = await ensureDeckSortPreference(userName, sortBy);
  res.send({ ok: true, sortBy: current });
});

async function createUser(username, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  return await persistence.createUser(username, passwordHash);
}

async function getUser(field, value) {
  return await persistence.getUserByField(field, value);
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

async function ensureTradeProfile(userName, fallbackCards) {
  if (!userName) {
    return { cards: {} };
  }

  return await persistence.ensureTradeProfile(userName, fallbackCards);
}

async function ensureBankWallet(userName, fallbackWallet) {
  if (!userName) return 0;
  return await persistence.ensureBankWallet(userName, fallbackWallet);
}

async function ensureUserPacks(userName, fallbackPacks) {
  if (!userName) {
    return normalizePacksMap({});
  }

  return await persistence.ensureUserPacks(userName, fallbackPacks);
}

async function ensureDesignedCount(userName, fallbackDesigned) {
  if (!userName) return 0;
  return await persistence.ensureDesignedCount(userName, fallbackDesigned);
}

function normalizeDeckSort(value) {
  const next = String(value || 'Rarity');
  if (next === 'Value' || next === 'Name' || next === 'Rarity') {
    return next;
  }
  return 'Rarity';
}

async function ensureDeckSortPreference(userName, fallbackSort) {
  if (!userName) {
    return normalizeDeckSort(fallbackSort);
  }

  return await persistence.ensureDeckSortPreference(userName, fallbackSort);
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

async function resolveTradeUserName(rawName) {
  const target = sanitizeUsername(rawName);
  if (!target) return null;

  const names = await persistence.listTradeProfileNames();
  const exact = names.find((name) => name === target);
  if (exact) return exact;

  const insensitive = names.find((name) => name.toLowerCase() === target.toLowerCase());
  if (insensitive) return insensitive;

  return null;
}

async function setAuthCookie(res, user) {
  const nextToken = crypto.randomUUID();
  await persistence.setUserToken(user.username, nextToken);

  res.cookie('token', nextToken, {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
  });
}

async function clearAuthCookie(res, user) {
  await persistence.clearUserToken(user.username);
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

(async () => {
  await persistence.initPersistence();

  app.listen(port, function () {
    console.log(`Listening on port ${port}`);
  });
})().catch((error) => {
  console.error('Failed to initialize backend persistence', error);
  process.exit(1);
});