import React from 'react';
import { Card } from './card';
import { getCardByName, getCardScarcityScore } from '../data/cards';

export function Bank() {
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
          </div>
        </div>
        {userName && (
          <div className="deck-value-row">
            <div className="deck-value">
              Deck Value: ${deckValue.toFixed(2)}
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