const express = require('express');
const app = express();
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

const port = 3000;
app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});