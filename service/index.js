const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const persistence = require('./persistence');

app.use(express.json({ limit: '50mb' }));
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

app.post('/api/cards/catalog', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  await persistence.upsertCardCatalogEntries(entries);
  const nextState = await recalculateCardValuesInDb();
  res.send({
    ok: true,
    valuesByName: nextState.valuesByName,
    totalPopulation: nextState.totalPopulation,
  });
});

app.get('/api/cards/values', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const cardState = await persistence.getCardValuesMap();
  res.send({
    valuesByName: cardState.valuesByName,
    totalPopulation: cardState.totalPopulation,
  });
});

app.get('/api/card-images/:id', async (req, res) => {
  const image = await persistence.getCardImageById(req.params?.id);
  if (!image?.data) {
    res.status(404).send({ msg: 'Image not found' });
    return;
  }

  const payload = Buffer.isBuffer(image.data)
    ? image.data
    : (image.data?.buffer ? Buffer.from(image.data.buffer) : null);

  if (!payload) {
    res.status(404).send({ msg: 'Image not found' });
    return;
  }

  res.setHeader('Content-Type', image.mimeType || 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(payload);
});

app.post('/api/trades/owned', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const profile = await ensureTradeProfile(userName, {});
  const ownedEntries = toOwnedEntries(profile.cards);
  const detailsByName = await persistence.getCardDetailsByNames(ownedEntries.map((entry) => entry.name));
  const ownedCards = ownedEntries.map((entry) => ({
    ...(detailsByName[entry.name] || {
      name: entry.name,
      image: 'Default.png',
      cost: '-',
      rarity: 'Common',
      cardType: 'Type',
      description: '',
      strength: '-',
      endurance: '-',
      author: 'Unknown',
      value: 0,
      population: 0,
    }),
    qty: normalizeQty(entry.qty),
  }));

  res.send({ ownedEntries, ownedCards });
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

  if (!userName || !cardName) {
    res.send({ ownedEntries: toOwnedEntries(profile.cards) });
    return;
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
  const profile = await ensureTradeProfile(userName, {});

  if (!userName || !cardName) {
    res.send({ ownedEntries: toOwnedEntries(profile.cards) });
    return;
  }

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

  await persistence.setSelectedTradeCards(userName, []);
  await persistence.deletePendingTrade(userName);

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

  const selectedCounts = {};
  for (const card of selectedTradeCards) {
    if (!card?.name) continue;
    selectedCounts[card.name] = normalizeQty(selectedCounts[card.name]) + 1;
  }

  for (const [name, qty] of Object.entries(selectedCounts)) {
    const available = normalizeQty(activeProfile.cards[name]);
    if (available < qty) {
      res.send({ ok: false, error: 'Insufficient selected cards to complete trade' });
      return;
    }
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

  for (const [name, qty] of Object.entries(selectedCounts)) {
    const available = normalizeQty(activeProfile.cards[name]);
    const remaining = Math.max(0, available - qty);
    if (remaining > 0) {
      activeProfile.cards[name] = remaining;
    } else {
      delete activeProfile.cards[name];
    }

    otherProfile.cards[name] = normalizeQty(otherProfile.cards[name]) + qty;
  }

  await persistence.setSelectedTradeCards(activeUserName, []);
  await persistence.deletePendingTrade(activeUserName);
  await persistence.setTradeProfileCards(activeUserName, activeProfile.cards);
  await persistence.setTradeProfileCards(otherUserName, otherProfile.cards);
  await recalculateCardValuesInDb();

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
  const bankEntries = toOwnedEntries(bankInventory);
  const entryNames = bankEntries.map((entry) => entry.name);
  const [detailsByName, cardValues] = await Promise.all([
    persistence.getCardDetailsByNames(entryNames),
    persistence.getCardValuesMap(),
  ]);
  const valuesByName = cardValues?.valuesByName || {};

  res.send({
    bankEntries: bankEntries.map((entry) => ({
      ...entry,
      card:
        detailsByName[entry.name] ||
        {
          name: entry.name,
          image: 'Default.png',
          cost: '-',
          rarity: normalizeRarity(valuesByName[entry.name]?.rarity),
          cardType: 'Type',
          description: '',
          strength: '-',
          endurance: '-',
          author: 'Unknown',
          value: Number.isFinite(Number(valuesByName[entry.name]?.value))
            ? Number(valuesByName[entry.name].value)
            : 0,
          population: Math.max(0, parseInt(valuesByName[entry.name]?.population, 10) || 0),
        },
    })),
  });
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
  await recalculateCardValuesInDb();

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
  await recalculateCardValuesInDb();

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
    res.send({ ok: false, packs: normalizePacksMap(packs), openedCards: [] });
    return;
  }

  const cardsPoolByRarity = await persistence.getCardsPoolByRarity();
  const generatedCards = drawPackCardsFromDbPool(packName, cardsPoolByRarity);

  const generatedCardNames = generatedCards.map((card) => card.name);

  if (generatedCardNames.length === 0) {
    res.send({ ok: false, packs: normalizePacksMap(packs), openedCards: [] });
    return;
  }

  packs[packName] = Math.max(0, currentCount - 1);
  const profile = await ensureTradeProfile(userName, {});
  for (const cardName of generatedCardNames) {
    profile.cards[cardName] = normalizeQty(profile.cards[cardName]) + 1;
  }

  await persistence.setUserPacks(userName, packs);
  await persistence.setTradeProfileCards(userName, profile.cards);
  await persistence.incrementCardsPopulation(generatedCards);
  const nextState = await recalculateCardValuesInDb();
  const detailsByName = await persistence.getCardDetailsByNames(generatedCardNames);

  const openedCards = generatedCards.map((entry) => {
    const details = detailsByName[entry.name] || {};
    const liveState = nextState.valuesByName?.[entry.name] || {};
    return {
      name: entry.name,
      image: details.image || 'Default.png',
      cost: details.cost != null ? details.cost : '-',
      rarity: normalizeRarity(details.rarity || entry.rarity),
      cardType: details.cardType || 'Type',
      description: details.description || '',
      strength: details.strength != null ? details.strength : '-',
      endurance: details.endurance != null ? details.endurance : '-',
      author: details.author || 'Unknown',
      value: Number.isFinite(Number(liveState.value)) ? Number(liveState.value) : Number(details.value || 0),
      scarcity: Number.isFinite(Number(liveState.scarcity)) ? Number(liveState.scarcity) : 0,
      population: Number.isFinite(Number(liveState.population))
        ? Math.max(0, parseInt(liveState.population, 10) || 0)
        : Math.max(0, parseInt(details.population, 10) || 0),
    };
  });

  res.send({
    ok: true,
    packs: normalizePacksMap(packs),
    openedCards,
    valuesByName: nextState.valuesByName,
    totalPopulation: nextState.totalPopulation,
  });
});

app.post('/api/packs/claim', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  if (!userName) {
    res.send({ ok: false, ownedEntries: [] });
    return;
  }

  const profile = await ensureTradeProfile(userName, {});
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

  card.image = await resolveCardImageReference(card.image);

  if (Boolean(authUser.admin)) {
    const approvedRarity = normalizeRarity(card.rarity);
    await persistence.upsertApprovedCardToCards(name, {
      ...card,
      rarity: approvedRarity,
    });
    await persistence.upsertCardCatalogEntries([{ name, rarity: approvedRarity }]);
    await recalculateCardValuesInDb();
    await persistence.deletePendingApproval(name);

    res.send({
      ok: true,
      bypassedApproval: true,
      approvedCard: {
        name,
        card: {
          ...card,
          rarity: approvedRarity,
        },
      },
    });
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

  nextCard.image = await resolveCardImageReference(nextCard.image);

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

  const card = {
    ...(pending.card || {}),
    image: await resolveCardImageReference(pending?.card?.image),
  };
  const approvedRarity = normalizeRarity(card?.rarity);

  await persistence.upsertApprovedCardToCards(name, {
    ...card,
    rarity: approvedRarity,
  });
  await persistence.upsertCardCatalogEntries([{ name, rarity: approvedRarity }]);
  await recalculateCardValuesInDb();
  await persistence.deletePendingApproval(name);

  res.send({
    ok: true,
    approvedCard: {
      name,
      card: {
        ...card,
        rarity: approvedRarity,
      },
    },
  });
});

app.get('/api/admin/cards/designs', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  if (!Boolean(authUser.admin)) {
    res.status(403).send({ msg: 'Forbidden' });
    return;
  }

  const cards = await persistence.listAllCardDesigns();
  res.send({ cards });
});

