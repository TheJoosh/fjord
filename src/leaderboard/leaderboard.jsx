import React from 'react';
import { Card } from '../data/card';
import { gameApiClient } from '../../service/gameApiClient';

function normalizeWalletValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
}

export function Leaderboard({ userName }) {
  const [searchInput, setSearchInput] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalUsers, setTotalUsers] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [rows, setRows] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  React.useEffect(() => {
    let isActive = true;

    (async () => {
      if (!userName) {
        if (!isActive) return;
        setRows([]);
        setTotalUsers(0);
        setTotalPages(1);
        return;
      }

      setIsLoading(true);
      const nextState = await gameApiClient.loadLeaderboard({ page, search: searchTerm });
      if (!isActive) return;

      setRows(Array.isArray(nextState.rows) ? nextState.rows : []);
      setPage(Math.max(1, parseInt(nextState.page, 10) || page));
      setPageSize(Math.max(1, parseInt(nextState.pageSize, 10) || 20));
      setTotalUsers(Math.max(0, parseInt(nextState.totalUsers, 10) || 0));
      setTotalPages(Math.max(1, parseInt(nextState.totalPages, 10) || 1));
      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, [userName, page, searchTerm]);

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const rangeStart = totalUsers === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const rangeEnd = Math.min(page * pageSize, totalUsers);

  return (
    <main className="leaderboard-page">
      <section className="leaderboard-header">
        <h2>Deck Value Leaderboard</h2>
        <div className="leaderboard-controls">
          <label className="search-control">
            <span>Search Users</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Type a username"
              aria-label="Search users"
            />
          </label>
        </div>
        <div className="leaderboard-meta">
          <span>{rangeStart}-{rangeEnd} of {totalUsers}</span>
          <span>20 users per page</span>
        </div>
      </section>

      <section className="leaderboard-list" aria-busy={isLoading}>
        {rows.length === 0 && !isLoading && (
          <div className="leaderboard-empty">No matching users found.</div>
        )}

        {rows.map((row, rowIndex) => {
          const rank = ((page - 1) * pageSize) + rowIndex + 1;
          return (
            <article className="leaderboard-row" key={row.userName || rank}>
              <div className="leaderboard-rank">#{rank}</div>
              <div className="leaderboard-user">{row.userName || 'Unknown User'}</div>
              <div className="leaderboard-value">${normalizeWalletValue(row.deckValue).toFixed(2)}</div>

              <div className="leaderboard-top-cards">
                {(row.topCards || []).slice(0, 3).map((card, index) => (
                  <div className="leaderboard-card-item" key={`${row.userName}-${card.name}-${index}`}>
                    <div className="leaderboard-card-viewport" aria-hidden="true">
                      <Card
                        className="leaderboard-mini-card"
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
                    <small>{card.displayname || card.name}</small>
                    <small>Value: ${normalizeWalletValue(card.value).toFixed(2)}{card.qty > 1 ? ` x${card.qty}` : ''}</small>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <div className="deck-pagination-bottom-slot">
        <div className="deck-pagination">
          <button
            type="button"
            className="deck-pagination-arrow"
            disabled={!canGoPrevious}
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            aria-label="Previous leaderboard page"
          >
            ←
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            type="button"
            className="deck-pagination-arrow"
            disabled={!canGoNext}
            onClick={() => setPage((previous) => previous + 1)}
            aria-label="Next leaderboard page"
          >
            →
          </button>
        </div>
      </div>
    </main>
  );
}
