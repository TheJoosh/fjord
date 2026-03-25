import React from 'react';
import { Card } from '../data/card';

export function LeaderboardTopCardsCollapsible({ cards, userName }) {
  const [open, setOpen] = React.useState(false);

  // Detect if we're on mobile (<=640px)
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 640);
  React.useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 640);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!cards.length) return null;

  if (!isMobile) {
    // Desktop: show cards as before
    return (
      <div className="leaderboard-top-cards">
        {cards.slice(0, 3).map((card, index) => (
          <div className="leaderboard-card-item" key={`${userName}-${card.name}-${index}`}>  
            <div className="pack-overlay-col">
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
            <small className="leaderboard-card-title">{card.displayname || card.name}</small>
            <small className="leaderboard-card-value">Value: ${Number(card.value).toFixed(2)}{card.qty > 1 ? ` x${card.qty}` : ''}</small>
          </div>
        ))}
      </div>
    );
  }

  // Mobile: show a button to expand/collapse
  return (
    <div className="leaderboard-top-cards-collapsible">
      <button
        className="leaderboard-cards-toggle-btn"
        aria-expanded={open}
        aria-controls={`leaderboard-cards-${userName}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? 'Hide Cards' : 'Show Cards'}
      </button>
      {open && (
        <div className="leaderboard-top-cards" id={`leaderboard-cards-${userName}`}>
          {cards.slice(0, 3).map((card, index) => (
            <div className="leaderboard-card-item" key={`${userName}-${card.name}-${index}`}>  
              <div className="pack-overlay-col">
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
              <small className="leaderboard-card-title">{card.displayname || card.name}</small>
              <small className="leaderboard-card-value">Value: ${Number(card.value).toFixed(2)}{card.qty > 1 ? ` x${card.qty}` : ''}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