app.put('/api/admin/cards/designs', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  if (!Boolean(authUser.admin)) {
    res.status(403).send({ msg: 'Forbidden' });
    return;
  }

  const originalName = sanitizeCardName(req.body?.originalName);
  const nextName = sanitizeCardName(req.body?.nextName);
  const nextCard = normalizePendingCard(req.body?.card);

  if (!originalName || !nextName || !nextCard) {
    res.send({ ok: false, error: 'Invalid card edit request' });
    return;
  }

  nextCard.image = await resolveCardImageReference(nextCard.image);

  const update = await persistence.updateCardDesignInCards(originalName, nextName, nextCard);
  if (!update?.ok) {
    res.send({ ok: false, error: update?.error || 'Unable to update card' });
    return;
  }

  const approvedRarity = normalizeRarity(nextCard.rarity);
  await persistence.upsertCardCatalogEntries([{ name: nextName, rarity: approvedRarity }]);
  await recalculateCardValuesInDb();

  res.send({
    ok: true,
    updatedCard: {
      name: nextName,
      card: {
        ...nextCard,
        rarity: approvedRarity,
      },
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

app.get('/api/preferences/deck-duplicates', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.query?.userName);
  const current = await ensureDeckShowDuplicatesPreference(userName, true);
  res.send({ showDuplicates: current });
});

app.put('/api/preferences/deck-duplicates', async (req, res) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).send({ msg: 'Unauthorized' });
    return;
  }

  const userName = sanitizeUsername(req.body?.userName);
  const showDuplicates = normalizeShowDuplicates(req.body?.showDuplicates);
  await persistence.setDeckShowDuplicatesPreference(userName, showDuplicates);
  const current = await ensureDeckShowDuplicatesPreference(userName, showDuplicates);
  res.send({ ok: true, showDuplicates: current });
});

