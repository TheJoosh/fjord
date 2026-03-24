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

export function Deck({ userName }) {
  const title = userName ? `${userName}'s Deck` : "User's Deck";
  const sortOptions = ['Value', 'Rarity', 'Name'];
  const getDefaultSortDirection = React.useCallback((option) => (option === 'Name' ? 'asc' : 'desc'), []);
  const cardsPerPage = 40;
  const [showDuplicates, setShowDuplicates] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState('Rarity');
  const [sortDirection, setSortDirection] = React.useState('desc');
  const [sortSelectValue, setSortSelectValue] = React.useState('Rarity');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [ownedDeckCards, setOwnedDeckCards] = React.useState([]);
  const [walletBalance, setWalletBalance] = React.useState(0);
  const [hasLoadedSortPreference, setHasLoadedSortPreference] = React.useState(false);
  const [hasLoadedShowDuplicatesPreference, setHasLoadedShowDuplicatesPreference] = React.useState(false);
  const [valuesRefreshNonce, setValuesRefreshNonce] = React.useState(0);
  const valuesRefreshTimerRef = React.useRef(null);

  const combinedCardsByName = {};
  for (const entry of ownedDeckCards) {
    if (!entry?.name) continue;
    combinedCardsByName[entry.name] = {
      ...entry,
      qty: Math.max(0, parseInt(entry.qty, 10) || 0),
      value: typeof entry.value === 'number' ? entry.value : 0,
      scarcity: typeof entry.scarcity === 'number' ? entry.scarcity : 0,
    };
  }

  // calculate total deck value
  let deckValue = 0;
  const walletValue = normalizeWalletValue(walletBalance);
  for (const card of Object.values(combinedCardsByName)) {
    deckValue += (typeof card.value === 'number' ? card.value : 0) * (parseInt(card.qty, 10) || 0);
  }

  // build list of owned cards with quantities
  const owned = Object.values(combinedCardsByName)
    .map((entry) => ({
      name: entry.name,
      qty: Math.max(0, parseInt(entry.qty, 10) || 0),
      card: {
        ...entry,
        value: typeof entry.value === 'number' ? entry.value : 0,
        scarcity: typeof entry.scarcity === 'number' ? entry.scarcity : 0,
      },
    }))
    .filter((x) => x.qty > 0 && x.card?.name);

  const filteredOwned = owned.filter((entry) => matchesCardSearch(entry.card, searchTerm));

  const sortedOwned = [...filteredOwned].sort((a, b) => {
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

    const aScarcity = gameApiClient.getCurrentCardScarcity({ name: a.name });
    const bScarcity = gameApiClient.getCurrentCardScarcity({ name: b.name });
    const scarcityDiff = applyDirection(aScarcity - bScarcity);
    if (scarcityDiff !== 0) return scarcityDiff;

    return a.name.localeCompare(b.name);
  });

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

  const renderedCards = sortedOwned.flatMap((entry) => {
    const card = entry.card;
    if (!card) return [];

    const qty = entry.qty || 0;
    const copiesToRender = showDuplicates ? qty : 1;
    const showStack = !showDuplicates && qty > 1;

    return Array.from({ length: copiesToRender }).map((_, i) => ({
      entry,
      card,
      qty,
      copyIndex: i,
      showStack,
    }));
  });

  const totalRenderedCards = renderedCards.length;
  const totalPages = Math.max(1, Math.ceil(totalRenderedCards / cardsPerPage));
  const startIndex = totalRenderedCards === 0 ? 0 : (currentPage - 1) * cardsPerPage + 1;
  const endIndex = Math.min(currentPage * cardsPerPage, totalRenderedCards);
  const paginatedCards = renderedCards.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);
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
    if (!showPagination) return null;

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

  React.useEffect(() => {
    if (!userName) {
      setOwnedDeckCards([]);
      return;
    }

    (async () => {
      const nextOwnedDeckCards = await gameApiClient.buildOwnedDeckCards(userName);
      setOwnedDeckCards(nextOwnedDeckCards);
    })();
  }, [userName, valuesRefreshNonce]);

  React.useEffect(() => {
    (async () => {
      await gameApiClient.loadCardValues();
    })();
  }, [userName, valuesRefreshNonce]);

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
    (async () => {
      if (!userName || !hasLoadedSortPreference) return;
      await gameApiClient.saveDeckSortPreference(userName, sortBy);
    })();
  }, [userName, sortBy, hasLoadedSortPreference]);

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

      const saved = await gameApiClient.loadDeckSortPreference(userName, 'Rarity');
      if (!isActive) return;

      const resolvedSort = sortOptions.includes(saved) ? saved : 'Rarity';
      setSortBy(resolvedSort);
      setSortDirection(getDefaultSortDirection(resolvedSort));
      setHasLoadedSortPreference(true);
    })();

    return () => {
      isActive = false;
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

  React.useEffect(() => {
    setCurrentPage(1);
  }, [showDuplicates, sortBy, userName, searchTerm]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (userName && (!hasLoadedSortPreference || !hasLoadedShowDuplicatesPreference)) {
    return (
      <main>
        <div className="user">
          <h2>{title}</h2>
          <div className="deck-value">Loading preferences...</div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="user">
        <div className="user-header-row">
          <h2>{title}</h2>
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
            <label className="show-duplicates-control">
              <input
                type="checkbox"
                checked={showDuplicates}
                onChange={(e) => setShowDuplicates(e.target.checked)}
              />
              <span>Show duplicates</span>
            </label>
          </div>
        </div>
        {userName && (
          <div className="deck-value-row">
            <div className="deck-value">
              Deck Value: ${deckValue.toFixed(2)}
              <br></br>
              Wallet: ${walletValue.toFixed(2)}
            </div>
            <div className="deck-value">
            </div>
            <div className="deck-value-pagination-slot" aria-hidden={!showPagination}>
              {renderPaginationControls()}
            </div>
          </div>
        )}
      </div>

      <div className="container-fluid">
        {userName && paginatedCards.length === 0 ? (
          <div className="deck-value">Open card packs to get cards!</div>
        ) : (
        <>
        <div className="row deck-row">
          {paginatedCards.map(({ entry, card, qty, copyIndex, showStack }) => (
              <div className="col deck-col" key={`${entry.name}-${copyIndex}`}>
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
              </div>
            ))}
        </div>
        <div className="deck-pagination-bottom-slot" aria-hidden={!showPagination}>
          {renderPaginationControls()}
        </div>
        </>
        )}
      </div>
    </main>
  );
}