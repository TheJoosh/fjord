import React from 'react';
import { Card } from '../data/card';
import { gameApiClient } from '../../service/gameApiClient';

export function AdminCards() {
  const title = 'Card Catalog';
  const cardsPerPage = 40;
  const [catalogVersion, setCatalogVersion] = React.useState(0);
  const [isEditOverlayOpen, setIsEditOverlayOpen] = React.useState(false);
  const [editingOriginalName, setEditingOriginalName] = React.useState('');
  const [editingDraft, setEditingDraft] = React.useState(null);
  const [editError, setEditError] = React.useState('');
  const [catalogCards, setCatalogCards] = React.useState([]);
  const renderedCards = React.useMemo(
    () => [...catalogCards].sort((a, b) => a.name.localeCompare(b.name)),
    [catalogCards]
  );

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

  const renderPaginationControls = () => {
    if (!showPagination) return null;

    return (
      <div className="deck-pagination">
        {showPreviousPageArrow && (
          <button type="button" className="deck-pagination-arrow" onClick={goToPreviousPage} aria-label="Previous page">←</button>
        )}
        <span>{startIndex}-{endIndex} of {totalRenderedCards}</span>
        {showNextPageArrow && (
          <button type="button" className="deck-pagination-arrow" onClick={goToNextPage} aria-label="Next page">→</button>
        )}
      </div>
    );
  };

  const loadCatalogCards = React.useCallback(async () => {
    setCatalogCards(await gameApiClient.loadAdminCardDesigns());
  }, []);

  const handleEdit = (name, card) => {
    if (!name || !card) return;
    setEditingOriginalName(name);
    setEditingDraft({
      name,
      displayname: card.displayname || name,
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

  const handleSaveEdit = async () => {
    if (!editingDraft || !editingOriginalName) return;

    const nextDisplayName = (editingDraft.displayname || '').trim();
    if (!nextDisplayName) {
      setEditError('Display name is required.');
      return;
    }

    const updatedCard = {
      displayname: nextDisplayName,
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

    const response = await gameApiClient.updateAdminCardDesign(
      editingOriginalName,
      editingOriginalName,
      updatedCard
    );

    if (!response.ok) {
      setEditError(response.error || 'Unable to save changes.');
      return;
    }

    if (response.persistedDisplayName && response.persistedDisplayName !== nextDisplayName) {
      setEditError(`Saved but persisted display name differs: ${response.persistedDisplayName}`);
    }

    if (response.updatedCard?.name && response.updatedCard?.card) {
      const updatedName = response.updatedCard.name;
      const updatedCard = {
        ...response.updatedCard.card,
        name: updatedName,
        displayname: response.updatedCard.card.displayname || updatedName,
      };

      setCatalogCards((previousCards) => previousCards.map((entry) => (
        entry.name === updatedName ? { ...entry, card: updatedCard } : entry
      )));
    }

    await loadCatalogCards();
    closeEditOverlay();
    setCatalogVersion((value) => value + 1);
  };

  React.useEffect(() => {
    (async () => {
      await loadCatalogCards();
    })();
  }, [loadCatalogCards]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [catalogVersion]);

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
        <div className="deck-value-row">
          <div className="deck-value-pagination-slot" aria-hidden={!showPagination}>
            {renderPaginationControls()}
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div className="row deck-row">
          {paginatedCards.map(({ name, card }) => (
            <div className="col deck-col" key={name}>
              <div>
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
              <div className="card-value mt-1">
                <small>Author: {card.author || 'Unknown'}</small>
              </div>
              <div className="deck-controls mt-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => handleEdit(name, card)}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="deck-pagination-bottom-slot" aria-hidden={!showPagination}>
          {renderPaginationControls()}
        </div>
      </div>

      {isEditOverlayOpen && editingDraft && (
        <div className="pexels-overlay" onClick={closeEditOverlay}>
          <div className="pexels-overlay-panel" onClick={(event) => event.stopPropagation()}>
            <div className="pexels-overlay-header">
              <h3>Edit Card</h3>
              <button type="button" className="pexels-overlay-close" onClick={closeEditOverlay}>Close</button>
            </div>

            <div className="designer" style={{ gap: '16px', alignItems: 'flex-start' }}>
              <div className="design-form">
                <div>
                  <span>Card Id:</span>
                  <input type="text" value={editingDraft.name} disabled />
                </div>
                <div>
                  <span>Display Name:</span>
                  <input type="text" value={editingDraft.displayname} onChange={(event) => handleEditDraftChange('displayname', event.target.value)} />
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
                  <select value={editingDraft.rarity} onChange={(event) => handleEditDraftChange('rarity', event.target.value)}>
                    <option value="Common">Common</option>
                    <option value="Uncommon">Uncommon</option>
                    <option value="Rare">Rare</option>
                    <option value="Loric">Loric</option>
                    <option value="Mythical">Mythical</option>
                    <option value="Legendary">Legendary</option>
                  </select>
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
                displayname={editingDraft.displayname || editingDraft.name || 'Card Name'}
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
