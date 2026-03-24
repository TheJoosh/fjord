import React from 'react';
import { Card } from '../data/card';
import { gameApiClient } from '../../service/gameApiClient';
import { tradeRealtimeClient } from '../../service/tradeRealtimeClient';

function normalizeWalletValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
}

function matchesCardSearch(card, searchTerm) {
  const normalizedQuery = String(searchTerm || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  const searchableFields = [
    card?.name,
    card?.displayname,
    card?.rarity,
    card?.cardType,
    card?.description,
    card?.author,
  ];

  return searchableFields.some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
}

export function Bank({ userName }) {
  const sortOptions = ['Value', 'Rarity', 'Name', 'Author'];
  const getDefaultSortDirection = React.useCallback((option) => (option === 'Name' || option === 'Author' ? 'asc' : 'desc'), []);
  const cardsPerPage = 40;
  const [currentPage, setCurrentPage] = React.useState(1);
  const [bankCards, setBankCards] = React.useState([]);
  const [ownedDeckCards, setOwnedDeckCards] = React.useState([]);
  const [isSellMode, setIsSellMode] = React.useState(false);
  const [showDuplicates, setShowDuplicates] = React.useState(true);
  const [sortBy, setSortBy] = React.useState('Rarity');
  const [sortDirection, setSortDirection] = React.useState('desc');
  const [sortSelectValue, setSortSelectValue] = React.useState('Rarity');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [walletBalance, setWalletBalance] = React.useState(0);
  const [pendingAction, setPendingAction] = React.useState(null);
  const [hasLoadedSortPreference, setHasLoadedSortPreference] = React.useState(false);
  const [hasLoadedShowDuplicatesPreference, setHasLoadedShowDuplicatesPreference] = React.useState(false);
  const [valuesRefreshNonce, setValuesRefreshNonce] = React.useState(0);
  const valuesRefreshTimerRef = React.useRef(null);
  const walletValue = normalizeWalletValue(walletBalance);

  const loadBankCards = React.useCallback(async () => {
    return await gameApiClient.loadBankInventory([]);
  }, []);

  const mapBankEntriesToCards = React.useCallback((entries) => {
    return (entries || [])
      .map((entry) => {
        if (!entry?.name) return null;
        const qty = Math.max(0, parseInt(entry.qty, 10) || 0);
        if (qty <= 0) return null;
        const card = entry.card;
        if (!card) return null;
        return { name: entry.name, qty, card };
      })
      .filter(Boolean);
  }, []);

  const filteredBankCards = bankCards.filter((entry) => matchesCardSearch(entry?.card, searchTerm));

  const sortedOwned = [...filteredBankCards].sort((a, b) => {
    const aCard = a.card;
    const bCard = b.card;
    const applyDirection = (comparison) => (sortDirection === 'asc' ? comparison : -comparison);

    if (sortBy === 'Value') {
      const av = aCard && typeof aCard.value === 'number' ? aCard.value : 0;
      const bv = bCard && typeof bCard.value === 'number' ? bCard.value : 0;
      const vDiff = applyDirection(av - bv);
      if (vDiff !== 0) return vDiff;
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'Name') {
      return applyDirection(a.name.localeCompare(b.name));
    }

    if (sortBy === 'Author') {
      const aAuthor = (aCard?.author || '').toLowerCase();
      const bAuthor = (bCard?.author || '').toLowerCase();
      const authorDiff = applyDirection(aAuthor.localeCompare(bAuthor));
      if (authorDiff !== 0) return authorDiff;
      return a.name.localeCompare(b.name);
    }

    const aScarcity = gameApiClient.getCurrentCardScarcity({ name: a.name });
    const bScarcity = gameApiClient.getCurrentCardScarcity({ name: b.name });
    const scarcityDiff = applyDirection(aScarcity - bScarcity);
    if (scarcityDiff !== 0) return scarcityDiff;

    return a.name.localeCompare(b.name);
  });

  const sortedOwnedDeckCards = React.useMemo(() => {
    return [...ownedDeckCards]
      .filter((card) => matchesCardSearch(card, searchTerm))
      .sort((a, b) => {
      const applyDirection = (comparison) => (sortDirection === 'asc' ? comparison : -comparison);

      if (sortBy === 'Value') {
        const av = typeof a?.value === 'number' ? a.value : 0;
        const bv = typeof b?.value === 'number' ? b.value : 0;
        const vDiff = applyDirection(av - bv);
        if (vDiff !== 0) return vDiff;
        return (a?.name || '').localeCompare(b?.name || '');
      }

      if (sortBy === 'Name') {
        return applyDirection((a?.name || '').localeCompare(b?.name || ''));
      }

      if (sortBy === 'Author') {
        const aAuthor = (a?.author || '').toLowerCase();
        const bAuthor = (b?.author || '').toLowerCase();
        const authorDiff = applyDirection(aAuthor.localeCompare(bAuthor));
        if (authorDiff !== 0) return authorDiff;
        return (a?.name || '').localeCompare(b?.name || '');
      }

      const aScarcity = gameApiClient.getCurrentCardScarcity({ name: a?.name });
      const bScarcity = gameApiClient.getCurrentCardScarcity({ name: b?.name });
      const scarcityDiff = applyDirection(aScarcity - bScarcity);
      if (scarcityDiff !== 0) return scarcityDiff;

      return (a?.name || '').localeCompare(b?.name || '');
    });
  }, [ownedDeckCards, sortBy, searchTerm, sortDirection]);

  const handleSortByChange = React.useCallback((nextSortBy) => {
    if (!nextSortBy) return;

    if (nextSortBy === sortBy) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection(getDefaultSortDirection(nextSortBy));
  }, [sortBy, getDefaultSortDirection]);

  const armSortSelect = React.useCallback(() => {
    setSortSelectValue('');
  }, []);

  React.useEffect(() => {
    setSortSelectValue(sortBy);
  }, [sortBy]);

  const renderedSellDeckCards = React.useMemo(() => {
    return sortedOwnedDeckCards.flatMap((card) => {
      const qty = Math.max(0, parseInt(card?.qty, 10) || 0);
      if (qty <= 0) return [];

      const copiesToRender = showDuplicates ? qty : 1;
      const showStack = !showDuplicates && qty > 1;

      return Array.from({ length: copiesToRender }).map((_, copyIndex) => ({
        card,
        qty,
        copyIndex,
        showStack,
      }));
    });
  }, [sortedOwnedDeckCards, showDuplicates]);

  const totalRenderedCards = sortedOwned.length;
  const totalPages = Math.max(1, Math.ceil(totalRenderedCards / cardsPerPage));
  const startIndex = totalRenderedCards === 0 ? 0 : (currentPage - 1) * cardsPerPage + 1;
  const endIndex = Math.min(currentPage * cardsPerPage, totalRenderedCards);
  const paginatedCards = sortedOwned.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);
  const showPagination = totalPages > 1;
  const showPreviousPageArrow = currentPage > 1;
  const showNextPageArrow = currentPage < totalPages;

  const goToPreviousPage = () => {
    setCurrentPage((previousPage) => Math.max(1, previousPage - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((previousPage) => (previousPage >= totalPages ? 1 : previousPage + 1));
  };

  const renderPaginationControls = () => {
    if (isSellMode || !showPagination) return null;

    return (
      <div className="deck-pagination">
        {showPreviousPageArrow && (
          <button type="button" className="deck-pagination-arrow" onClick={goToPreviousPage} aria-label="Previous page">←</button>
        )}
        <span>{startIndex}-{endIndex} of {totalRenderedCards}</span>
        {showNextPageArrow && (
          <button type="button" className="deck-pagination-arrow" onClick={goToNextPage} aria-label="Next page">→</button>
        )}
      </div>
    );
  };

  const handleBuyCard = async (cardName) => {
    if (!userName || !cardName || pendingAction) return;

    const currentCardValue = gameApiClient.getCurrentCardValue({ name: cardName });
    const buyPrice = normalizeWalletValue(currentCardValue * 1.15);
    const currentWallet = normalizeWalletValue(walletValue);
    if (currentWallet < buyPrice) return;

    const bankEntry = bankCards.find((entry) => entry.name === cardName);
    const bankQty = Math.max(0, parseInt(bankEntry?.qty, 10) || 0);
    if (bankQty <= 0) return;

    setPendingAction({ type: 'buy', cardName });
    try {
      const response = await gameApiClient.buyBankCard(
        userName,
        cardName,
        buyPrice
      );
      if (!response.ok) return;

      const nextWallet = normalizeWalletValue(response.wallet);
      setWalletBalance(nextWallet);

      setBankCards(mapBankEntriesToCards(response.bankEntries));
      setBankCards(await loadBankCards());
      setOwnedDeckCards(await buildOwnedDeckCards());
    } finally {
      setPendingAction(null);
    }
  };

  const handleSellCard = async (cardName) => {
    if (!userName || !cardName || pendingAction) return;

    const sellValue = gameApiClient.getCurrentCardValue({ name: cardName });
    const payoutAmount = normalizeWalletValue(sellValue * 0.85);
    const currentWallet = normalizeWalletValue(walletValue);
    setPendingAction({ type: 'sell', cardName });
    try {
      const response = await gameApiClient.sellBankCard(
        userName,
        cardName,
        payoutAmount
      );
      if (!response.ok) return;

      const nextWallet = normalizeWalletValue(response.wallet);
      setWalletBalance(nextWallet);

      setBankCards(mapBankEntriesToCards(response.bankEntries));
      setBankCards(await loadBankCards());

      setOwnedDeckCards(await buildOwnedDeckCards());
    } finally {
      setPendingAction(null);
    }
  };

  const buildOwnedDeckCards = React.useCallback(async () => {
    if (!userName) return [];
    return await gameApiClient.buildOwnedDeckCards(userName);
  }, [userName]);

  React.useEffect(() => {
    (async () => {
      setBankCards(await loadBankCards());
    })();
  }, [loadBankCards]);

  React.useEffect(() => {
    (async () => {
      if (!userName) {
        setWalletBalance(0);
        return;
      }
      const profile = await gameApiClient.loadUserProfile();
      setWalletBalance(normalizeWalletValue(profile.wallet));
    })();
  }, [userName]);

  React.useEffect(() => {
    let isActive = true;

    setHasLoadedSortPreference(false);
    (async () => {
      if (!userName) {
        if (!isActive) return;
        setSortBy('Rarity');
        setHasLoadedSortPreference(true);
        return;
      }

      const { sortBy: savedSortBy, sortDirection: savedSortDirection } = await gameApiClient.loadDeckSortPreference(userName, 'Rarity');
      if (!isActive) return;

      const resolvedSort = sortOptions.includes(savedSortBy) ? savedSortBy : 'Rarity';
      setSortBy(resolvedSort);
      setSortDirection(savedSortDirection || getDefaultSortDirection(resolvedSort));
      setHasLoadedSortPreference(true);
    })();

    return () => {
      isActive = false;
    };
  }, [userName]);

  React.useEffect(() => {
    (async () => {
      if (!userName || !hasLoadedSortPreference) return;
      await gameApiClient.saveDeckSortPreference(userName, sortBy, sortDirection);
    })();
  }, [userName, sortBy, sortDirection, hasLoadedSortPreference]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, isSellMode, showDuplicates, searchTerm]);
  
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    if (!isSellMode) return;
    (async () => {
      setOwnedDeckCards(await buildOwnedDeckCards());
    })();
  }, [isSellMode, buildOwnedDeckCards]);

  React.useEffect(() => {
    (async () => {
      setOwnedDeckCards(await buildOwnedDeckCards());
    })();
  }, [userName, buildOwnedDeckCards]);

  React.useEffect(() => {
    if (!userName) return;

    (async () => {
      await gameApiClient.loadCardValues();
      setBankCards(await loadBankCards());
      if (isSellMode) {
        setOwnedDeckCards(await buildOwnedDeckCards());
      }
    })();
  }, [userName, isSellMode, loadBankCards, buildOwnedDeckCards, valuesRefreshNonce]);

  React.useEffect(() => {
    if (!userName) return () => {};

    const unsubscribe = tradeRealtimeClient.subscribe((event) => {
      if (!event || event.channel !== 'trade') return;
      if (event.type !== 'card_values_updated') return;

      if (valuesRefreshTimerRef.current) {
        window.clearTimeout(valuesRefreshTimerRef.current);
      }

      valuesRefreshTimerRef.current = window.setTimeout(() => {
        setValuesRefreshNonce((current) => current + 1);
        valuesRefreshTimerRef.current = null;
      }, 120);
    });

    return () => {
      unsubscribe();
      if (valuesRefreshTimerRef.current) {
        window.clearTimeout(valuesRefreshTimerRef.current);
        valuesRefreshTimerRef.current = null;
      }
    };
  }, [userName]);

  React.useEffect(() => {
    let isActive = true;

    setHasLoadedShowDuplicatesPreference(false);
    (async () => {
      if (!userName) {
        if (!isActive) return;
        setShowDuplicates(true);
        setHasLoadedShowDuplicatesPreference(true);
        return;
      }

      const saved = await gameApiClient.loadDeckShowDuplicatesPreference(userName, true);
      if (!isActive) return;

      setShowDuplicates(Boolean(saved));
      setHasLoadedShowDuplicatesPreference(true);
    })();

    return () => {
      isActive = false;
    };
  }, [userName]);

  React.useEffect(() => {
    (async () => {
      if (!userName || !hasLoadedShowDuplicatesPreference) return;
      await gameApiClient.saveDeckShowDuplicatesPreference(userName, showDuplicates);
    })();
  }, [userName, showDuplicates, hasLoadedShowDuplicatesPreference]);

  if (userName && (!hasLoadedSortPreference || !hasLoadedShowDuplicatesPreference)) {
    return (
      <main className="bank-page">
        <div className="user">
          <h2>Bank</h2>
          <div className="deck-value">Loading preferences...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="bank-page">
      <div className="user">
        <div className="user-header-row">
          <h2>
            Bank - {isSellMode ? 'sell cards at a slight markdown' : 'buy cards to add to your deck'}
          </h2>
          <div className="deck-controls">
            <label className="sort-by-control">
              <span>Sort By {sortDirection === 'asc' ? '↑' : '↓'}</span>
              <select
                value={sortSelectValue}
                onMouseDown={armSortSelect}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
                    armSortSelect();
                  }
                }}
                onBlur={() => {
                  if (!sortSelectValue) setSortSelectValue(sortBy);
                }}
                onChange={(event) => {
                  const nextSortBy = event.target.value;
                  if (!nextSortBy) {
                    setSortSelectValue(sortBy);
                    return;
                  }
                  handleSortByChange(nextSortBy);
                  setSortSelectValue(nextSortBy);
                }}
              >
                <option value="" disabled hidden>Sort By</option>
                {sortOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="search-control">
              <span>Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, rarity, class..."
                aria-label="Search cards"
              />
            </label>
            {isSellMode && (
              <label className="show-duplicates-control">
                <input
                  type="checkbox"
                  checked={showDuplicates}
                  onChange={(e) => setShowDuplicates(e.target.checked)}
                />
                <span>Show duplicates</span>
              </label>
            )}
          </div>
        </div>
        {
          <div className="deck-value-row">
            <div className="deck-value">
              Wallet: ${walletValue.toFixed(2)}
            </div>
            <div className="deck-value-pagination-slot" aria-hidden={isSellMode || !showPagination}>
              {renderPaginationControls()}
            </div>
            <button className="picker" onClick={() => setIsSellMode((prev) => !prev)}>
              {isSellMode ? 'Buy Cards!' : 'Sell Cards!'}
            </button>
          </div>
        }
      </div>

      <h3 className="value" style={{ textAlign: 'center', fontSize: '2rem' }}>{isSellMode ? `${userName || 'User'}'s Deck` : 'Bank Inventory'}</h3>

      {!isSellMode && (
        <div className="container-fluid">
          <div className="row deck-row">
            {paginatedCards.map(({ name, card, qty }) => {
              const buyPrice = normalizeWalletValue((typeof card.value === 'number' ? card.value : 0) * 1.15);
              const canAfford = walletValue >= buyPrice;
              const isBuyingThisCard = pendingAction?.type === 'buy' && pendingAction.cardName === name;

              return (
                <div className="col deck-col" key={name}>
                  <Card
                    image={card.image}
                    name={card.name}
                    displayname={card.displayname}
                    cost={card.cost}
                    rarity={card.rarity}
                    cardType={card.cardType}
                    description={card.description}
                    strength={card.strength}
                    endurance={card.endurance}
                  />
                  <div className="card-value mt-1">
                    <div className="card-meta-row">
                      <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                      <small className="card-quantity">Quantity: {qty}</small>
                    </div>
                    <small>Author: {card.author || 'Unknown'}</small>
                  </div>
                  <button
                    type="button"
                    className="picker"
                    onClick={() => handleBuyCard(name)}
                    disabled={!canAfford || Boolean(pendingAction)}
                    style={!canAfford ? { color: 'red' } : undefined}
                  >
                    {isBuyingThisCard ? 'Loading...' : `Buy for $${buyPrice.toFixed(2)}?`}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="deck-pagination-bottom-slot" aria-hidden={!showPagination}>
            {renderPaginationControls()}
          </div>
        </div>
      )}

      {isSellMode && (
        <>
          <section className="yoUser">
            <div className="container-fluid">
              <div className="row deck-row">
                {renderedSellDeckCards.map(({ card, qty, copyIndex, showStack }) => {
                  const payoutAmount = normalizeWalletValue(((typeof card.value === 'number' ? card.value : 0) * 0.85));
                  const isSellingThisCard = pendingAction?.type === 'sell' && pendingAction.cardName === card.name;

                  return (
                  <div key={`${card.name}-${copyIndex}`} className="col deck-col">
                    <div className={showStack ? 'card-stack' : ''}>
                      {showStack && (
                        <div className="card-stack-ghost" aria-hidden="true">
                          <Card
                            image={card.image}
                            name={card.name}
                            displayname={card.displayname}
                            cost={card.cost}
                            rarity={card.rarity}
                            cardType={card.cardType}
                            description={card.description}
                            strength={card.strength}
                            endurance={card.endurance}
                          />
                        </div>
                      )}
                      <div className="card-stack-main">
                        <Card
                          image={card.image}
                          name={card.name}
                          displayname={card.displayname}
                          cost={card.cost}
                          rarity={card.rarity}
                          cardType={card.cardType}
                          description={card.description}
                          strength={card.strength}
                          endurance={card.endurance}
                        />
                      </div>
                    </div>
                    <div className="card-value mt-1">
                      <div className="card-meta-row">
                        <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                        {!showDuplicates && (
                          <small className="card-quantity">Quantity: {qty}</small>
                        )}
                      </div>
                      <small>Author: {card.author || 'Unknown'}</small>
                    </div>
                    <button
                      type="button"
                      className="picker"
                      onClick={() => handleSellCard(card.name)}
                      disabled={Boolean(pendingAction)}
                    >
                      {isSellingThisCard ? 'Loading...' : `Sell for $${payoutAmount.toFixed(2)}?`}
                    </button>
                  </div>
                )})}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}