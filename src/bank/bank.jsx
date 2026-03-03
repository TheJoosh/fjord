import React from 'react';
import { Card } from '../data/card';
import { getCardByName, getCardScarcityScore } from '../data/cards';

export function Bank({ userName }) {
  const bankCardsStorageKey = 'bankCards';
  const sortByStorageKey = userName ? `deckSortBy:${userName}` : 'deckSortBy';
  const sortOptions = ['Value', 'Rarity', 'Name'];
  const cardsPerPage = 40;
  const [showDuplicates, setShowDuplicates] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [bankCards, setBankCards] = React.useState([]);
  const [sortBy, setSortBy] = React.useState(() => {
    const saved = localStorage.getItem(sortByStorageKey);
    return sortOptions.includes(saved) ? saved : 'Rarity';
  });

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

  return (
    <main>
      <div className="user">
        <div className="user-header-row">
          <h2>Bank</h2>
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
          </div>
        }
      </div>

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
    </main>
  );
}