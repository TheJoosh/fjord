import React from 'react';
import { Card } from './card';
import { getCardByName, cardsByRarity, recalcCardValues } from '../data/cards';
import { getUser, users } from '../data/users';

export function Deck({ userName }) {
  const title = userName ? `${userName}'s Deck` : "User's Deck";
  
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

  owned.sort((a, b) => {
    const aCard = a.card;
    const bCard = b.card;

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

  return (
    <main>
      <div className="user">
        <h2>{title}</h2>
        {userName && (
          <div className="deck-value">
            Deck Value: ${deckValue.toFixed(2)}
          </div>
        )}
      </div>

      <div className="container-fluid">
        <div className="row deck-row">
          {owned.flatMap(entry => {
            const card = entry.card;
            if (!card) return [];
            const qty = entry.qty || 0;
            return Array.from({ length: qty }).map((_, i) => (
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
                  <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                </div>
              </div>
            ));
          })}
        </div>
      </div>
    </main>
  );
}