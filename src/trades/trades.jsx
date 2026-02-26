import React from 'react';
import { Card } from '../deck/card';
import { getCardByName, recalcCardValues } from '../data/cards';
import { getUser, users } from '../data/users';

export function Trades({ userName }) {
        const currentUserLabel = userName || 'User';
    const [isRequestOverlayOpen, setIsRequestOverlayOpen] = React.useState(false);
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
        <h2 className="other_user">Other User</h2>
        <section className="other">
            <div className="container-fluid">
                <div className="row">
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/thor.png" alt="Thor, God of Thunder"/>
                            </div>
                            <div className="card-cost">5</div>
                            <div className="card-content">
                                <h1 className="card-name">Thor, God of Thunder</h1>
                                <span className="card-type">Legendary Warrior</span>
                                <span className="card-description">Passive - the strength of all enemy warriors is reduced by 1 while this card is in play</span>
                            </div>
                            <div className="card-stats">5/3</div>
                        </div>
                    </div>
                </div>
            </div>
                

            <h3 className="value">Trade Value: $0.00</h3>
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
                    <input type="text" className="pexels-query" placeholder="Input username" />
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