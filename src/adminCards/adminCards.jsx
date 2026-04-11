import React from 'react';
import { Card } from '../data/card';
import { gameApiClient } from '../../service/gameApiClient';
import { tradeRealtimeClient } from '../../service/tradeRealtimeClient';

function matchesCardSearch(card, searchTerm) {
  const normalizedQuery = String(searchTerm || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  const searchableFields = [
    card?.name,
    card?.displayname,
    card?.rarity,
    card?.cardType,
    card?.description,
    card?.author,
  ];

  return searchableFields.some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
}

export function AdminCards({ isAdmin }) {
  const title = 'Card Catalog';
  const sortOptions = ['Name', 'Rarity', 'Author', 'Value'];
  const getDefaultSortDirection = React.useCallback((option) => (option === 'Value' ? 'desc' : 'asc'), []);
  const cardsPerPage = 40;
  const [catalogVersion, setCatalogVersion] = React.useState(0);
  const [isEditOverlayOpen, setIsEditOverlayOpen] = React.useState(false);
  const [editingOriginalName, setEditingOriginalName] = React.useState('');
  const [editingDraft, setEditingDraft] = React.useState(null);
  const [editError, setEditError] = React.useState('');
  const [catalogCards, setCatalogCards] = React.useState([]);
  const [sortBy, setSortBy] = React.useState('Name');
  const [sortDirection, setSortDirection] = React.useState('asc');
  const [sortSelectValue, setSortSelectValue] = React.useState('Name');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [valuesRefreshNonce, setValuesRefreshNonce] = React.useState(0);
  const valuesRefreshTimerRef = React.useRef(null);
  const renderedCards = React.useMemo(
    () => {
      // Always filter by search term, even for undiscovered cards
      const filteredCards = catalogCards.filter((entry) => matchesCardSearch(entry?.card, searchTerm));

      return [...filteredCards].sort((a, b) => {
        const applyDirection = (comparison) => (sortDirection === 'asc' ? comparison : -comparison);

        if (sortBy === 'Value') {
          const aValue = typeof a?.card?.value === 'number' ? a.card.value : 0;
          const bValue = typeof b?.card?.value === 'number' ? b.card.value : 0;
          const valueDiff = applyDirection(aValue - bValue);
          if (valueDiff !== 0) return valueDiff;
          return a.name.localeCompare(b.name);
        }

        if (sortBy === 'Rarity') {
          const rarityDiff = applyDirection(
            String(a?.card?.rarity || '').localeCompare(String(b?.card?.rarity || ''))
          );
          if (rarityDiff !== 0) return rarityDiff;
          return a.name.localeCompare(b.name);
        }

        if (sortBy === 'Author') {
          const authorDiff = applyDirection(
            String(a?.card?.author || '').localeCompare(String(b?.card?.author || ''))
          );
          if (authorDiff !== 0) return authorDiff;
          return a.name.localeCompare(b.name);
        }

        return applyDirection(a.name.localeCompare(b.name));
      });
    },
    [catalogCards, sortBy, searchTerm, isAdmin, sortDirection]
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPreviousPage = () => {
    scrollToTop();
    setCurrentPage((previousPage) => Math.max(1, previousPage - 1));
  };

  const goToNextPage = () => {
    scrollToTop();
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
    if (isAdmin) {
      const adminCards = await gameApiClient.loadAdminCardDesigns();
      // Admin sees all cards as discovered
      setCatalogCards(adminCards.map((entry) => ({ ...entry, discovered: true })));
    } else {
      setCatalogCards(await gameApiClient.loadCatalogDesigns());
    }
  }, [isAdmin]);

  const handleSortByChange = React.useCallback((nextSortBy) => {
    if (!nextSortBy) return;

    if (nextSortBy === sortBy) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection(getDefaultSortDirection(nextSortBy));
  }, [sortBy, getDefaultSortDirection]);

  const armSortSelect = React.useCallback(() => {
    setSortSelectValue('');
  }, []);

  React.useEffect(() => {
    setSortSelectValue(sortBy);
  }, [sortBy]);

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
  }, [loadCatalogCards, valuesRefreshNonce]);

  React.useEffect(() => {
    const unsubscribe = tradeRealtimeClient.subscribe((event) => {
      if (!event || event.channel !== 'trade') return;
      if (event.type !== 'card_values_updated' && event.type !== 'catalog_updated') return;

      if (valuesRefreshTimerRef.current) {
        window.clearTimeout(valuesRefreshTimerRef.current);
      }

      valuesRefreshTimerRef.current = window.setTimeout(() => {
        setValuesRefreshNonce((current) => current + 1);
        valuesRefreshTimerRef.current = null;
      }, 120);
    });

    return () => {
      unsubscribe();
      if (valuesRefreshTimerRef.current) {
        window.clearTimeout(valuesRefreshTimerRef.current);
        valuesRefreshTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [catalogVersion, sortBy, searchTerm]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Count discovered and total cards for non-admins
  const discoveredCount = isAdmin ? null : catalogCards.filter((entry) => entry.discovered).length;
  const totalCount = isAdmin ? null : catalogCards.length;

  return (
    <main>
      <div className="user">
        <div className="user-header-row">
          <h2>{title}
            {!isAdmin && (
                <span style={{ fontSize: '1.5rem', fontWeight: 'normal', marginLeft: '1em' }}>
                  - {discoveredCount} out of {totalCount} cards unlocked
                </span>
            )}
          </h2>
          <div className="deck-controls">
            <label className="sort-by-control">
              <span>Sort By {sortDirection === 'asc' ? '↑' : '↓'}</span>
              <select
                value={sortSelectValue}
                onMouseDown={armSortSelect}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
                    armSortSelect();
                  }
                }}
                onBlur={() => {
                  if (!sortSelectValue) setSortSelectValue(sortBy);
                }}
                onChange={(event) => {
                  const nextSortBy = event.target.value;
                  if (!nextSortBy) {
                    setSortSelectValue(sortBy);
                    return;
                  }
                  handleSortByChange(nextSortBy);
                  setSortSelectValue(nextSortBy);
                }}
              >
                <option value="" disabled hidden>Sort By</option>
                {sortOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="search-control">
              <span>Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name, rarity, class..."
                aria-label="Search catalog cards"
              />
            </label>
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
          {paginatedCards.map(({ name, card, discovered }) => {
            const isVisible = isAdmin || discovered;
            return (
              <div className="col deck-col" key={name}>
                <div>
                  <Card
                    image={isVisible ? card.image : 'Unknown.png'}
                    name={isVisible ? card.name : '???'}
                    displayname={isVisible ? card.displayname : '???'}
                    cost={isVisible ? card.cost : '-'}
                    rarity={isVisible ? card.rarity : 'Common'}
                    cardType={isVisible ? card.cardType : '???'}
                    description={isVisible ? card.description : ''}
                    strength={isVisible ? card.strength : '-'}
                    endurance={isVisible ? card.endurance : '-'}
                    imageOnly={!isVisible}
                  />
                </div>
                <div className="card-value mt-1">
                  <h6>{isVisible ? (card.displayname || card.name || 'Unknown') : 'Locked'}</h6>
                </div>
                <div className="card-value mt-1">
                  <div className="card-meta-row">
                    <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                  </div>
                  <small>Author: {card.author || 'Unknown'}</small>
                </div>
                {isAdmin && (
                  <div className="deck-controls mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleEdit(name, card)}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="deck-pagination-bottom-slot" aria-hidden={!showPagination}>
          {renderPaginationControls()}
        </div>
      </div>

      {isAdmin && isEditOverlayOpen && editingDraft && (
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


