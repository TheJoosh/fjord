import { cardsByRarity, getCardByName } from '../src/data/cards';

let liveCardValuesByName = {};
let liveTotalPopulation = 0;

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
  const liveState = liveCardValuesByName?.[cardLike.name] || {};
  const liveValue = Number(liveState.value);
  const liveScarcity = Number(liveState.scarcity);
  const livePopulation = Number(liveState.population);

  const value = Number.isFinite(liveValue)
    ? liveValue
    : (typeof cardLike.value === 'number' ? cardLike.value : 0);
  const scarcity = Number.isFinite(liveScarcity)
    ? liveScarcity
    : (typeof cardLike.scarcity === 'number' ? cardLike.scarcity : 0);
  const population = Number.isFinite(livePopulation)
    ? Math.max(0, parseInt(livePopulation, 10) || 0)
    : Math.max(0, parseInt(cardLike.population, 10) || 0);

  if (!latest) {
    return {
      ...cardLike,
      displayname: String(cardLike.displayname || cardLike.name || '').trim() || cardLike.name,
      value,
      scarcity,
      population,
    };
  }

  return {
    ...latest,
    ...cardLike,
    displayname: String(cardLike.displayname || latest.displayname || cardLike.name || '').trim() || cardLike.name,
    value,
    scarcity,
    population,
  };
}

function hydrateCards(cards) {
  return (cards || []).map((card) => hydrateCard(card));
}

function buildCatalogEntries() {
  const entries = [];
  for (const [rarity, group] of Object.entries(cardsByRarity || {})) {
    if (!group || typeof group !== 'object') continue;
    for (const [name, card] of Object.entries(group)) {
      if (!card || typeof card !== 'object') continue;
      if (!name || name === 'totalPopulation') continue;
      entries.push({ name, rarity });
    }
  }
  return entries;
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
      return {
        ok: false,
        error:
          body?.error ||
          body?.msg ||
          `Request failed with status ${res.status}`,
        status: res.status,
      };
    }

    return body;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Network request failed',
      status: 0,
    };
  }
}

