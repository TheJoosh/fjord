import React from 'react';
import { Card } from './card';
import { getCardByName } from '../data/cards';
import { getUser } from '../data/users';

export function Deck({ userName }) {
  const title = userName ? `${userName}'s Deck` : "User's Deck";
  
  const user = getUser(userName);
  const cardNames = user ? Object.keys(user.cards || {}) : [];

  return (
    <main>
      <div className="user">
        <h2>{title}</h2>
      </div>

      <div className="container-fluid">
        <div className="row">
          {cardNames.map((name) => {
            const card = getCardByName(name);
            if (!card) return null;
            return (
              <div className="col" key={name}>
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
            );
          })}
        </div>
      </div>
    </main>
  );
}