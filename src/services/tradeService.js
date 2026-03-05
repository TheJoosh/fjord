import { getCardByName } from '../data/cards';
import { getUser, users } from '../data/users';
import { storageService } from './storageService';

function normalizeQty(value) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function toCountMap(entries) {
  const byName = new Map();
  for (const entry of entries || []) {
    if (!entry?.name) continue;
    byName.set(entry.name, (byName.get(entry.name) || 0) + normalizeQty(entry.qty));
  }
  return byName;
}

function toOwnedArray(map) {
  return Array.from(map.entries())
    .filter(([, qty]) => qty > 0)
    .map(([name, qty]) => ({
      name,
      qty,
      card: getCardByName(name),
    }));
}

function getPendingTradeStorageKey(userName) {
  return userName ? `pendingTrade:${userName}` : 'pendingTrade';
}

function getTradeSelectionStorageKey(userName) {
  return userName ? `tradeSelection:${userName}` : 'tradeSelection';
}

async function loadOwnedMap(userName, fallbackCards) {
  const sourceEntries = await storageService.getOwnedCards(userName);
  if (sourceEntries.length > 0) {
    return toCountMap(sourceEntries);
  }

  return toCountMap(
    Object.entries(fallbackCards || {}).map(([name, qty]) => ({ name, qty }))
  );
}

