import React from 'react';
import { Card } from './card';
import { getCardByName, cardsByRarity, recalcCardValues } from '../data/cards';
import { getUser, users } from '../data/users';

export function Deck({ userName }) {
  const title = userName ? `${userName}'s Deck` : "User's Deck";
  const ownedCardsStorageKey = userName ? `ownedCards:${userName}` : null;
  const sortByStorageKey = userName ? `deckSortBy:${userName}` : 'deckSortBy';
  const sortOptions = ['Value', 'Rarity', 'Name'];
  const [showDuplicates, setShowDuplicates] = React.useState(true);
  const [sortBy, setSortBy] = React.useState(() => {
    const saved = localStorage.getItem(sortByStorageKey);
    return sortOptions.includes(saved) ? saved : 'Rarity';
  });
  
  recalcCardValues(users);

  const user = getUser(userName);

  // calculate total deck value
  let deckValue = 0;
  if (user) {
    for (const [name, qty] of Object.entries(user.cards || {})) {
      const card = getCardByName(name);
      if (card && typeof card.value === 'number') {
        deckValue += card.value * (parseInt(qty, 10) || 0);
      }
    }
  }

  // build list of owned cards with quantities
  const owned = user
    ? Object.keys(user.cards || {}).map(name => ({
        name,
        qty: Math.max(0, parseInt(user.cards[name], 10) || 0),
        card: getCardByName(name),
      })).filter(x => x.qty > 0)
    : [];

  const rarityOrder = Object.keys(cardsByRarity || {});
  const typeOrder = ['God', 'Beast', 'Chieftan', 'Warrior'];

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

    const aR = aCard ? aCard.rarity : '';
    const bR = bCard ? bCard.rarity : '';
    const ri = (r) => (r ? rarityOrder.indexOf(r) : Infinity);
    const rDiff = ri(aR) - ri(bR);
    if (rDiff !== 0) return rDiff;

    const aT = aCard ? aCard.cardType : '';
    const bT = bCard ? bCard.cardType : '';
    const ti = (t) => {
      const idx = typeOrder.indexOf(t);
      return idx === -1 ? Infinity : idx;
    };
    const tDiff = ti(aT) - ti(bT);
    if (tDiff !== 0) return tDiff;

    return a.name.localeCompare(b.name);
  });

  React.useEffect(() => {
    if (!ownedCardsStorageKey) return;
    localStorage.setItem(ownedCardsStorageKey, JSON.stringify(owned));
  }, [ownedCardsStorageKey, owned]);

  React.useEffect(() => {
    localStorage.setItem(sortByStorageKey, sortBy);
  }, [sortByStorageKey, sortBy]);

  React.useEffect(() => {
    const saved = localStorage.getItem(sortByStorageKey);
    setSortBy(sortOptions.includes(saved) ? saved : 'Rarity');
  }, [sortByStorageKey]);

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
          <div className="deck-value">
            Deck Value: ${deckValue.toFixed(2)}
          </div>
        )}
      </div>

      <div className="container-fluid">
        <div className="row deck-row">
          {sortedOwned.flatMap(entry => {
            const card = entry.card;
            if (!card) return [];
            const qty = entry.qty || 0;
            const copiesToRender = showDuplicates ? qty : 1;
            return Array.from({ length: copiesToRender }).map((_, i) => (
              <div className="col deck-col" key={`${entry.name}-${i}`}>
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
                  <div className="card-meta-row">
                    <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                    {!showDuplicates && qty > 1 && (
                      <small className="card-quantity">Quantity: {qty}</small>
                    )}
                  </div>
                </div>
              </div>
            ));
          })}
        </div>
      </div>
    </main>
  );
}