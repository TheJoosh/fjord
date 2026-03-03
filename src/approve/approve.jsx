import React from 'react';
import { Card } from '../data/card';
import {
  addCardToRarity,
  pendingApproval,
  removeCardFromPendingApproval,
  updatePendingApprovalCard,
} from '../data/cards';

export function Approve({ userName }) {
  const title = "Approve Cards";
  const cardsPerPage = 40;
  const [pendingVersion, setPendingVersion] = React.useState(0);
  const [isEditOverlayOpen, setIsEditOverlayOpen] = React.useState(false);
  const [editingOriginalName, setEditingOriginalName] = React.useState('');
  const [editingDraft, setEditingDraft] = React.useState(null);
  const [editError, setEditError] = React.useState('');
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

  const handleEdit = (name, card) => {
    if (!name || !card) return;
    setEditingOriginalName(name);
    setEditingDraft({
      name,
      image: card.image || '',
      cost: card.cost != null ? String(card.cost) : '',
      rarity: card.rarity || 'Common',
      cardType: card.cardType || '',
      description: card.description || '',
      strength: card.strength != null ? String(card.strength) : '',
      endurance: card.endurance != null ? String(card.endurance) : '',
      author: card.author || '',
    });
    setEditError('');
    setIsEditOverlayOpen(true);
  };

  const handleEditDraftChange = (field, value) => {
    setEditingDraft((previousDraft) => ({
      ...(previousDraft || {}),
      [field]: value,
    }));
  };

  const closeEditOverlay = () => {
    setIsEditOverlayOpen(false);
    setEditingOriginalName('');
    setEditingDraft(null);
    setEditError('');
  };

  const parseStatValue = (value) => {
    if (value === '-' || value === '' || value == null) return '-';
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? '-' : parsed;
  };

  const handleSaveEdit = () => {
    if (!editingDraft || !editingOriginalName) return;

    const nextName = (editingDraft.name || '').trim();
    if (!nextName) {
      setEditError('Card name is required.');
      return;
    }

    const updatedCard = {
      image: (editingDraft.image || '').trim() || 'Default.png',
      cost: (editingDraft.cost || '').trim() || '-',
      rarity: (editingDraft.rarity || '').trim() || 'Common',
      cardType: (editingDraft.cardType || '').trim() || 'Type',
      description: editingDraft.description || '',
      strength: parseStatValue(editingDraft.strength),
      endurance: parseStatValue(editingDraft.endurance),
      author: (editingDraft.author || '').trim() || 'Unknown',
      value: 0,
    };

    const success = updatePendingApprovalCard(editingOriginalName, nextName, updatedCard);
    if (!success) {
      setEditError('Unable to save changes. Another pending card may already use that name.');
      return;
    }

    closeEditOverlay();
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
                    className="btn btn-sm btn-primary me-2"
                    onClick={() => handleEdit(name, card)}
                  >
                    Edit
                  </button>
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

      {isEditOverlayOpen && editingDraft && (
        <div className="pexels-overlay" onClick={closeEditOverlay}>
          <div className="pexels-overlay-panel" onClick={(event) => event.stopPropagation()}>
            <div className="pexels-overlay-header">
              <h3>Edit Pending Card</h3>
              <button type="button" className="pexels-overlay-close" onClick={closeEditOverlay}>Close</button>
            </div>

            <div className="designer" style={{ gap: '16px', alignItems: 'flex-start' }}>
              <div className="design-form">
                <div>
                  <span>Name:</span>
                  <input type="text" value={editingDraft.name} onChange={(event) => handleEditDraftChange('name', event.target.value)} />
                </div>
                <div>
                  <span>Image:</span>
                  <input type="text" value={editingDraft.image} onChange={(event) => handleEditDraftChange('image', event.target.value)} />
                </div>
                <div>
                  <span>Cost:</span>
                  <input type="text" value={editingDraft.cost} onChange={(event) => handleEditDraftChange('cost', event.target.value)} />
                </div>
                <div>
                  <span>Rarity:</span>
                  <input type="text" value={editingDraft.rarity} onChange={(event) => handleEditDraftChange('rarity', event.target.value)} />
                </div>
                <div>
                  <span>Type:</span>
                  <input type="text" value={editingDraft.cardType} onChange={(event) => handleEditDraftChange('cardType', event.target.value)} />
                </div>
                <div>
                  <span>Description:</span>
                  <textarea value={editingDraft.description} onChange={(event) => handleEditDraftChange('description', event.target.value)} />
                </div>
                <div>
                  <span>Strength:</span>
                  <input type="text" value={editingDraft.strength} onChange={(event) => handleEditDraftChange('strength', event.target.value)} />
                </div>
                <div>
                  <span>Endurance:</span>
                  <input type="text" value={editingDraft.endurance} onChange={(event) => handleEditDraftChange('endurance', event.target.value)} />
                </div>
                <div>
                  <span>Author:</span>
                  <input type="text" value={editingDraft.author} onChange={(event) => handleEditDraftChange('author', event.target.value)} />
                </div>

                {editError && <div className="pexels-error">{editError}</div>}

                <div className="deck-controls mt-2">
                  <button type="button" className="btn btn-sm btn-success me-2" onClick={handleSaveEdit}>Save</button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={closeEditOverlay}>Cancel</button>
                </div>
              </div>

              <Card
                image={editingDraft.image || 'Default.png'}
                name={editingDraft.name || 'Card Name'}
                cost={editingDraft.cost || '-'}
                rarity={editingDraft.rarity || 'Common'}
                cardType={editingDraft.cardType || 'Type'}
                description={editingDraft.description || ''}
                strength={parseStatValue(editingDraft.strength)}
                endurance={parseStatValue(editingDraft.endurance)}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}