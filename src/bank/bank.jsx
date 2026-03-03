import React from 'react';
import { Card } from '../data/card';
import { getCardByName, getCardScarcityScore } from '../data/cards';
import { getUser, normalizeWalletValue } from '../data/users';

export function Bank({ userName }) {
  const bankCardsStorageKey = 'bankCards';
  const ownedCardsStorageKey = userName ? `ownedCards:${userName}` : null;
  const sortByStorageKey = userName ? `deckSortBy:${userName}` : 'deckSortBy';
  const sortOptions = ['Value', 'Rarity', 'Name'];
  const cardsPerPage = 40;
  const [showDuplicates, setShowDuplicates] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [bankCards, setBankCards] = React.useState([]);
  const [ownedDeckCards, setOwnedDeckCards] = React.useState([]);
  const [isSellOverlayOpen, setIsSellOverlayOpen] = React.useState(false);
  const [isSellMode, setIsSellMode] = React.useState(false);
  const [selectedSellCards, setSelectedSellCards] = React.useState([]);
  const [sortBy, setSortBy] = React.useState(() => {
    const saved = localStorage.getItem(sortByStorageKey);
    return sortOptions.includes(saved) ? saved : 'Rarity';
  });
  const user = getUser(userName);
  const walletValue = normalizeWalletValue(user?.wallet);

  const loadBankCards = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(bankCardsStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const sourceEntries = Array.isArray(parsed) ? parsed : [];

      return sourceEntries
        .map((entry) => {
          if (!entry?.name) return null;
          const qty = Math.max(0, parseInt(entry.qty, 10) || 0);
          if (qty <= 0) return null;

          const card = getCardByName(entry.name);
          if (!card) return null;

          return { name: entry.name, qty, card };
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }, []);

  const sortedOwned = [...bankCards].sort((a, b) => {
    const aCard = a.card;
    const bCard = b.card;

    if (sortBy === 'Value') {
      const av = aCard && typeof aCard.value === 'number' ? aCard.value : 0;
      const bv = bCard && typeof bCard.value === 'number' ? bCard.value : 0;
      const vDiff = bv - av;
      if (vDiff !== 0) return vDiff;
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'Name') {
      return a.name.localeCompare(b.name);
    }

    const aScarcity = getCardScarcityScore(a.name);
    const bScarcity = getCardScarcityScore(b.name);
    const scarcityDiff = bScarcity - aScarcity;
    if (scarcityDiff !== 0) return scarcityDiff;

    return a.name.localeCompare(b.name);
  });

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

  const handleDeckCardClick = (clickedCard) => {
    const cardName = clickedCard?.name;
    if (!ownedCardsStorageKey || !cardName) return;

    const currentQty = Math.max(0, parseInt(user?.cards?.[cardName], 10) || 0);
    if (user?.cards && currentQty > 0) {
      if (currentQty <= 1) {
        delete user.cards[cardName];
      } else {
        user.cards[cardName] = currentQty - 1;
      }
    }

    let sourceEntries = [];
    try {
      const raw = localStorage.getItem(ownedCardsStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      sourceEntries = Array.isArray(parsed) ? parsed : [];
    } catch {
      sourceEntries = [];
    }

    const byName = new Map();
    if (sourceEntries.length > 0) {
      for (const entry of sourceEntries) {
        if (!entry?.name) continue;
        const existingQty = byName.get(entry.name) || 0;
        byName.set(entry.name, existingQty + Math.max(0, parseInt(entry.qty, 10) || 0));
      }
    } else {
      for (const [name, qty] of Object.entries(user?.cards || {})) {
        byName.set(name, Math.max(0, parseInt(qty, 10) || 0));
      }
    }

    const nextQty = Math.max(0, (byName.get(cardName) || 0) - 1);
    if (nextQty > 0) {
      byName.set(cardName, nextQty);
    } else {
      byName.delete(cardName);
    }

    const nextOwned = Array.from(byName.entries()).map(([name, qty]) => ({
      name,
      qty,
      card: getCardByName(name),
    }));

    localStorage.setItem(ownedCardsStorageKey, JSON.stringify(nextOwned));
    setOwnedDeckCards(buildOwnedDeckCards());

    setSelectedSellCards((prev) => ([
      ...prev,
      {
        ...clickedCard,
        sellEntryId: `${clickedCard.name}-${Date.now()}-${Math.random()}`,
      },
    ]));
  };

  const handleRemoveSellCard = (sellEntryId) => {
    const selectedCard = selectedSellCards.find((card) => card.sellEntryId === sellEntryId);
    if (!selectedCard?.name || !ownedCardsStorageKey) return;

    const cardName = selectedCard.name;

    if (user?.cards) {
      user.cards[cardName] = (Math.max(0, parseInt(user.cards[cardName], 10) || 0) + 1);
    }

    let sourceEntries = [];
    try {
      const raw = localStorage.getItem(ownedCardsStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      sourceEntries = Array.isArray(parsed) ? parsed : [];
    } catch {
      sourceEntries = [];
    }

    const byName = new Map();
    for (const entry of sourceEntries) {
      if (!entry?.name) continue;
      byName.set(entry.name, (byName.get(entry.name) || 0) + Math.max(0, parseInt(entry.qty, 10) || 0));
    }

    byName.set(cardName, (byName.get(cardName) || 0) + 1);

    const nextOwned = Array.from(byName.entries()).map(([name, qty]) => ({
      name,
      qty,
      card: getCardByName(name),
    }));

    localStorage.setItem(ownedCardsStorageKey, JSON.stringify(nextOwned));
    setOwnedDeckCards(buildOwnedDeckCards());
    setSelectedSellCards((prev) => prev.filter((card) => card.sellEntryId !== sellEntryId));
  };

  const buildOwnedDeckCards = React.useCallback(() => {
    const fallbackCards = user?.cards || {};
    let sourceEntries = [];

    if (ownedCardsStorageKey) {
      try {
        const raw = localStorage.getItem(ownedCardsStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          sourceEntries = parsed;
        }
      } catch {
        sourceEntries = [];
      }
    }

    const byName = new Map();

    if (sourceEntries.length > 0) {
      for (const entry of sourceEntries) {
        if (!entry?.name) continue;
        const currentQty = byName.get(entry.name) || 0;
        byName.set(entry.name, currentQty + Math.max(0, parseInt(entry.qty, 10) || 0));
      }
    } else {
      for (const [name, qty] of Object.entries(fallbackCards)) {
        byName.set(name, Math.max(0, parseInt(qty, 10) || 0));
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
  }, [user, ownedCardsStorageKey]);

  React.useEffect(() => {
    setBankCards(loadBankCards());
  }, [loadBankCards]);

  React.useEffect(() => {
    const persistable = bankCards
      .map((entry) => ({
        name: entry.name,
        qty: Math.max(0, parseInt(entry.qty, 10) || 0),
      }))
      .filter((entry) => entry.qty > 0);

    localStorage.setItem(bankCardsStorageKey, JSON.stringify(persistable));
  }, [bankCards]);

  React.useEffect(() => {
    localStorage.setItem(sortByStorageKey, sortBy);
  }, [sortByStorageKey, sortBy]);

  React.useEffect(() => {
    const saved = localStorage.getItem(sortByStorageKey);
    setSortBy(sortOptions.includes(saved) ? saved : 'Rarity');
  }, [sortByStorageKey]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [showDuplicates, sortBy]);
  
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    if (!isSellOverlayOpen) return;

    setOwnedDeckCards(buildOwnedDeckCards());

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setIsSellOverlayOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSellOverlayOpen, buildOwnedDeckCards]);

  return (
    <main>
      <div className="user">
        <div className="user-header-row">
          <h2>Bank - buy cards to add to your deck</h2>
          <div className="deck-controls">
            <label className="sort-by-control">
              <span>Sort By</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {sortOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
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
        {
          <div className="deck-value-row">
            <div className="deck-value">
              Wallet: ${walletValue.toFixed(2)}
            </div>
            <div className="deck-value-pagination-slot" aria-hidden={!showPagination}>
              {showPagination && (
                <div className="deck-pagination">
                  {showPreviousPageArrow && (
                    <button type="button" className="deck-pagination-arrow" onClick={goToPreviousPage} aria-label="Previous page">←</button>
                  )}
                  <span>{startIndex}-{endIndex} of {totalRenderedCards}</span>
                  {showNextPageArrow && (
                    <button type="button" className="deck-pagination-arrow" onClick={goToNextPage} aria-label="Next page">→</button>
                  )}
                </div>
              )}
            </div>
            <button className="picker" onClick={() => setIsSellMode((prev) => !prev)}>
              {isSellMode ? 'Buy Cards!' : 'Sell Cards!'}
            </button>
          </div>
        }
      </div>

      {!isSellMode && (
        <div className="container-fluid">
          <div className="row deck-row">
            {paginatedCards.map(({ entry, card, qty, copyIndex, showStack }) => (
                <div className="col deck-col" key={`${entry.name}-${copyIndex}`}>
                  <div className={showStack ? 'card-stack' : ''}>
                    {showStack && (
                      <div className="card-stack-ghost" aria-hidden="true">
                        <Card
                          image={card.image}
                          name={card.name}
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
        </div>
      )}

      {isSellMode && (
        <>
          <button className="picker" onClick={() => setIsSellOverlayOpen(true)}>Pick from your deck</button>
          <section className="yoUser">
            <div className="container-fluid">
              <div className="row deck-row">
                {selectedSellCards.map((card) => (
                  <div key={card.sellEntryId} className="col deck-col">
                    <Card
                      image={card.image}
                      name={card.name}
                      cost={card.cost}
                      rarity={card.rarity}
                      cardType={card.cardType}
                      description={card.description}
                      strength={card.strength}
                      endurance={card.endurance}
                    />
                    <div className="card-value mt-1">
                      <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                    </div>
                    <button
                      type="button"
                      className="remove-trade-card-btn"
                      onClick={() => handleRemoveSellCard(card.sellEntryId)}
                    >
                      Remove Card
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {isSellOverlayOpen && (
        <div className="pexels-overlay" onClick={() => setIsSellOverlayOpen(false)}>
          <div className="pexels-overlay-panel pack-overlay-panel" onClick={e => e.stopPropagation()}>
            <div className="pexels-overlay-header">
              <h3>Sell Cards</h3>
              <button type="button" className="pexels-overlay-close" onClick={() => setIsSellOverlayOpen(false)}>Close</button>
            </div>

            {!ownedDeckCards.length ? (
              <div className="pexels-overlay-state">No cards found in your deck.</div>
            ) : (
              <div className="row deck-row pack-overlay-cards">
                {ownedDeckCards.map((card) => {
                  const qty = card.qty;
                  if (!card) return null;

                  return (
                    <div key={card.name} className="col deck-col pack-overlay-col">
                      <button
                        type="button"
                        className="trade-deck-card-btn"
                        onClick={() => handleDeckCardClick(card)}
                        title="Remove 1 from your deck"
                      >
                        <Card
                          image={card.image}
                          name={card.name}
                          cost={card.cost}
                          rarity={card.rarity}
                          cardType={card.cardType}
                          description={card.description}
                          strength={card.strength}
                          endurance={card.endurance}
                        />
                      </button>
                      <div className="card-value mt-1">
                        <div className="card-meta-row">
                          <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                          <small className="card-quantity">Quantity: {qty}</small>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}