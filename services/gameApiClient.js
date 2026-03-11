import { getCardByName } from '../src/data/cards';
import { getUser, users } from '../src/data/users';
import { storageService } from './storageService';

function normalizeQty(value) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function normalizeWalletValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
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

async function applyOwnedEntriesToActiveUser(userName, activeUserCards, ownedEntries) {
  if (!Array.isArray(ownedEntries)) return;

  const normalizedMap = {};
  for (const entry of ownedEntries) {
    if (!entry?.name) continue;
    const qty = normalizeQty(entry.qty);
    if (qty > 0) {
      normalizedMap[entry.name] = qty;
    }
  }

  if (activeUserCards && typeof activeUserCards === 'object') {
    for (const key of Object.keys(activeUserCards)) {
      delete activeUserCards[key];
    }
    Object.assign(activeUserCards, normalizedMap);
  }

  if (userName) {
    const persistableEntries = Object.entries(normalizedMap).map(([name, qty]) => ({
      name,
      qty,
      card: getCardByName(name),
    }));
    await storageService.setOwnedCards(userName, persistableEntries);
  }
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

  const response = await requestTradeApi('/api/trades/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ usersMap: toUserSnapshot() }),
  });

  if (response && response.ok) {
    hasBootstrappedProfiles = true;
  }
}

