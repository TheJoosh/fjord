import React from 'react';
import { Card } from '../data/card';
import { gameApiClient } from '../../service/gameApiClient';
import { tradeRealtimeClient } from '../../service/tradeRealtimeClient';

export function Trades({ userName, openTradeMenu }) {
    const currentUserLabel = userName || 'User';
    const requestUserInputRef = React.useRef(null);
    const [isRequestOverlayOpen, setIsRequestOverlayOpen] = React.useState(Boolean(openTradeMenu));

    // Open the trade menu if openTradeMenu prop is set
    React.useEffect(() => {
        if (openTradeMenu) setIsRequestOverlayOpen(true);
    }, [openTradeMenu]);
    const [requestUserInput, setRequestUserInput] = React.useState('');
    const [requestUserError, setRequestUserError] = React.useState('');
    const [tradeSuccessMessage, setTradeSuccessMessage] = React.useState('');
    const [tradeErrorMessage, setTradeErrorMessage] = React.useState('');
    const [otherUserLabel, setOtherUserLabel] = React.useState('Other User');
    const [otherUserName, setOtherUserName] = React.useState('');
    const [otherTradeCards, setOtherTradeCards] = React.useState([]);
    const [isDeckOverlayOpen, setIsDeckOverlayOpen] = React.useState(false);
    const [ownedDeckCards, setOwnedDeckCards] = React.useState([]);
    const [selectedTradeCards, setSelectedTradeCards] = React.useState([]);
    const [iAccepted, setIAccepted] = React.useState(false);
    const [otherAccepted, setOtherAccepted] = React.useState(false);
    const suppressNextTradeSavesRef = React.useRef(0);
    const hasValidTradePartner = Boolean(otherUserName);

    const getDisplayCardValue = React.useCallback((cardLike) => {
        const value = Number(cardLike?.value);
        return Number.isFinite(value) ? value : 0;
    }, []);

    const buildOwnedDeckCards = React.useCallback(async () => {
        return await gameApiClient.buildOwnedDeckCards(userName);
    }, [userName]);

    const refreshTradeStateFromServer = React.useCallback(async () => {
        if (!userName) return;

        const [nextPendingTrade, nextSelectedTradeCards] = await Promise.all([
            gameApiClient.loadPendingTrade(),
            gameApiClient.loadSelectedTradeCards(),
        ]);

        suppressNextTradeSavesRef.current = 2;
        setOtherUserLabel(nextPendingTrade.otherUserLabel);
        setOtherUserName(nextPendingTrade.otherUserName);
        setOtherTradeCards(nextPendingTrade.otherTradeCards);
        setSelectedTradeCards(nextSelectedTradeCards);
        setIAccepted(Boolean(nextPendingTrade.iAccepted));
        setOtherAccepted(Boolean(nextPendingTrade.otherAccepted));

        if (isDeckOverlayOpen) {
            setOwnedDeckCards(await buildOwnedDeckCards());
        }
    }, [userName, isDeckOverlayOpen, buildOwnedDeckCards]);

    React.useEffect(() => {
        if (!isDeckOverlayOpen) return;
        (async () => {
            setOwnedDeckCards(await buildOwnedDeckCards());
        })();
    }, [isDeckOverlayOpen, buildOwnedDeckCards]);

    React.useEffect(() => {
        if (!userName) return;
        (async () => {
            await refreshTradeStateFromServer();
        })();
    }, [userName, refreshTradeStateFromServer]);

    React.useEffect(() => {
        if (!userName) return;

        const unsubscribe = tradeRealtimeClient.subscribe((event) => {
            if (!event || event.channel !== 'trade') return;

            (async () => {
                if (event.type === 'trade_request_received') {
                    // New incoming requests are surfaced by the global app banner.
                    // Do not auto-open on the trades page.
                    return;
                }

                if (event.type === 'trade_state_updated') {
                    await refreshTradeStateFromServer();
                    return;
                }

                if (event.type === 'card_values_updated') {
                    await refreshTradeStateFromServer();
                    return;
                }

                if (event.type === 'trade_cancelled') {
                    setTradeSuccessMessage('Trade was cancelled.');
                    setTradeErrorMessage('');
                    await refreshTradeStateFromServer();
                    return;
                }

                if (event.type === 'trade_completed') {
                    setTradeSuccessMessage('Trade completed successfully.');
                    setTradeErrorMessage('');
                    await refreshTradeStateFromServer();
                }

                if (event.type === 'trade_accepted') {
                    await refreshTradeStateFromServer();
                }
            })();
        });

        return () => {
            unsubscribe();
        };
    }, [userName, refreshTradeStateFromServer]);

    // Removed auto-save effect for selectedTradeCards. Save only in handlers below.

    // Only save pending trade when the user actually changes the trade partner or offer, not on every state update.
    // This disables the automatic save on mount/refresh, preventing race conditions.
    // You can trigger a save manually in handlers where the user makes changes (e.g., handleRequestTradeUser, handleCancelTrade, etc.)

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

    React.useEffect(() => {
        if (!isRequestOverlayOpen) return;

        const frame = window.requestAnimationFrame(() => {
            requestUserInputRef.current?.focus();
            requestUserInputRef.current?.select();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isRequestOverlayOpen]);

    const selectedCountsByName = React.useMemo(() => {
        const counts = {};
        for (const card of selectedTradeCards) {
            if (!card?.name) continue;
            counts[card.name] = (counts[card.name] || 0) + 1;
        }
        return counts;
    }, [selectedTradeCards]);

    const availableDeckCards = React.useMemo(() => {
        return ownedDeckCards
            .map((card) => {
                if (!card?.name) return null;
                const ownedQty = Math.max(0, parseInt(card.qty, 10) || 0);
                const selectedQty = Math.max(0, parseInt(selectedCountsByName[card.name], 10) || 0);
                const remainingQty = Math.max(0, ownedQty - selectedQty);
                if (remainingQty <= 0) return null;
                return {
                    ...card,
                    qty: remainingQty,
                };
            })
            .filter(Boolean);
    }, [ownedDeckCards, selectedCountsByName]);

    const handleRequestTradeUser = async () => {
        const response = await gameApiClient.requestTradeUser(requestUserInput);
        if (response.error) {
            setRequestUserError(response.error);
            return;
        }

        // Server already persisted both users' pending trades; skip one local pending-save cycle
        // to avoid emitting a redundant counterparty update that can auto-open their Trades page.
        suppressNextTradeSavesRef.current = 1;
        setRequestUserError('');
        setTradeSuccessMessage('');
        setTradeErrorMessage('');
        setOtherUserLabel(response.otherUserLabel);
        setOtherUserName(response.otherUserName);
        setOtherTradeCards(response.otherTradeCards);
        setIsRequestOverlayOpen(false);
    };

    const handleDeckCardClick = async (clickedCard) => {
        const cardName = clickedCard?.name;
        if (!userName || !cardName) return;

    // clickedCard.qty is already the remaining selectable quantity (owned minus already selected),
    // computed by availableDeckCards — no need to subtract selectedCountsByName again.
    const remainingQty = Math.max(0, parseInt(clickedCard?.qty, 10) || 0);
    if (remainingQty <= 0) return;

        setSelectedTradeCards((prev) => {
            const next = [
                ...prev,
                {
                    ...clickedCard,
                    tradeEntryId: `${clickedCard.name}-${Date.now()}-${Math.random()}`,
                },
            ];
            // Save to backend
            gameApiClient.saveSelectedTradeCards(next);
            return next;
        });
    };

    const handleRemoveTradeCard = async (tradeEntryId) => {
        const tradeCard = selectedTradeCards.find((card) => card.tradeEntryId === tradeEntryId);
        if (!tradeCard?.name || !userName) return;
        setSelectedTradeCards((prev) => {
            const next = prev.filter((card) => card.tradeEntryId !== tradeEntryId);
            // Save to backend
            gameApiClient.saveSelectedTradeCards(next);
            return next;
        });
    };

    const userTradeValue = selectedTradeCards.reduce((sum, card) => {
        return sum + getDisplayCardValue(card);
    }, 0);

    const otherTradeValue = otherTradeCards.reduce((sum, card) => {
        return sum + getDisplayCardValue(card);
    }, 0);

    const handleCancelTrade = async () => {
        await gameApiClient.cancelTrade(selectedTradeCards);

        setSelectedTradeCards([]);
        setOtherTradeCards([]);
        setOtherUserName('');
        setOtherUserLabel('Other User');
        setIAccepted(false);
        setOtherAccepted(false);
        setTradeSuccessMessage('');
        setTradeErrorMessage('');
    };

    const handleAcceptTrade = async () => {
        if (!userName || !otherUserName) return;

        const result = await gameApiClient.acceptTrade(otherUserName);
        if (!result?.ok) {
            setTradeErrorMessage(result?.error || 'Unable to accept trade. Please try again.');
            setTradeSuccessMessage('');
            return;
        }

        if (result.waiting) {
            setIAccepted(true);
            setTradeSuccessMessage('Waiting for the other player to accept...');
            setTradeErrorMessage('');
            return;
        }

        // Both players accepted — trade is complete.
        setSelectedTradeCards([]);
        setOtherTradeCards([]);
        setOtherUserName('');
        setOtherUserLabel('Other User');
        setIAccepted(false);
        setOtherAccepted(false);
        setTradeSuccessMessage('Your trade was successful!');
        setTradeErrorMessage('');
        if (isDeckOverlayOpen) {
            setOwnedDeckCards(await buildOwnedDeckCards());
        }
    };

    return (
        <main className="trades-page">
            <button className="request" onClick={() => setIsRequestOverlayOpen(true)}>Request trade</button>
            {tradeSuccessMessage && <div className="trade-success-message">{tradeSuccessMessage}</div>}
            {tradeErrorMessage && <div className="pexels-error">{tradeErrorMessage}</div>}
            {hasValidTradePartner && (
                <>
                    <h2 className="other_user">{otherUserLabel}</h2>
                    <section className="other">
                        <div className="container-fluid">
                            <div className="row deck-row">
                                {otherTradeCards.map((card) => (
                                    <div key={card.otherTradeEntryId} className="col deck-col">
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
                                        <div className="card-value mt-1">
                                            <small>Value: ${getDisplayCardValue(card).toFixed(2)}</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <h3 className="value">Trade Value: ${otherTradeValue.toFixed(2)}</h3>
                    </section>

                    {otherAccepted && (
                        <div className="trade-success-message">{otherUserLabel} has accepted the trade!</div>
                    )}
                    <button className="accept" onClick={handleAcceptTrade} disabled={iAccepted}>
                        <h2>{iAccepted ? 'Waiting for other player...' : 'Accept Trade'}</h2>
                    </button>

                    <button className="cancel" onClick={handleCancelTrade}>
                        <h2>Cancel Trade</h2>
                    </button>
                    <h2 className="user_name">{currentUserLabel}</h2>
                    <h3 className="value">Trade Value: ${userTradeValue.toFixed(2)}</h3>
                    <button className="picker" onClick={() => setIsDeckOverlayOpen(true)}>Pick from your deck</button>
                    <section className="yoUser">
                        <div className="container-fluid">
                            <div className="row deck-row">
                                {selectedTradeCards.map((card) => (
                                    <div key={card.tradeEntryId} className="col deck-col">
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
                                        <div className="card-value mt-1">
                                            <small>Value: ${getDisplayCardValue(card).toFixed(2)}</small>
                                        </div>
                                        <button
                                            type="button"
                                            className="remove-trade-card-btn"
                                            onClick={() => handleRemoveTradeCard(card.tradeEntryId)}
                                        >
                                            Remove Card
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </>
            )}

            {isRequestOverlayOpen && (
                <div className="pexels-overlay" onClick={() => setIsRequestOverlayOpen(false)}>
                    <div className="pexels-overlay-panel" onClick={e => e.stopPropagation()}>
                        <div className="pexels-overlay-header">
                            <h3>Request Trade</h3>
                            <button type="button" className="pexels-overlay-close" onClick={() => setIsRequestOverlayOpen(false)}>Close</button>
                        </div>
                        <div className="pexels-actions">
                            <input
                                ref={requestUserInputRef}
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

                        {!availableDeckCards.length ? (
                            <div className="pexels-overlay-state">No cards found in this deck.</div>
                        ) : (
                            <div className="row deck-row pack-overlay-cards">
                                {availableDeckCards.map((card) => (
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
                                                displayname={card.displayname}
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