export const gameApiClient = {
  async syncCardCatalog() {
    const response = await requestTradeApi('/api/cards/catalog', {
      method: 'POST',
      body: JSON.stringify({ entries: buildCatalogEntries() }),
    });

    const nextMap = response?.valuesByName;
    const nextTotalPopulation = Number(response?.totalPopulation);
    if (nextMap && typeof nextMap === 'object') {
      liveCardValuesByName = nextMap;
      if (Number.isFinite(nextTotalPopulation)) {
        liveTotalPopulation = Math.max(0, parseInt(nextTotalPopulation, 10) || 0);
      }
      return true;
    }

    return false;
  },

  async loadCardValues() {
    const response = await requestTradeApi('/api/cards/values', {
      method: 'GET',
    });

    const nextMap = response?.valuesByName;
    const nextTotalPopulation = Number(response?.totalPopulation);
    if (nextMap && typeof nextMap === 'object') {
      liveCardValuesByName = nextMap;
      if (Number.isFinite(nextTotalPopulation)) {
        liveTotalPopulation = Math.max(0, parseInt(nextTotalPopulation, 10) || 0);
      }
      return {
        valuesByName: liveCardValuesByName,
        totalPopulation: liveTotalPopulation,
      };
    }

    return {
      valuesByName: liveCardValuesByName,
      totalPopulation: liveTotalPopulation,
    };
  },

  getCurrentCardScarcity(cardLike) {
    if (!cardLike?.name) return 0;
    const scarcity = Number(liveCardValuesByName?.[cardLike.name]?.scarcity);
    return Number.isFinite(scarcity) ? scarcity : 0;
  },

  getCurrentCardPopulation(cardLike) {
    if (!cardLike?.name) return 0;
    const population = Number(liveCardValuesByName?.[cardLike.name]?.population);
    return Number.isFinite(population) ? Math.max(0, parseInt(population, 10) || 0) : 0;
  },

  getTotalCardPopulation() {
    return Math.max(0, parseInt(liveTotalPopulation, 10) || 0);
  },

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

  async loadLeaderboard({ page = 1, search = '', sortBy = 'deckValue' } = {}) {
    const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
    const normalizedSearch = String(search || '').trim();
    const normalizedSortBy = String(sortBy || 'deckValue').trim();
    const params = new URLSearchParams({
      page: String(normalizedPage),
      search: normalizedSearch,
      sortBy: normalizedSortBy,
    });

    const response = await requestTradeApi(`/api/leaderboard?${params.toString()}`, {
      method: 'GET',
    });

    const rows = Array.isArray(response?.rows) ? response.rows : [];

    return {
      page: Math.max(1, parseInt(response?.page, 10) || normalizedPage),
      pageSize: Math.max(1, parseInt(response?.pageSize, 10) || 20),
      totalUsers: Math.max(0, parseInt(response?.totalUsers, 10) || 0),
      totalPages: Math.max(1, parseInt(response?.totalPages, 10) || 1),
      sortBy: String(response?.sortBy || normalizedSortBy).trim(),
      rows: rows.map((row) => ({
        userName: String(row?.userName || '').trim(),
        deckValue: normalizeWalletValue(row?.deckValue),
        cardsDesigned: Math.max(0, parseInt(row?.cardsDesigned, 10) || 0),
        absoluteRank: row?.absoluteRank,
        topCards: hydrateCards(Array.isArray(row?.topCards) ? row.topCards : []).slice(0, 3).map((card) => ({
          ...card,
          qty: normalizeQty(card?.qty),
          value: normalizeWalletValue(card?.value),
        })),
      })),
    };
  },

  getCurrentCardValue(cardLike) {
    if (cardLike?.name) {
      const liveValue = Number(liveCardValuesByName?.[cardLike.name]?.value);
      if (Number.isFinite(liveValue)) {
        return liveValue;
      }
    }

    if (cardLike && typeof cardLike.value === 'number') {
      return cardLike.value;
    }

    return 0;
  },

  async buildOwnedDeckCards(userName, mode = 'deck') {
    if (!userName) return [];

    await this.loadCardValues();

    const response = await requestTradeApi('/api/trades/owned', {
      method: 'POST',
      body: JSON.stringify({ userName, mode }),
    });

    const sourceCards = Array.isArray(response?.ownedCards) ? response.ownedCards : [];
    if (sourceCards.length > 0) {
      return sourceCards
        .map((cardLike) => {
          const hydrated = hydrateCard(cardLike);
          if (!hydrated?.name) return null;

          const normalizedQty = normalizeQty(hydrated.qty);
          if (normalizedQty <= 0) return null;

          const liveState = liveCardValuesByName?.[hydrated.name] || {};
          const liveValue = Number(liveState.value);
          const liveScarcity = Number(liveState.scarcity);
          const livePopulation = Number(liveState.population);

          return {
            ...hydrated,
            qty: normalizedQty,
            value: Number.isFinite(liveValue)
              ? liveValue
              : (typeof hydrated.value === 'number' ? hydrated.value : 0),
            scarcity: Number.isFinite(liveScarcity)
              ? liveScarcity
              : (typeof hydrated.scarcity === 'number' ? hydrated.scarcity : 0),
            population: Number.isFinite(livePopulation)
              ? Math.max(0, parseInt(livePopulation, 10) || 0)
              : Math.max(0, parseInt(hydrated.population, 10) || 0),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const sourceEntries = Array.isArray(response?.ownedEntries) ? response.ownedEntries : [];

    return sourceEntries
      .map(({ name, qty }) => {
        const card = getCardByName(name);
        const normalizedQty = normalizeQty(qty);
        if (!card || normalizedQty <= 0) return null;
        const liveState = liveCardValuesByName?.[name] || {};
        const liveValue = Number(liveState.value);
        const liveScarcity = Number(liveState.scarcity);
        const livePopulation = Number(liveState.population);
        return {
          ...card,
          qty: normalizedQty,
          value: Number.isFinite(liveValue) ? liveValue : card.value,
          scarcity: Number.isFinite(liveScarcity) ? liveScarcity : 0,
          population: Number.isFinite(livePopulation)
            ? Math.max(0, parseInt(livePopulation, 10) || 0)
            : 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async loadPendingTrade() {
    await this.loadCardValues();

    const parsedResponse = await requestTradeApi('/api/trades/pending', { method: 'GET' });

    const parsed = parsedResponse?.pendingTrade;
    if (!parsed || typeof parsed !== 'object') {
      return { otherUserLabel: 'Other User', otherUserName: '', otherTradeCards: [], iAccepted: false, otherAccepted: false };
    }

    return {
      otherUserLabel: parsed.otherUserLabel || parsed.otherUserName || 'Other User',
      otherUserName: parsed.otherUserName || '',
      otherTradeCards: Array.isArray(parsed.otherTradeCards) ? hydrateCards(parsed.otherTradeCards) : [],
      iAccepted: Boolean(parsed.iAccepted),
      otherAccepted: Boolean(parsed.otherAccepted),
    };
  },

  async savePendingTrade(pendingTrade) {
    await requestTradeApi('/api/trades/pending', {
      method: 'PUT',
      body: JSON.stringify({
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

  async loadSelectedTradeCards() {
    await this.loadCardValues();

    const parsedResponse = await requestTradeApi('/api/trades/selection', { method: 'GET' });
    const parsed = parsedResponse?.selectedTradeCards;
    return Array.isArray(parsed) ? hydrateCards(parsed) : [];
  },

  async saveSelectedTradeCards(selectedTradeCards) {
    await requestTradeApi('/api/trades/selection', {
      method: 'PUT',
      body: JSON.stringify({
        selectedTradeCards: Array.isArray(selectedTradeCards) ? selectedTradeCards : [],
      }),
    });
  },

  async requestTradeUser(requestUserInput) {
    const response = await requestTradeApi('/api/trades/request-user', {
      method: 'POST',
      body: JSON.stringify({
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

  async cancelTrade(selectedTradeCards) {
    const response = await requestTradeApi('/api/trades/cancel', {
      method: 'POST',
      body: JSON.stringify({
        selectedTradeCards: Array.isArray(selectedTradeCards) ? selectedTradeCards : [],
      }),
    });

    if (!response) return;
  },

  async acceptTrade(otherUserName) {
    if (!otherUserName) {
      return { ok: false, waiting: false, error: 'Missing trade users', nextActiveOwned: [], nextTargetOwned: [] };
    }

    const response = await requestTradeApi('/api/trades/accept', {
      method: 'POST',
      body: JSON.stringify({ otherUserName }),
    });

    if (!response) {
      return { ok: false, waiting: false, error: 'Unable to accept trade', nextActiveOwned: [], nextTargetOwned: [] };
    }

    const nextActiveOwned = Array.isArray(response?.nextActiveOwned) ? response.nextActiveOwned : [];
    const nextTargetOwned = Array.isArray(response?.nextTargetOwned) ? response.nextTargetOwned : [];

    return {
      ok: Boolean(response?.ok ?? true),
      waiting: Boolean(response?.waiting),
      error: response?.error || '',
      nextActiveOwned: hydrateCards(nextActiveOwned),
      nextTargetOwned: hydrateCards(nextTargetOwned),
    };
  },

  async loadBankInventory() {
    await this.loadCardValues();

    const response = await requestTradeApi('/api/bank/inventory', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const bankEntries = Array.isArray(response?.bankEntries) ? response.bankEntries : [];
    return bankEntries
      .map(({ name, qty, card: serverCard }) => {
        const staticCard = getCardByName(name);
        const fallbackCard = {
          name,
          displayname: name,
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
          scarcity: 0,
        };

        const hasServerMetadata = Boolean(
          serverCard && (
            (typeof serverCard.image === 'string' && serverCard.image.trim() && serverCard.image !== 'Default.png') ||
            (typeof serverCard.description === 'string' && serverCard.description.trim()) ||
            (typeof serverCard.cardType === 'string' && serverCard.cardType !== 'Type') ||
            (typeof serverCard.author === 'string' && serverCard.author !== 'Unknown')
          )
        );

        const mergedCard = {
          ...fallbackCard,
          ...(staticCard || {}),
          ...(hasServerMetadata ? (serverCard || {}) : {}),
        };

        if (serverCard && typeof serverCard === 'object') {
          const serverDisplayName = String(serverCard.displayname || '').trim();
          if (serverDisplayName) {
            mergedCard.displayname = serverDisplayName;
          }
        }

        if (!hasServerMetadata && serverCard) {
          // Keep high-signal stats from server without clobbering richer card metadata.
          if (serverCard.rarity) mergedCard.rarity = serverCard.rarity;
          if (Number.isFinite(Number(serverCard.value))) mergedCard.value = Number(serverCard.value);
          if (Number.isFinite(Number(serverCard.population))) {
            mergedCard.population = Math.max(0, parseInt(serverCard.population, 10) || 0);
          }
          if (Number.isFinite(Number(serverCard.scarcity))) {
            mergedCard.scarcity = Number(serverCard.scarcity);
          }
        }

        const card = mergedCard;
        const normalizedQty = normalizeQty(qty);
        if (!card || normalizedQty <= 0) return null;
        const liveValue = Number(liveCardValuesByName?.[name]?.value);
        return {
          name,
          qty: normalizedQty,
          card: {
            ...card,
            value: Number.isFinite(liveValue) ? liveValue : card.value,
            scarcity: Number.isFinite(Number(liveCardValuesByName?.[name]?.scarcity))
              ? Number(liveCardValuesByName[name].scarcity)
              : 0,
            population: Number.isFinite(Number(liveCardValuesByName?.[name]?.population))
              ? Math.max(0, parseInt(liveCardValuesByName[name].population, 10) || 0)
              : 0,
          },
        };
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
        cardName,
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
        cardName,
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
      body: JSON.stringify({}),
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
        packName,
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

  async openPack(userName, packName, fallbackOpenedCards = []) {
    if (!userName || !packName) {
      return { ok: false, packs: normalizePacksMap({}), openedCards: [] };
    }

    const response = await requestTradeApi('/api/packs/open', {
      method: 'POST',
      body: JSON.stringify({
        packName,
      }),
    });

    if (!response) {
      return { ok: false, packs: normalizePacksMap({}), openedCards: [] };
    }

    const nextMap = response?.valuesByName;
    const nextTotalPopulation = Number(response?.totalPopulation);
    if (nextMap && typeof nextMap === 'object') {
      liveCardValuesByName = nextMap;
      if (Number.isFinite(nextTotalPopulation)) {
        liveTotalPopulation = Math.max(0, parseInt(nextTotalPopulation, 10) || 0);
      }
    }

    return {
      ok: Boolean(response.ok),
      packs: normalizePacksMap(response.packs || {}),
      openedCards: hydrateCards(Array.isArray(response.openedCards) ? response.openedCards : []),
    };
  },

  async claimOpenedPackCards(userName, openedCards) {
    if (!userName) {
      return { ok: false };
    }

    const response = await requestTradeApi('/api/packs/claim', {
      method: 'POST',
      body: JSON.stringify({
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
      body: JSON.stringify({}),
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
            displayname: entry.card.displayname || entry.name,
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
      error: response?.error || response?.msg || '',
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

  async loadCatalogDesigns() {
    await this.loadCardValues();

    const response = await requestTradeApi(`/api/catalog/designs?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });

    const cards = Array.isArray(response?.cards) ? response.cards : [];
    const discoveredCards = new Set(Array.isArray(response?.discoveredCards) ? response.discoveredCards : []);

    const hydratedCards = cards
      .map((entry) => {
        if (!entry?.name || !entry?.card) return null;
        return {
          name: entry.name,
          card: hydrateCard({
            ...entry.card,
            name: entry.name,
            displayname: entry.card.displayname || entry.name,
          }),
          discovered: discoveredCards.has(entry.name),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    return hydratedCards;
  },

  async loadAdminCardDesigns() {
    await this.loadCardValues();

    const response = await requestTradeApi(`/api/admin/cards/designs?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });

    const cards = Array.isArray(response?.cards) ? response.cards : [];
    return cards
      .map((entry) => {
        if (!entry?.name || !entry?.card) return null;
        return {
          name: entry.name,
          card: hydrateCard({
            ...entry.card,
            name: entry.name,
            displayname: entry.card.displayname || entry.name,
          }),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async updateAdminCardDesign(originalName, nextName, card) {
    const response = await requestTradeApi('/api/admin/cards/designs', {
      method: 'PUT',
      body: JSON.stringify({
        originalName,
        nextName,
        displayname: card?.displayname,
        card,
      }),
    });

    return {
      ok: Boolean(response?.ok),
      error: response?.error || '',
      updatedCard: response?.updatedCard || null,
    };
  },

  async loadDeckSortPreference(userName, fallbackSort = 'Rarity') {
    if (!userName) return { sortBy: fallbackSort, sortDirection: 'desc' };

    const response = await requestTradeApi('/api/preferences/deck-sort', { method: 'GET' });

    const validSortOptions = ['Value', 'Name', 'Rarity', 'Author'];
    const rawSortBy = String(response?.sortBy || fallbackSort);
    const sortBy = validSortOptions.includes(rawSortBy) ? rawSortBy : 'Rarity';

    const rawDirection = String(response?.sortDirection || '').toLowerCase();
    const sortDirection = (rawDirection === 'asc' || rawDirection === 'desc') ? rawDirection : 'desc';

    return { sortBy, sortDirection };
  },

  async saveDeckSortPreference(userName, sortBy, sortDirection) {
    if (!userName) return;
    await requestTradeApi('/api/preferences/deck-sort', {
      method: 'PUT',
      body: JSON.stringify({ sortBy, sortDirection }),
    });
  },

  async loadDeckShowDuplicatesPreference(userName, fallbackShowDuplicates = true) {
    if (!userName) return Boolean(fallbackShowDuplicates);

    const response = await requestTradeApi('/api/preferences/deck-duplicates', { method: 'GET' });

    if (typeof response?.showDuplicates === 'boolean') {
      return response.showDuplicates;
    }

    return Boolean(fallbackShowDuplicates);
  },

  async saveDeckShowDuplicatesPreference(userName, showDuplicates) {
    if (!userName) return;
    await requestTradeApi('/api/preferences/deck-duplicates', {
      method: 'PUT',
      body: JSON.stringify({ showDuplicates: Boolean(showDuplicates) }),
    });
  },

  async loadLeaderboardSortPreference(userName, fallbackSort = 'deckValue') {
    if (!userName) return fallbackSort;

    const response = await requestTradeApi('/api/preferences/leaderboard-sort', { method: 'GET' });

    const validSortOptions = ['deckValue', 'cardsDesigned'];
    const rawSort = String(response?.leaderboardSort || fallbackSort);
    return validSortOptions.includes(rawSort) ? rawSort : 'deckValue';
  },

  async saveLeaderboardSortPreference(userName, leaderboardSort) {
    if (!userName) return;
    await requestTradeApi('/api/preferences/leaderboard-sort', {
      method: 'PUT',
      body: JSON.stringify({ leaderboardSort }),
    });
  },
};
