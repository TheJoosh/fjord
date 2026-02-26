import React from 'react';
import { Card } from '../deck/card';
import { getCardByName, recalcCardValues } from '../data/cards';
import { getUser, users } from '../data/users';

export function Trades({ userName }) {
        const currentUserLabel = userName || 'User';
    const [isRequestOverlayOpen, setIsRequestOverlayOpen] = React.useState(false);
    const [requestUserInput, setRequestUserInput] = React.useState('');
    const [requestUserError, setRequestUserError] = React.useState('');
    const [otherUserLabel, setOtherUserLabel] = React.useState('Other User');
    const [otherTradeCards, setOtherTradeCards] = React.useState([]);
        const [isDeckOverlayOpen, setIsDeckOverlayOpen] = React.useState(false);
        const [ownedDeckCards, setOwnedDeckCards] = React.useState([]);
        const tradeSelectionStorageKey = userName ? `tradeSelection:${userName}` : 'tradeSelection';
        const [selectedTradeCards, setSelectedTradeCards] = React.useState(() => {
            try {
                const raw = localStorage.getItem(tradeSelectionStorageKey);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        });
        const ownedCardsStorageKey = userName ? `ownedCards:${userName}` : null;

        const simulatedUsers = Object.fromEntries(
            Object.entries(users || {}).map(([name, data]) => [
                name,
                {
                    ...data,
                    cards: { ...(data.cards || {}) },
                    packs: { ...(data.packs || {}) },
                },
            ])
        );

        if (userName && simulatedUsers[userName]) {
            for (const card of selectedTradeCards) {
                if (!card?.name) continue;
                simulatedUsers[userName].cards[card.name] =
                    (Math.max(0, parseInt(simulatedUsers[userName].cards[card.name], 10) || 0) + 1);
            }
        }

        recalcCardValues(simulatedUsers);
        const activeUser = getUser(userName);

        const buildOwnedDeckCards = React.useCallback(() => {
            const fallbackCards = activeUser?.cards || {};
            let sourceEntries = [];

            if (ownedCardsStorageKey) {
                try {
                    const raw = localStorage.getItem(ownedCardsStorageKey);
                    const parsed = raw ? JSON.parse(raw) : [];
                    if (Array.isArray(parsed)) {
                        sourceEntries = parsed;
                    }
                } catch {
                    sourceEntries = [];
                }
            }

            const byName = new Map();

            if (sourceEntries.length > 0) {
                for (const entry of sourceEntries) {
                    if (!entry?.name) continue;
                    const currentQty = byName.get(entry.name) || 0;
                    byName.set(entry.name, currentQty + Math.max(0, parseInt(entry.qty, 10) || 0));
                }
            } else {
                for (const [name, qty] of Object.entries(fallbackCards)) {
                    byName.set(name, Math.max(0, parseInt(qty, 10) || 0));
                }
            }

            return Array.from(byName.entries())
                .map(([name, qty]) => {
                    const card = getCardByName(name);
                    if (!card || qty <= 0) return null;
                    return { ...card, qty };
                })
                .filter(Boolean)
                .sort((a, b) => a.name.localeCompare(b.name));
        }, [activeUser, ownedCardsStorageKey]);

        React.useEffect(() => {
            if (!isDeckOverlayOpen) return;
            setOwnedDeckCards(buildOwnedDeckCards());
        }, [isDeckOverlayOpen, buildOwnedDeckCards]);

        React.useEffect(() => {
            try {
                const raw = localStorage.getItem(tradeSelectionStorageKey);
                const parsed = raw ? JSON.parse(raw) : [];
                setSelectedTradeCards(Array.isArray(parsed) ? parsed : []);
            } catch {
                setSelectedTradeCards([]);
            }
        }, [tradeSelectionStorageKey]);

        React.useEffect(() => {
            localStorage.setItem(tradeSelectionStorageKey, JSON.stringify(selectedTradeCards));
        }, [tradeSelectionStorageKey, selectedTradeCards]);

        React.useEffect(() => {
            if (!isRequestOverlayOpen && !isDeckOverlayOpen) return;

            const handleKeyDown = (event) => {
                if (event.key !== 'Escape') return;
                setIsRequestOverlayOpen(false);
                setIsDeckOverlayOpen(false);
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }, [isRequestOverlayOpen, isDeckOverlayOpen]);

        const resolveUserNameFromStorage = (inputName) => {
            const target = (inputName || '').trim();
            if (!target) return null;

            try {
                const rawUsers = localStorage.getItem('users');
                const parsedUsers = rawUsers ? JSON.parse(rawUsers) : null;

                if (parsedUsers && typeof parsedUsers === 'object' && !Array.isArray(parsedUsers)) {
                    const keys = Object.keys(parsedUsers);
                    const exact = keys.find((name) => name === target);
                    if (exact) return exact;
                    const insensitive = keys.find((name) => name.toLowerCase() === target.toLowerCase());
                    if (insensitive) return insensitive;
                }

                if (Array.isArray(parsedUsers)) {
                    const names = parsedUsers
                        .map((entry) => (typeof entry === 'string' ? entry : entry?.name || entry?.userName || null))
                        .filter(Boolean);
                    const exact = names.find((name) => name === target);
                    if (exact) return exact;
                    const insensitive = names.find((name) => name.toLowerCase() === target.toLowerCase());
                    if (insensitive) return insensitive;
                }
            } catch {
                // Ignore malformed localStorage value.
            }

            const fallbackKeys = Object.keys(users || {});
            const exactFallback = fallbackKeys.find((name) => name === target);
            if (exactFallback) return exactFallback;
            return fallbackKeys.find((name) => name.toLowerCase() === target.toLowerCase()) || null;
        };

        const handleRequestTradeUser = () => {
            const matchedUserName = resolveUserNameFromStorage(requestUserInput);
            if (!matchedUserName) {
                setRequestUserError('User not found');
                return;
            }

            if (userName && matchedUserName.toLowerCase() === userName.toLowerCase()) {
                setRequestUserError('You cannot request a trade with yourself');
                return;
            }

            const buildPoolFromDeck = (targetUserName) => {
                const storageKey = `ownedCards:${targetUserName}`;
                let sourceEntries = [];

                try {
                    const raw = localStorage.getItem(storageKey);
                    const parsed = raw ? JSON.parse(raw) : [];
                    sourceEntries = Array.isArray(parsed) ? parsed : [];
                } catch {
                    sourceEntries = [];
                }

                if (!sourceEntries.length) {
                    const fallbackUser = getUser(targetUserName);
                    sourceEntries = Object.entries(fallbackUser?.cards || {}).map(([name, qty]) => ({
                        name,
                        qty: Math.max(0, parseInt(qty, 10) || 0),
                    }));
                }

                const pool = [];
                for (const entry of sourceEntries) {
                    if (!entry?.name) continue;
                    const qty = Math.max(0, parseInt(entry.qty, 10) || 0);
                    const card = getCardByName(entry.name);
                    if (!card || qty <= 0) continue;
                    for (let i = 0; i < qty; i += 1) {
                        pool.push({ ...card });
                    }
                }

                return pool;
            };

            const pool = buildPoolFromDeck(matchedUserName);
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            const pickCount = Math.min(
                shuffled.length,
                Math.max(1, Math.floor(Math.random() * 5) + 1)
            );
            const pickedCards = shuffled.slice(0, pickCount).map((card, index) => ({
                ...card,
                otherTradeEntryId: `${card.name}-${Date.now()}-${index}-${Math.random()}`,
            }));

            setRequestUserError('');
            setOtherUserLabel(matchedUserName);
            setOtherTradeCards(pickedCards);
            setIsRequestOverlayOpen(false);
        };

        const handleDeckCardClick = (clickedCard) => {
            const cardName = clickedCard?.name;
            if (!ownedCardsStorageKey || !cardName) return;

            const currentQty = Math.max(0, parseInt(activeUser?.cards?.[cardName], 10) || 0);
            if (activeUser?.cards && currentQty > 0) {
                if (currentQty <= 1) {
                    delete activeUser.cards[cardName];
                } else {
                    activeUser.cards[cardName] = currentQty - 1;
                }
            }

            let sourceEntries = [];
            try {
                const raw = localStorage.getItem(ownedCardsStorageKey);
                const parsed = raw ? JSON.parse(raw) : [];
                sourceEntries = Array.isArray(parsed) ? parsed : [];
            } catch {
                sourceEntries = [];
            }

            const byName = new Map();
            if (sourceEntries.length > 0) {
                for (const entry of sourceEntries) {
                    if (!entry?.name) continue;
                    const existingQty = byName.get(entry.name) || 0;
                    byName.set(entry.name, existingQty + Math.max(0, parseInt(entry.qty, 10) || 0));
                }
            } else {
                for (const [name, qty] of Object.entries(activeUser?.cards || {})) {
                    byName.set(name, Math.max(0, parseInt(qty, 10) || 0));
                }
            }

            const nextQty = Math.max(0, (byName.get(cardName) || 0) - 1);
            if (nextQty > 0) {
                byName.set(cardName, nextQty);
            } else {
                byName.delete(cardName);
            }

            const nextOwned = Array.from(byName.entries()).map(([name, qty]) => ({
                name,
                qty,
                card: getCardByName(name),
            }));

            localStorage.setItem(ownedCardsStorageKey, JSON.stringify(nextOwned));
            setOwnedDeckCards(buildOwnedDeckCards());

            setSelectedTradeCards((prev) => ([
                ...prev,
                {
                    ...clickedCard,
                    tradeEntryId: `${clickedCard.name}-${Date.now()}-${Math.random()}`,
                },
            ]));
        };

        const userTradeValue = selectedTradeCards.reduce((sum, card) => {
            const value = card && typeof card.value === 'number' ? card.value : 0;
            return sum + value;
        }, 0);

        const otherTradeValue = otherTradeCards.reduce((sum, card) => {
            const value = card && typeof card.value === 'number' ? card.value : 0;
            return sum + value;
        }, 0);

        const handleCancelTrade = () => {
            if (!selectedTradeCards.length) return;

            const restoreCounts = new Map();
            for (const card of selectedTradeCards) {
                if (!card?.name) continue;
                restoreCounts.set(card.name, (restoreCounts.get(card.name) || 0) + 1);
            }

            if (activeUser?.cards) {
                for (const [name, qty] of restoreCounts.entries()) {
                    activeUser.cards[name] = (Math.max(0, parseInt(activeUser.cards[name], 10) || 0) + qty);
                }
            }

            if (ownedCardsStorageKey) {
                let sourceEntries = [];
                try {
                    const raw = localStorage.getItem(ownedCardsStorageKey);
                    const parsed = raw ? JSON.parse(raw) : [];
                    sourceEntries = Array.isArray(parsed) ? parsed : [];
                } catch {
                    sourceEntries = [];
                }

                const byName = new Map();
                for (const entry of sourceEntries) {
                    if (!entry?.name) continue;
                    byName.set(entry.name, (byName.get(entry.name) || 0) + Math.max(0, parseInt(entry.qty, 10) || 0));
                }

                for (const [name, qty] of restoreCounts.entries()) {
                    byName.set(name, (byName.get(name) || 0) + qty);
                }

                const nextOwned = Array.from(byName.entries()).map(([name, qty]) => ({
                    name,
                    qty,
                    card: getCardByName(name),
                }));

                localStorage.setItem(ownedCardsStorageKey, JSON.stringify(nextOwned));
            }

            setSelectedTradeCards([]);
            if (isDeckOverlayOpen) {
                setOwnedDeckCards(buildOwnedDeckCards());
            }
        };

  return (
        <main className="trades-page">

        <button className="request" onClick={() => setIsRequestOverlayOpen(true)}>Request trade</button>
        <h2 className="other_user">{otherUserLabel}</h2>
        <section className="other">
            <div className="container-fluid">
                <div className="row deck-row">
                    {otherTradeCards.map((card) => (
                        <div key={card.otherTradeEntryId} className="col deck-col">
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
                    ))}
                </div>
            </div>
                

            <h3 className="value">Trade Value: ${otherTradeValue.toFixed(2)}</h3>
        </section>

        <button className="accept">
            <h2>Accept Trade</h2>
        </button>

        <button className="cancel" onClick={handleCancelTrade}>
            <h2>Cancel Trade</h2>
        </button>
            <h2 className="user_name">{currentUserLabel}</h2>
            <section className="yoUser">
            <div className="container-fluid">
                <div className="row deck-row">
                    {selectedTradeCards.map((card) => (
                        <div key={card.tradeEntryId} className="col deck-col">
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
                    ))}
                </div>
            </div>
                

            <h3 className="value">Trade Value: ${userTradeValue.toFixed(2)}</h3>
        </section>

            <button className="picker" onClick={() => setIsDeckOverlayOpen(true)}>Pick from your deck</button>

        {isRequestOverlayOpen && (
            <div className="pexels-overlay" onClick={() => setIsRequestOverlayOpen(false)}>
                <div className="pexels-overlay-panel" onClick={e => e.stopPropagation()}>
                    <div className="pexels-overlay-header">
                        <h3>Request Trade</h3>
                        <button type="button" className="pexels-overlay-close" onClick={() => setIsRequestOverlayOpen(false)}>Close</button>
                    </div>
                    <div className="pexels-actions">
                        <input
                            type="text"
                            className="pexels-query"
                            placeholder="Input username"
                            value={requestUserInput}
                            onChange={(e) => {
                                setRequestUserInput(e.target.value);
                                if (requestUserError) {
                                    setRequestUserError('');
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return;
                                e.preventDefault();
                                handleRequestTradeUser();
                            }}
                        />
                        <button type="button" onClick={handleRequestTradeUser}>Request</button>
                    </div>
                    {requestUserError && <div className="pexels-error">{requestUserError}</div>}
                </div>
            </div>
        )}

        {isDeckOverlayOpen && (
            <div className="pexels-overlay" onClick={() => setIsDeckOverlayOpen(false)}>
                <div className="pexels-overlay-panel pack-overlay-panel" onClick={e => e.stopPropagation()}>
                    <div className="pexels-overlay-header">
                        <h3>{currentUserLabel}'s Deck</h3>
                        <button type="button" className="pexels-overlay-close" onClick={() => setIsDeckOverlayOpen(false)}>Close</button>
                    </div>

                    {!ownedDeckCards.length ? (
                        <div className="pexels-overlay-state">No cards found in this deck.</div>
                    ) : (
                        <div className="row deck-row pack-overlay-cards">
                            {ownedDeckCards.map((card) => (
                                <div key={card.name} className="col deck-col pack-overlay-col">
                                    <button
                                        type="button"
                                        className="trade-deck-card-btn"
                                        onClick={() => handleDeckCardClick(card)}
                                        title="Remove 1 from your deck"
                                    >
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
                                    </button>
                                    <div className="card-value mt-1">
                                        <div className="card-meta-row">
                                            <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                                            <small className="card-quantity">Quantity: {card.qty}</small>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
        

    </main>
  );
}