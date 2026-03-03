import React from 'react';
import { Card } from '../data/card';
import { addCardToRarity, pendingApproval, removeCardFromPendingApproval } from '../data/cards';

export function Approve({ userName }) {
  const title = "Approve Cards";
  const cardsPerPage = 40;
  const [pendingVersion, setPendingVersion] = React.useState(0);
  const renderedCards = Object.entries(pendingApproval)
    .map(([name, card]) => ({
      name,
      card: {
        ...card,
        name,
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [currentPage, setCurrentPage] = React.useState(1);
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

  const handleApprove = (name, card) => {
    if (!name || !card) return;
    const confirmed = window.confirm(`Are you sure you want to approve "${name}"?`);
    if (!confirmed) return;
    const rarity = card.rarity || 'Common';

    addCardToRarity(rarity, name, {
      ...card,
      rarity,
    });
    removeCardFromPendingApproval(name);
    setPendingVersion((value) => value + 1);
  };

  const handleDiscard = (name) => {
    if (!name) return;
    const confirmed = window.confirm(`Are you sure you want to discard "${name}"?`);
    if (!confirmed) return;
    removeCardFromPendingApproval(name);
    setPendingVersion((value) => value + 1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [userName, pendingVersion]);

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
          </div>
        </div>
        {userName && (
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
        )}
      </div>

      <div className="container-fluid">
        <div className="row deck-row">
          {paginatedCards.map(({ name, card }) => (
              <div className="col deck-col" key={name}>
                <div>
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
                <div className="card-value mt-1">
                  <small>Author: {card.author || 'Unknown'}</small>
                </div>
                <div className="deck-controls mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-success me-2"
                    onClick={() => handleApprove(name, card)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDiscard(name)}
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}