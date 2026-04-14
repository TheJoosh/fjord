import React from 'react';
import { Card } from '../data/card';
import { LeaderboardTopCardsCollapsible } from './LeaderboardTopCardsCollapsible';
import { gameApiClient } from '../../service/gameApiClient';
import { tradeRealtimeClient } from '../../service/tradeRealtimeClient';
import { useNavigate } from 'react-router-dom';

function normalizeWalletValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
}

function formatPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  const clamped = Math.max(0, Number(parsed.toFixed(2)));
  return clamped.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function Leaderboard({ userName }) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortBy, setSortBy] = React.useState('deckValue');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalUsers, setTotalUsers] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [rows, setRows] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const refreshTimerRef = React.useRef(null);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  React.useEffect(() => {
    const loadPreference = async () => {
      if (!userName) return;
      const preference = await gameApiClient.loadLeaderboardSortPreference(userName, 'deckValue');
      setSortBy(preference);
    };
    loadPreference();
  }, [userName]);

  React.useEffect(() => {
    setPage(1);
  }, [sortBy]);

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
      const nextState = await gameApiClient.loadLeaderboard({ page, search: searchTerm, sortBy });
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
  }, [userName, page, searchTerm, sortBy, refreshNonce]);

  React.useEffect(() => {
    if (!userName) return () => {};

    const unsubscribe = tradeRealtimeClient.subscribe((event) => {
      if (!event || event.channel !== 'trade') return;
      if (event.type !== 'leaderboard_updated' && event.type !== 'card_values_updated') return;

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        setRefreshNonce((current) => current + 1);
        refreshTimerRef.current = null;
      }, 120);
    });

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [userName]);

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const rangeStart = totalUsers === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const rangeEnd = Math.min(page * pageSize, totalUsers);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="leaderboard-page">
      <section className="leaderboard-header">
        <h2>
          {sortBy === 'cardsDesigned'
            ? 'Cards Designed Leaderboard'
            : sortBy === 'cardsUnlocked'
              ? 'Cards Unlocked Leaderboard'
              : 'Deck Value Leaderboard'}
        </h2>
        <div className="leaderboard-controls">
          <label className="sort-by-control">
            <span>Sort by</span>
            <select
              value={sortBy}
              onChange={(event) => {
                const newSortBy = event.target.value;
                setSortBy(newSortBy);
                if (userName) {
                  gameApiClient.saveLeaderboardSortPreference(userName, newSortBy);
                }
              }}
              aria-label="Sort leaderboard"
            >
              <option value="deckValue">Deck Value</option>
              <option value="cardsDesigned">Cards Designed</option>
              <option value="cardsUnlocked">Cards Unlocked</option>
            </select>
          </label>
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
        </div>
      </section>

      <section className="leaderboard-list" aria-busy={isLoading}>
        {rows.length === 0 && !isLoading && (
          <div className="leaderboard-empty">No matching users found.</div>
        )}

        {rows.map((row) => {
            // Always display the global absoluteRank as the rank number
            const rank = Number.isFinite(row.absoluteRank) ? row.absoluteRank : null;
            let rowClass = '';
            if (rank === 1) rowClass = 'leaderboard-row-gold';
            else if (rank === 2) rowClass = 'leaderboard-row-silver';
            else if (rank === 3) rowClass = 'leaderboard-row-bronze';
            return (
              <article className={`leaderboard-row${rowClass ? ' ' + rowClass : ''}`} key={row.userName || rank}>
                <div className="leaderboard-rank">{Number.isFinite(rank) ? `#${rank}` : ''}</div>
                <div className="leaderboard-user">{row.userName || 'Unknown User'}</div>
                <div className="leaderboard-value">
                  {sortBy === 'cardsDesigned'
                    ? `${row.cardsDesigned || 0} cards`
                    : sortBy === 'cardsUnlocked'
                      ? `${Math.max(0, parseInt(row.cardsUnlocked, 10) || 0)}/${Math.max(0, parseInt(row.totalUniqueCards, 10) || 0)} (${formatPercent(row.unlockedPercentage)}%)`
                      : `$${normalizeWalletValue(row.deckValue).toFixed(2)}`}
                  {row.topCards && row.topCards.length > 0 && (
                    <button
                      type="button"
                      className="view-deck-button"
                      onClick={() => {
                        const targetUser = encodeURIComponent(row.userName || '');
                        const modeQuery = sortBy === 'cardsDesigned' ? '&mode=designed' : '';
                        navigate('/deck?user=' + targetUser + modeQuery);
                      }}
                    >
                      {sortBy === 'cardsDesigned' ? 'View Designs' : 'View Deck'}
                    </button>
                  )}
                </div>

                <LeaderboardTopCardsCollapsible cards={row.topCards || []} userName={row.userName} />
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
            onClick={() => {
              scrollToTop();
              setPage((previous) => Math.max(1, previous - 1));
            }}
            aria-label="Previous leaderboard page"
          >
            ←
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            type="button"
            className="deck-pagination-arrow"
            disabled={!canGoNext}
            onClick={() => {
              scrollToTop();
              setPage((previous) => previous + 1);
            }}
            aria-label="Next leaderboard page"
          >
            →
          </button>
        </div>
      </div>
    </main>
  );
}
