import { getCardByName } from '../src/data/cards';
import { getUser, users } from '../src/data/users';

function normalizeQty(value) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function toUserSnapshot() {
  const snapshot = {};
  for (const [name, profile] of Object.entries(users || {})) {
    snapshot[name] = {
      cards: { ...(profile?.cards || {}) },
    };
  }
  return snapshot;
}

function hydrateCard(cardLike) {
  if (!cardLike?.name) return cardLike;
  const latest = getCardByName(cardLike.name);
  if (!latest) return cardLike;
  return { ...latest, ...cardLike };
}

function hydrateCards(cards) {
  return (cards || []).map((card) => hydrateCard(card));
}

async function requestTradeApi(path, options = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

let hasBootstrappedProfiles = false;

async function ensureBootstrap() {
  if (hasBootstrappedProfiles) return;

  await requestTradeApi('/api/trades/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ usersMap: toUserSnapshot() }),
  });

  hasBootstrappedProfiles = true;
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
    if (!userName) return [];
    await ensureBootstrap();

    const response = await requestTradeApi('/api/trades/owned', {
      method: 'POST',
      body: JSON.stringify({ userName, fallbackCards }),
    });

    const sourceEntries = Array.isArray(response?.ownedEntries)
      ? response.ownedEntries
      : Object.entries(fallbackCards || {}).map(([name, qty]) => ({ name, qty }));

    return sourceEntries
      .map(({ name, qty }) => {
        const card = getCardByName(name);
        const normalizedQty = normalizeQty(qty);
        if (!card || normalizedQty <= 0) return null;
        return { ...card, qty: normalizedQty };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async loadPendingTrade(userName) {
    if (!userName) {
      return { otherUserLabel: 'Other User', otherUserName: '', otherTradeCards: [] };
    }

    const parsedResponse = await requestTradeApi(
      `/api/trades/pending?userName=${encodeURIComponent(userName)}`,
      { method: 'GET' }
    );

    const parsed = parsedResponse?.pendingTrade;
    if (!parsed || typeof parsed !== 'object') {
      return { otherUserLabel: 'Other User', otherUserName: '', otherTradeCards: [] };
    }

    return {
      otherUserLabel: parsed.otherUserLabel || parsed.otherUserName || 'Other User',
      otherUserName: parsed.otherUserName || '',
      otherTradeCards: Array.isArray(parsed.otherTradeCards) ? hydrateCards(parsed.otherTradeCards) : [],
    };
  },

  async savePendingTrade(userName, pendingTrade) {
    await requestTradeApi('/api/trades/pending', {
      method: 'PUT',
      body: JSON.stringify({
        userName,
        pendingTrade: {
          otherUserName: pendingTrade?.otherUserName || '',
          otherUserLabel: pendingTrade?.otherUserLabel || pendingTrade?.otherUserName || '',
          otherTradeCards: Array.isArray(pendingTrade?.otherTradeCards)
            ? pendingTrade.otherTradeCards
            : [],
        },
      }),
    });
  },

  async loadSelectedTradeCards(userName) {
    if (!userName) return [];

    const parsedResponse = await requestTradeApi(
      `/api/trades/selection?userName=${encodeURIComponent(userName)}`,
      { method: 'GET' }
    );
    const parsed = parsedResponse?.selectedTradeCards;
    return Array.isArray(parsed) ? hydrateCards(parsed) : [];
  },

  async saveSelectedTradeCards(userName, selectedTradeCards) {
    await requestTradeApi('/api/trades/selection', {
      method: 'PUT',
      body: JSON.stringify({
        userName,
        selectedTradeCards: Array.isArray(selectedTradeCards) ? selectedTradeCards : [],
      }),
    });
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
    await ensureBootstrap();

    const response = await requestTradeApi('/api/trades/request-user', {
      method: 'POST',
      body: JSON.stringify({
        currentUserName,
        requestUserInput,
      }),
    });

    if (!response) {
      return { error: 'Unable to request trade user' };
    }

    if (response.error) {
      return { error: response.error };
    }

    return {
      otherUserLabel: response.otherUserLabel,
      otherUserName: response.otherUserName,
      otherTradeCards: hydrateCards(response.otherTradeCards || []),
    };
  },

  async transferCardFromOwnedToTrade(userName, cardName, activeUserCards) {
    if (!userName || !cardName) return;

    const response = await requestTradeApi('/api/trades/owned/decrement', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        cardName,
        fallbackCards: activeUserCards || {},
      }),
    });

    if (!response) return;

    if (activeUserCards) {
      const currentQty = normalizeQty(activeUserCards?.[cardName]);
      if (currentQty <= 1) {
        delete activeUserCards[cardName];
      } else {
        activeUserCards[cardName] = currentQty - 1;
      }
    }
  },

  async returnCardFromTradeSelection(userName, cardName, activeUserCards) {
    if (!userName || !cardName) return;

    const response = await requestTradeApi('/api/trades/owned/increment', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        cardName,
        fallbackCards: activeUserCards || {},
      }),
    });

    if (!response) return;

    if (activeUserCards) {
      activeUserCards[cardName] = normalizeQty(activeUserCards[cardName]) + 1;
    }
  },

  async cancelTrade(userName, selectedTradeCards, activeUserCards) {
    if (!userName) return;

    await requestTradeApi('/api/trades/cancel', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        selectedTradeCards: Array.isArray(selectedTradeCards) ? selectedTradeCards : [],
        fallbackCards: activeUserCards || {},
      }),
    });

    if (activeUserCards) {
      for (const card of selectedTradeCards || []) {
        if (!card?.name) continue;
        activeUserCards[card.name] = normalizeQty(activeUserCards[card.name]) + 1;
      }
    }
  },

  async acceptTrade(activeUserName, otherUserName, selectedTradeCards, otherTradeCards) {
    if (!activeUserName || !otherUserName) {
      return { nextActiveOwned: [], nextTargetOwned: [] };
    }

    const activeUser = getUser(activeUserName);
    const targetUser = getUser(otherUserName);

    const response = await requestTradeApi('/api/trades/accept', {
      method: 'POST',
      body: JSON.stringify({
        activeUserName,
        otherUserName,
        selectedTradeCards: Array.isArray(selectedTradeCards) ? selectedTradeCards : [],
        otherTradeCards: Array.isArray(otherTradeCards) ? otherTradeCards : [],
        activeFallbackCards: activeUser?.cards || {},
        otherFallbackCards: targetUser?.cards || {},
      }),
    });

    const nextActiveOwned = Array.isArray(response?.nextActiveOwned) ? response.nextActiveOwned : [];
    const nextTargetOwned = Array.isArray(response?.nextTargetOwned) ? response.nextTargetOwned : [];

    if (activeUser) {
      activeUser.cards = Object.fromEntries(
        nextActiveOwned.map((entry) => [entry.name, normalizeQty(entry.qty)])
      );
    }

    if (targetUser) {
      targetUser.cards = Object.fromEntries(
        nextTargetOwned.map((entry) => [entry.name, normalizeQty(entry.qty)])
      );
    }

    return {
      nextActiveOwned: hydrateCards(nextActiveOwned),
      nextTargetOwned: hydrateCards(nextTargetOwned),
    };
  },
};
