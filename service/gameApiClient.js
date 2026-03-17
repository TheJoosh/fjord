import { getCardByName } from '../src/data/cards';

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

export const gameApiClient = {
  async loadUserProfile() {
    const response = await requestTradeApi('/api/user/profile', {
      method: 'GET',
    });

    if (!response) {
      return { ok: false, username: '', admin: false, wallet: 0 };
    }

    return {
      ok: true,
      username: String(response.username || ''),
      admin: Boolean(response.admin),
      wallet: normalizeWalletValue(response.wallet),
    };
  },

  getCurrentCardValue(cardLike) {
    if (!cardLike?.name) return 0;
    const latest = getCardByName(cardLike.name);
    if (latest && typeof latest.value === 'number') {
      return latest.value;
    }
    return cardLike && typeof cardLike.value === 'number' ? cardLike.value : 0;
  },

  async buildOwnedDeckCards(userName) {
    if (!userName) return [];

    const response = await requestTradeApi('/api/trades/owned', {
      method: 'POST',
      body: JSON.stringify({ userName }),
    });

    const sourceEntries = Array.isArray(response?.ownedEntries) ? response.ownedEntries : [];

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

  async requestTradeUser(currentUserName, requestUserInput) {
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

  async transferCardFromOwnedToTrade(userName, cardName) {
    if (!userName || !cardName) return;

    const response = await requestTradeApi('/api/trades/owned/decrement', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        cardName,
      }),
    });

    if (!response) return;
  },

  async returnCardFromTradeSelection(userName, cardName) {
    if (!userName || !cardName) return;

    const response = await requestTradeApi('/api/trades/owned/increment', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        cardName,
      }),
    });

    if (!response) return;
  },

  async cancelTrade(userName, selectedTradeCards) {
    if (!userName) return;

    const response = await requestTradeApi('/api/trades/cancel', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        selectedTradeCards: Array.isArray(selectedTradeCards) ? selectedTradeCards : [],
      }),
    });

    if (!response) return;
  },

  async acceptTrade(activeUserName, otherUserName, selectedTradeCards, otherTradeCards) {
    if (!activeUserName || !otherUserName) {
      return { nextActiveOwned: [], nextTargetOwned: [] };
    }

    const response = await requestTradeApi('/api/trades/accept', {
      method: 'POST',
      body: JSON.stringify({
        activeUserName,
        otherUserName,
        selectedTradeCards: Array.isArray(selectedTradeCards) ? selectedTradeCards : [],
        otherTradeCards: Array.isArray(otherTradeCards) ? otherTradeCards : [],
      }),
    });

    if (!response) {
      return { nextActiveOwned: [], nextTargetOwned: [] };
    }

    const nextActiveOwned = Array.isArray(response?.nextActiveOwned) ? response.nextActiveOwned : [];
    const nextTargetOwned = Array.isArray(response?.nextTargetOwned) ? response.nextTargetOwned : [];

    return {
      nextActiveOwned: hydrateCards(nextActiveOwned),
      nextTargetOwned: hydrateCards(nextTargetOwned),
    };
  },

  async loadBankInventory() {
    const response = await requestTradeApi('/api/bank/inventory', {
      method: 'POST',
      body: JSON.stringify({}),
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

  async buyBankCard(userName, cardName, buyPrice) {
    if (!userName || !cardName) {
      return { ok: false, bankEntries: [], ownedEntries: [], wallet: 0 };
    }

    const response = await requestTradeApi('/api/bank/buy', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        cardName,
        buyPrice,
      }),
    });

    if (!response) {
      return { ok: false, bankEntries: [], ownedEntries: [], wallet: 0 };
    }

    return {
      ok: Boolean(response.ok),
      bankEntries: Array.isArray(response.bankEntries) ? response.bankEntries : [],
      ownedEntries: Array.isArray(response.ownedEntries) ? response.ownedEntries : [],
      wallet: Number.isFinite(Number(response.wallet)) ? Number(response.wallet) : 0,
    };
  },

  async sellBankCard(userName, cardName, payoutAmount) {
    if (!userName || !cardName) {
      return { ok: false, bankEntries: [], ownedEntries: [], wallet: 0 };
    }

    const response = await requestTradeApi('/api/bank/sell', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        cardName,
        payoutAmount,
      }),
    });

    if (!response) {
      return { ok: false, bankEntries: [], ownedEntries: [], wallet: 0 };
    }

    return {
      ok: Boolean(response.ok),
      bankEntries: Array.isArray(response.bankEntries) ? response.bankEntries : [],
      ownedEntries: Array.isArray(response.ownedEntries) ? response.ownedEntries : [],
      wallet: Number.isFinite(Number(response.wallet)) ? Number(response.wallet) : 0,
    };
  },

  async loadPackState(userName) {
    if (!userName) {
      return { ok: false, packs: normalizePacksMap({}), wallet: 0 };
    }

    const response = await requestTradeApi('/api/packs/state', {
      method: 'POST',
      body: JSON.stringify({
        userName,
      }),
    });

    if (!response) {
      return { ok: false, packs: normalizePacksMap({}), wallet: 0 };
    }

    return {
      ok: Boolean(response.ok),
      packs: normalizePacksMap(response.packs || {}),
      wallet: normalizeWalletValue(response.wallet),
    };
  },

  async buyPack(userName, packName, packPrice) {
    if (!userName || !packName) {
      return { ok: false, packs: normalizePacksMap({}), wallet: 0 };
    }

    const response = await requestTradeApi('/api/packs/buy', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        packName,
        packPrice,
      }),
    });

    if (!response) {
      return { ok: false, packs: normalizePacksMap({}), wallet: 0 };
    }

    return {
      ok: Boolean(response.ok),
      packs: normalizePacksMap(response.packs || {}),
      wallet: normalizeWalletValue(response.wallet),
    };
  },

  async openPack(userName, packName) {
    if (!userName || !packName) {
      return { ok: false, packs: normalizePacksMap({}) };
    }

    const response = await requestTradeApi('/api/packs/open', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        packName,
      }),
    });

    if (!response) {
      return { ok: false, packs: normalizePacksMap({}) };
    }

    return {
      ok: Boolean(response.ok),
      packs: normalizePacksMap(response.packs || {}),
    };
  },

  async claimOpenedPackCards(userName, openedCards) {
    if (!userName) {
      return { ok: false };
    }

    const response = await requestTradeApi('/api/packs/claim', {
      method: 'POST',
      body: JSON.stringify({
        userName,
        openedCards: Array.isArray(openedCards) ? openedCards : [],
      }),
    });

    if (!response) {
      return { ok: false };
    }

    return { ok: Boolean(response.ok) };
  },

  async submitDesignerProgress(userName) {
    if (!userName) {
      return {
        ok: false,
        nextDesigned: 0,
        rewardPackKey: 'Default Pack',
        packs: normalizePacksMap({}),
      };
    }

    const response = await requestTradeApi('/api/designer/submit', {
      method: 'POST',
      body: JSON.stringify({
        userName,
      }),
    });

    if (!response) {
      return {
        ok: false,
        nextDesigned: 0,
        rewardPackKey: 'Default Pack',
        packs: normalizePacksMap({}),
      };
    }

    return {
      ok: Boolean(response.ok),
      nextDesigned: normalizeQty(response.nextDesigned),
      rewardPackKey: response.rewardPackKey || 'Default Pack',
      packs: normalizePacksMap(response.packs || {}),
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

  async loadDeckSortPreference(userName, fallbackSort = 'Rarity') {
    if (!userName) return fallbackSort;

    const response = await requestTradeApi(
      `/api/preferences/deck-sort?userName=${encodeURIComponent(userName)}`,
      { method: 'GET' }
    );

    const sortBy = String(response?.sortBy || fallbackSort);
    return sortBy === 'Value' || sortBy === 'Name' || sortBy === 'Rarity' ? sortBy : 'Rarity';
  },

  async saveDeckSortPreference(userName, sortBy) {
    if (!userName) return;
    await requestTradeApi('/api/preferences/deck-sort', {
      method: 'PUT',
      body: JSON.stringify({ userName, sortBy }),
    });
  },
};
