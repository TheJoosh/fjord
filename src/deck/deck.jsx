import React from 'react';
import { Card } from '../data/card';
import { getCardByName, getCardScarcityScore } from '../data/cards';
import { getUser, normalizeWalletValue } from '../data/users';
import { gameApiClient } from '../../service/gameApiClient';

export function Deck({ userName }) {
  const title = userName ? `${userName}'s Deck` : "User's Deck";
  const sortOptions = ['Value', 'Rarity', 'Name'];
  const cardsPerPage = 40;
  const [showDuplicates, setShowDuplicates] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState('Rarity');
  const [selectedTradeCards, setSelectedTradeCards] = React.useState([]);
  const [ownedCardsMap, setOwnedCardsMap] = React.useState({});
  
  const user = getUser(userName);
  if (user && (!user.cards || typeof user.cards !== 'object')) {
    user.cards = {};
  }

  const effectiveCards = { ...(ownedCardsMap || {}) };
  for (const card of selectedTradeCards) {
    if (!card?.name) continue;
    effectiveCards[card.name] = (parseInt(effectiveCards[card.name], 10) || 0) + 1;
  }

  // calculate total deck value
  let deckValue = 0;
  const walletValue = normalizeWalletValue(user?.wallet);
  if (user) {
    for (const [name, qty] of Object.entries(effectiveCards)) {
      const card = getCardByName(name);
      if (card && typeof card.value === 'number') {
        deckValue += card.value * (parseInt(qty, 10) || 0);
      }
    }
  }

  // build list of owned cards with quantities
  const owned = Object.keys(effectiveCards || {}).map(name => ({
      name,
      qty: Math.max(0, parseInt(effectiveCards[name], 10) || 0),
      card: getCardByName(name),
    })).filter(x => x.qty > 0);

  const sortedOwned = [...owned].sort((a, b) => {
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

  const fallbackCards = user?.cards || {};

  React.useEffect(() => {
    if (!userName) {
      setOwnedCardsMap({});
      return;
    }

    (async () => {
      const ownedDeckCards = await gameApiClient.buildOwnedDeckCards(userName, fallbackCards);
      const nextOwnedCardsMap = {};
      for (const entry of ownedDeckCards) {
        if (!entry?.name) continue;
        nextOwnedCardsMap[entry.name] = Math.max(0, parseInt(entry.qty, 10) || 0);
      }
      setOwnedCardsMap(nextOwnedCardsMap);
    })();
  }, [userName, fallbackCards]);

  React.useEffect(() => {
    (async () => {
      if (!userName) return;
      await gameApiClient.saveDeckSortPreference(userName, sortBy);
    })();
  }, [userName, sortBy]);

  React.useEffect(() => {
    (async () => {
      if (!userName) {
        setSortBy('Rarity');
        return;
      }
      const saved = await gameApiClient.loadDeckSortPreference(userName, 'Rarity');
      setSortBy(sortOptions.includes(saved) ? saved : 'Rarity');
    })();
  }, [userName]);

  React.useEffect(() => {
    if (!userName) {
      setSelectedTradeCards([]);
      return;
    }

    (async () => {
      const parsed = await gameApiClient.loadSelectedTradeCards(userName);
      setSelectedTradeCards(Array.isArray(parsed) ? parsed : []);
    })();
  }, [userName]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [showDuplicates, sortBy, userName]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <main>
      <div className="user">
        <div className="user-header-row">
          <h2>{title}</h2>
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
        )}
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