export const tradeService = {
  getCurrentCardValue(cardLike) {
    if (!cardLike?.name) return 0;
    const latest = getCardByName(cardLike.name);
    if (latest && typeof latest.value === 'number') {
      return latest.value;
    }
    return cardLike && typeof cardLike.value === 'number' ? cardLike.value : 0;
  },

  async buildOwnedDeckCards(userName, fallbackCards = {}) {
    const sourceEntries = userName ? await storageService.getOwnedCards(userName) : [];
    const byName = new Map();

    if (sourceEntries.length > 0) {
      for (const entry of sourceEntries) {
        if (!entry?.name) continue;
        byName.set(entry.name, (byName.get(entry.name) || 0) + normalizeQty(entry.qty));
      }
    } else {
      for (const [name, qty] of Object.entries(fallbackCards)) {
        byName.set(name, normalizeQty(qty));
      }
    }

    return Array.from(byName.entries())
      .map(([name, qty]) => {
        const card = getCardByName(name);
        if (!card || qty <= 0) return null;
        return { ...card, qty };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async loadPendingTrade(userName) {
    const parsed = await storageService.getJson(getPendingTradeStorageKey(userName), null);
    if (!parsed || typeof parsed !== 'object') {
      return { otherUserLabel: 'Other User', otherUserName: '', otherTradeCards: [] };
    }

    return {
      otherUserLabel: parsed.otherUserLabel || parsed.otherUserName || 'Other User',
      otherUserName: parsed.otherUserName || '',
      otherTradeCards: Array.isArray(parsed.otherTradeCards) ? parsed.otherTradeCards : [],
    };
  },

  async savePendingTrade(userName, pendingTrade) {
    const { otherUserName, otherUserLabel, otherTradeCards } = pendingTrade || {};
    const storageKey = getPendingTradeStorageKey(userName);

    if (!otherUserName) {
      await storageService.remove(storageKey);
      return;
    }

    await storageService.setJson(storageKey, {
      otherUserName,
      otherUserLabel: otherUserLabel || otherUserName,
      otherTradeCards: Array.isArray(otherTradeCards) ? otherTradeCards : [],
    });
  },

  async loadSelectedTradeCards(userName) {
    const parsed = await storageService.getJson(getTradeSelectionStorageKey(userName), []);
    return Array.isArray(parsed) ? parsed : [];
  },

  async saveSelectedTradeCards(userName, selectedTradeCards) {
    await storageService.setJson(
      getTradeSelectionStorageKey(userName),
      Array.isArray(selectedTradeCards) ? selectedTradeCards : []
    );
  },

  async resolveUserName(inputName) {
    const target = (inputName || '').trim();
    if (!target) return null;

    const parsedUsers = await storageService.getUsersMap();
    const keys = Object.keys(parsedUsers);
    const exact = keys.find((name) => name === target);
    if (exact) return exact;
    const insensitive = keys.find((name) => name.toLowerCase() === target.toLowerCase());
    if (insensitive) return insensitive;

    const fallbackKeys = Object.keys(users || {});
    const exactFallback = fallbackKeys.find((name) => name === target);
    if (exactFallback) return exactFallback;
    return fallbackKeys.find((name) => name.toLowerCase() === target.toLowerCase()) || null;
  },

  async requestTradeUser(currentUserName, requestUserInput) {
    const matchedUserName = await this.resolveUserName(requestUserInput);
    if (!matchedUserName) {
      return { error: 'User not found' };
    }

    if (currentUserName && matchedUserName.toLowerCase() === currentUserName.toLowerCase()) {
      return { error: 'You cannot request a trade with yourself' };
    }

    let sourceEntries = await storageService.getOwnedCards(matchedUserName);
    if (!sourceEntries.length) {
      const fallbackUser = getUser(matchedUserName);
      sourceEntries = Object.entries(fallbackUser?.cards || {}).map(([name, qty]) => ({
        name,
        qty: normalizeQty(qty),
      }));
    }

    const pool = [];
    for (const entry of sourceEntries) {
      if (!entry?.name) continue;
      const qty = normalizeQty(entry.qty);
      const card = getCardByName(entry.name);
      if (!card || qty <= 0) continue;
      for (let i = 0; i < qty; i += 1) {
        pool.push({ ...card });
      }
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const pickCount = Math.min(
      shuffled.length,
      Math.max(1, Math.floor(Math.random() * 5) + 1)
    );

    const otherTradeCards = shuffled.slice(0, pickCount).map((card, index) => ({
      ...card,
      otherTradeEntryId: `${card.name}-${Date.now()}-${index}-${Math.random()}`,
    }));

    return {
      otherUserLabel: matchedUserName,
      otherUserName: matchedUserName,
      otherTradeCards,
    };
  },

  async transferCardFromOwnedToTrade(userName, cardName, activeUserCards) {
    if (!userName || !cardName) return;

    const currentQty = normalizeQty(activeUserCards?.[cardName]);
    if (activeUserCards && currentQty > 0) {
      if (currentQty <= 1) {
        delete activeUserCards[cardName];
      } else {
        activeUserCards[cardName] = currentQty - 1;
      }
    }

    const sourceEntries = await storageService.getOwnedCards(userName);
    const byName = new Map();

    if (sourceEntries.length > 0) {
      for (const entry of sourceEntries) {
        if (!entry?.name) continue;
        byName.set(entry.name, (byName.get(entry.name) || 0) + normalizeQty(entry.qty));
      }
    } else {
      for (const [name, qty] of Object.entries(activeUserCards || {})) {
        byName.set(name, normalizeQty(qty));
      }
    }

    const nextQty = Math.max(0, (byName.get(cardName) || 0) - 1);
    if (nextQty > 0) {
      byName.set(cardName, nextQty);
    } else {
      byName.delete(cardName);
    }

    await storageService.setOwnedCards(userName, toOwnedArray(byName));
  },

  async returnCardFromTradeSelection(userName, cardName, activeUserCards) {
    if (!userName || !cardName) return;

    if (activeUserCards) {
      activeUserCards[cardName] = normalizeQty(activeUserCards[cardName]) + 1;
    }

    const sourceEntries = await storageService.getOwnedCards(userName);
    const byName = new Map();

    for (const entry of sourceEntries) {
      if (!entry?.name) continue;
      byName.set(entry.name, (byName.get(entry.name) || 0) + normalizeQty(entry.qty));
    }

    byName.set(cardName, (byName.get(cardName) || 0) + 1);
    await storageService.setOwnedCards(userName, toOwnedArray(byName));
  },

  async cancelTrade(userName, selectedTradeCards, activeUserCards) {
    if (!selectedTradeCards?.length || !userName) return;

    const restoreCounts = new Map();
    for (const card of selectedTradeCards) {
      if (!card?.name) continue;
      restoreCounts.set(card.name, (restoreCounts.get(card.name) || 0) + 1);
    }

    if (activeUserCards) {
      for (const [name, qty] of restoreCounts.entries()) {
        activeUserCards[name] = normalizeQty(activeUserCards[name]) + qty;
      }
    }

    const sourceEntries = await storageService.getOwnedCards(userName);
    const byName = new Map();
    for (const entry of sourceEntries) {
      if (!entry?.name) continue;
      byName.set(entry.name, (byName.get(entry.name) || 0) + normalizeQty(entry.qty));
    }

    for (const [name, qty] of restoreCounts.entries()) {
      byName.set(name, (byName.get(name) || 0) + qty);
    }

    await storageService.setOwnedCards(userName, toOwnedArray(byName));
  },

  async acceptTrade(activeUserName, otherUserName, selectedTradeCards, otherTradeCards) {
    if (!activeUserName || !otherUserName) {
      return { nextActiveOwned: [], nextTargetOwned: [] };
    }

    const activeUser = getUser(activeUserName);
    const targetUser = getUser(otherUserName);
    const activeOwnedMap = await loadOwnedMap(activeUserName, activeUser?.cards || {});
    const otherOwnedMap = await loadOwnedMap(otherUserName, targetUser?.cards || {});

    const activeToOtherCounts = new Map();
    for (const card of selectedTradeCards || []) {
      if (!card?.name) continue;
      activeToOtherCounts.set(card.name, (activeToOtherCounts.get(card.name) || 0) + 1);
    }

    const otherToActiveCounts = new Map();
    for (const card of otherTradeCards || []) {
      if (!card?.name) continue;
      otherToActiveCounts.set(card.name, (otherToActiveCounts.get(card.name) || 0) + 1);
    }

    for (const [name, qty] of activeToOtherCounts.entries()) {
      otherOwnedMap.set(name, (otherOwnedMap.get(name) || 0) + qty);
    }

    for (const [name, requestedQty] of otherToActiveCounts.entries()) {
      const available = otherOwnedMap.get(name) || 0;
      const movedQty = Math.min(available, requestedQty);
      if (movedQty <= 0) continue;

      otherOwnedMap.set(name, available - movedQty);
      activeOwnedMap.set(name, (activeOwnedMap.get(name) || 0) + movedQty);
    }

    const nextActiveOwned = toOwnedArray(activeOwnedMap);
    const nextTargetOwned = toOwnedArray(otherOwnedMap);

    await storageService.setOwnedCards(activeUserName, nextActiveOwned);
    await storageService.setOwnedCards(otherUserName, nextTargetOwned);

    if (activeUser) {
      activeUser.cards = Object.fromEntries(nextActiveOwned.map((entry) => [entry.name, entry.qty]));
    }

    if (targetUser) {
      targetUser.cards = Object.fromEntries(nextTargetOwned.map((entry) => [entry.name, entry.qty]));
    }

    return { nextActiveOwned, nextTargetOwned };
  },
};