async function createUser(username, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  return await persistence.createUser(username, passwordHash);
}

function sanitizeOpenedCards(openedCards) {
  if (!Array.isArray(openedCards)) return [];
  return openedCards
    .map((card) => {
      const name = sanitizeCardName(card?.name || card);
      if (!name) return null;
      return {
        name,
        rarity: normalizeRarity(card?.rarity),
      };
    })
    .filter(Boolean);
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

async function resolveCardImageReference(imageValue) {
  const image = String(imageValue || '').trim();
  if (!image) return 'Default.png';

  if (image.startsWith('cardimg:')) {
    return image;
  }

  if (image.startsWith('data:')) {
    const imageId = await persistence.saveCardImageDataUrl(image);
    return imageId ? `cardimg:${imageId}` : 'Default.png';
  }

  return image;
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

function normalizeShowDuplicates(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const next = value.trim().toLowerCase();
    if (next === 'true') return true;
    if (next === 'false') return false;
  }
  return true;
}

function normalizeRarity(value) {
  const rarity = String(value || '').trim();
  if (
    rarity === 'Common' ||
    rarity === 'Uncommon' ||
    rarity === 'Rare' ||
    rarity === 'Loric' ||
    rarity === 'Mythical' ||
    rarity === 'Legendary'
  ) {
    return rarity;
  }
  return 'Common';
}

async function ensureDeckSortPreference(userName, fallbackSort) {
  if (!userName) {
    return normalizeDeckSort(fallbackSort);
  }

  return await persistence.ensureDeckSortPreference(userName, fallbackSort);
}

async function ensureDeckShowDuplicatesPreference(userName, fallbackShowDuplicates) {
  if (!userName) {
    return normalizeShowDuplicates(fallbackShowDuplicates);
  }

  return await persistence.ensureDeckShowDuplicatesPreference(userName, fallbackShowDuplicates);
}

async function recalculateCardValuesInDb() {
  return await persistence.recalculateAndStoreCardValues();
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

const PACK_OPEN_RULES = {
  'Default Pack': {
    quantity: 10,
    rarityWeights: {
      Common: 47,
      Uncommon: 28,
      Rare: 14,
      Loric: 7,
      Mythical: 3,
      Legendary: 1,
    },
  },
  'Saga Pack': {
    quantity: 10,
    rarityWeights: {
      Common: 32,
      Uncommon: 30,
      Rare: 23,
      Loric: 7,
      Mythical: 7,
      Legendary: 1,
    },
  },
  'Heroic Pack': {
    quantity: 10,
    rarityWeights: {
      Common: 0,
      Uncommon: 35,
      Rare: 30,
      Loric: 18,
      Mythical: 12,
      Legendary: 5,
    },
  },
  'Mythbound Pack': {
    quantity: 10,
    rarityWeights: {
      Common: 0,
      Uncommon: 0,
      Rare: 40,
      Loric: 30,
      Mythical: 20,
      Legendary: 10,
    },
  },
};

function drawPackCardsFromDbPool(packName, cardsPoolByRarity) {
  const rule = PACK_OPEN_RULES[packName];
  if (!rule) return [];

  const weightedRarities = Object.entries(rule.rarityWeights || {})
    .map(([rarity, weight]) => ({
      rarity,
      weight: Math.max(0, Number(weight) || 0),
      names: Array.isArray(cardsPoolByRarity?.[rarity]) ? cardsPoolByRarity[rarity] : [],
    }))
    .filter((entry) => entry.weight > 0 && entry.names.length > 0);

  if (weightedRarities.length === 0) {
    return [];
  }

  const totalWeight = weightedRarities.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return [];
  }

  const pickRarity = () => {
    let roll = Math.random() * totalWeight;
    for (const entry of weightedRarities) {
      roll -= entry.weight;
      if (roll < 0) return entry;
    }
    return weightedRarities[weightedRarities.length - 1];
  };

  const count = Math.max(0, parseInt(rule.quantity, 10) || 0);
  const picks = [];
  for (let i = 0; i < count; i += 1) {
    const rarityEntry = pickRarity();
    const names = rarityEntry.names;
    const chosenName = names[Math.floor(Math.random() * names.length)];
    if (chosenName) {
      picks.push({
        name: chosenName,
        rarity: rarityEntry.rarity,
      });
    }
  }

  return picks;
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

if (distPath) {
  app.use(express.static(distPath));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn(
    `Frontend build output not found. API routes will still run. Checked: ${staticCandidates.join(', ')}`
  );
}

const port = 4000;

(async () => {
  await persistence.initPersistence();
  await recalculateCardValuesInDb();

  app.listen(port, function () {
    console.log(`Listening on port ${port}`);
  });
})().catch((error) => {
  console.error('Failed to initialize backend persistence', error);
  process.exit(1);
});