export const gameApiClient = {
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

    let sourceEntries;
    if (Array.isArray(response?.ownedEntries)) {
      sourceEntries = response.ownedEntries;
    } else {
      const cachedOwned = await storageService.getOwnedCards(userName);
      if (Array.isArray(cachedOwned) && cachedOwned.length > 0) {
        sourceEntries = cachedOwned;
      } else {
        sourceEntries = Object.entries(fallbackCards || {}).map(([name, qty]) => ({ name, qty }));
      }
    }

    await applyOwnedEntriesToActiveUser(userName, fallbackCards, sourceEntries);

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
    await applyOwnedEntriesToActiveUser(userName, activeUserCards, response.ownedEntries);
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
    await applyOwnedEntriesToActiveUser(userName, activeUserCards, response.ownedEntries);
  },

  async cancelTrade(userName, selectedTradeCards, activeUserCards) {
    if (!userName) return;

    const response = await requestTradeApi('/api/trades/cancel', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        selectedTradeCards: Array.isArray(selectedTradeCards) ? selectedTradeCards : [],
        fallbackCards: activeUserCards || {},
      }),
    });

    if (!response) return;
    await applyOwnedEntriesToActiveUser(userName, activeUserCards, response.ownedEntries);
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

    if (!response) {
      return { nextActiveOwned: [], nextTargetOwned: [] };
    }

    const nextActiveOwned = Array.isArray(response?.nextActiveOwned) ? response.nextActiveOwned : [];
    const nextTargetOwned = Array.isArray(response?.nextTargetOwned) ? response.nextTargetOwned : [];

    if (activeUser) {
      activeUser.cards = Object.fromEntries(
        nextActiveOwned.map((entry) => [entry.name, normalizeQty(entry.qty)])
      );
    }

    await applyOwnedEntriesToActiveUser(activeUserName, activeUser?.cards, nextActiveOwned);

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

  async loadBankInventory(fallbackEntries = []) {
    const response = await requestTradeApi('/api/bank/inventory', {
      method: 'POST',
      body: JSON.stringify({
        fallbackEntries: Array.isArray(fallbackEntries) ? fallbackEntries : [],
      }),
    });

    const bankEntries = Array.isArray(response?.bankEntries) ? response.bankEntries : [];
    return bankEntries
      .map(({ name, qty }) => {
        const card = getCardByName(name);
        const normalizedQty = normalizeQty(qty);
        if (!card || normalizedQty <= 0) return null;
        return { name, qty: normalizedQty, card };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async buyBankCard(userName, cardName, buyPrice, fallbackCards = {}, fallbackWallet = 0) {
    if (!userName || !cardName) {
      return { ok: false, bankEntries: [], ownedEntries: [], wallet: fallbackWallet };
    }

    await ensureBootstrap();

    const response = await requestTradeApi('/api/bank/buy', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        cardName,
        buyPrice,
        fallbackCards,
        fallbackWallet,
      }),
    });

    if (!response) {
      return { ok: false, bankEntries: [], ownedEntries: [], wallet: fallbackWallet };
    }

    await applyOwnedEntriesToActiveUser(userName, fallbackCards, response.ownedEntries);

    return {
      ok: Boolean(response.ok),
      bankEntries: Array.isArray(response.bankEntries) ? response.bankEntries : [],
      ownedEntries: Array.isArray(response.ownedEntries) ? response.ownedEntries : [],
      wallet: Number.isFinite(Number(response.wallet)) ? Number(response.wallet) : fallbackWallet,
    };
  },

  async sellBankCard(userName, cardName, payoutAmount, fallbackCards = {}, fallbackWallet = 0) {
    if (!userName || !cardName) {
      return { ok: false, bankEntries: [], ownedEntries: [], wallet: fallbackWallet };
    }

    await ensureBootstrap();

    const response = await requestTradeApi('/api/bank/sell', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        cardName,
        payoutAmount,
        fallbackCards,
        fallbackWallet,
      }),
    });

    if (!response) {
      return { ok: false, bankEntries: [], ownedEntries: [], wallet: fallbackWallet };
    }

    await applyOwnedEntriesToActiveUser(userName, fallbackCards, response.ownedEntries);

    return {
      ok: Boolean(response.ok),
      bankEntries: Array.isArray(response.bankEntries) ? response.bankEntries : [],
      ownedEntries: Array.isArray(response.ownedEntries) ? response.ownedEntries : [],
      wallet: Number.isFinite(Number(response.wallet)) ? Number(response.wallet) : fallbackWallet,
    };
  },

  async loadPackState(userName, fallbackPacks = {}, fallbackWallet = 0) {
    if (!userName) {
      return { ok: false, packs: normalizePacksMap(fallbackPacks), wallet: normalizeWalletValue(fallbackWallet) };
    }

    const response = await requestTradeApi('/api/packs/state', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        fallbackPacks,
        fallbackWallet,
      }),
    });

    if (!response) {
      return { ok: false, packs: normalizePacksMap(fallbackPacks), wallet: normalizeWalletValue(fallbackWallet) };
    }

    return {
      ok: Boolean(response.ok),
      packs: normalizePacksMap(response.packs || fallbackPacks),
      wallet: normalizeWalletValue(response.wallet),
    };
  },

  async buyPack(userName, packName, packPrice, fallbackPacks = {}, fallbackWallet = 0) {
    if (!userName || !packName) {
      return { ok: false, packs: normalizePacksMap(fallbackPacks), wallet: normalizeWalletValue(fallbackWallet) };
    }

    const response = await requestTradeApi('/api/packs/buy', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        packName,
        packPrice,
        fallbackPacks,
        fallbackWallet,
      }),
    });

    if (!response) {
      return { ok: false, packs: normalizePacksMap(fallbackPacks), wallet: normalizeWalletValue(fallbackWallet) };
    }

    return {
      ok: Boolean(response.ok),
      packs: normalizePacksMap(response.packs || fallbackPacks),
      wallet: normalizeWalletValue(response.wallet),
    };
  },

  async openPack(userName, packName, fallbackPacks = {}) {
    if (!userName || !packName) {
      return { ok: false, packs: normalizePacksMap(fallbackPacks) };
    }

    const response = await requestTradeApi('/api/packs/open', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        packName,
        fallbackPacks,
      }),
    });

    if (!response) {
      return { ok: false, packs: normalizePacksMap(fallbackPacks) };
    }

    return {
      ok: Boolean(response.ok),
      packs: normalizePacksMap(response.packs || fallbackPacks),
    };
  },

  async claimOpenedPackCards(userName, openedCards, fallbackCards = {}) {
    if (!userName) {
      return { ok: false };
    }

    await ensureBootstrap();

    const response = await requestTradeApi('/api/packs/claim', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        openedCards: Array.isArray(openedCards) ? openedCards : [],
        fallbackCards,
      }),
    });

    if (!response) {
      return { ok: false };
    }

    await applyOwnedEntriesToActiveUser(userName, fallbackCards, response.ownedEntries);
    return { ok: Boolean(response.ok) };
  },

  async submitDesignerProgress(userName, fallbackDesigned = 0, fallbackPacks = {}) {
    if (!userName) {
      return {
        ok: false,
        nextDesigned: normalizeQty(fallbackDesigned),
        rewardPackKey: 'Default Pack',
        packs: normalizePacksMap(fallbackPacks),
      };
    }

    const response = await requestTradeApi('/api/designer/submit', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        fallbackDesigned,
        fallbackPacks,
      }),
    });

    if (!response) {
      return {
        ok: false,
        nextDesigned: normalizeQty(fallbackDesigned),
        rewardPackKey: 'Default Pack',
        packs: normalizePacksMap(fallbackPacks),
      };
    }

    return {
      ok: Boolean(response.ok),
      nextDesigned: normalizeQty(response.nextDesigned),
      rewardPackKey: response.rewardPackKey || 'Default Pack',
      packs: normalizePacksMap(response.packs || fallbackPacks),
    };
  },

  async loadPendingApprovals() {
    const response = await requestTradeApi('/api/approvals/pending', { method: 'GET' });
    const pendingCards = Array.isArray(response?.pendingCards) ? response.pendingCards : [];
    return pendingCards
      .map((entry) => {
        if (!entry?.name || !entry?.card) return null;
        return {
          name: entry.name,
          card: {
            ...entry.card,
            name: entry.name,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async submitPendingApprovalCard(name, card) {
    const response = await requestTradeApi('/api/approvals/pending', {
      method: 'POST',
      body: JSON.stringify({ name, card }),
    });

    return {
      ok: Boolean(response?.ok),
      error: response?.error || '',
    };
  },

  async updatePendingApprovalCard(originalName, nextName, card) {
    const response = await requestTradeApi('/api/approvals/pending', {
      method: 'PUT',
      body: JSON.stringify({ originalName, nextName, card }),
    });

    return {
      ok: Boolean(response?.ok),
      error: response?.error || '',
    };
  },

  async discardPendingApprovalCard(name) {
    const response = await requestTradeApi(`/api/approvals/pending?name=${encodeURIComponent(name || '')}`, {
      method: 'DELETE',
    });

    return { ok: Boolean(response?.ok) };
  },

  async approvePendingApprovalCard(name) {
    const response = await requestTradeApi('/api/approvals/approve', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    return {
      ok: Boolean(response?.ok),
      error: response?.error || '',
      approvedCard: response?.approvedCard || null,
    };
  },
};
