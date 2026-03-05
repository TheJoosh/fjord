import React from 'react';
import { Card } from '../data/card';
import { getUser } from '../data/users';
import { tradeService } from '../services/tradeService';

export function Trades({ userName }) {
        const currentUserLabel = userName || 'User';
    const requestUserInputRef = React.useRef(null);
    const [isRequestOverlayOpen, setIsRequestOverlayOpen] = React.useState(false);
    const [requestUserInput, setRequestUserInput] = React.useState('');
    const [requestUserError, setRequestUserError] = React.useState('');
    const [tradeSuccessMessage, setTradeSuccessMessage] = React.useState('');
    const [otherUserLabel, setOtherUserLabel] = React.useState('Other User');
    const [otherUserName, setOtherUserName] = React.useState('');
    const [otherTradeCards, setOtherTradeCards] = React.useState([]);
        const [isDeckOverlayOpen, setIsDeckOverlayOpen] = React.useState(false);
        const [ownedDeckCards, setOwnedDeckCards] = React.useState([]);
        const [selectedTradeCards, setSelectedTradeCards] = React.useState([]);
        const hasValidTradePartner = Boolean(otherUserName);

        const activeUser = getUser(userName);

        const getCurrentCardValue = React.useCallback((cardLike) => {
            return tradeService.getCurrentCardValue(cardLike);
        }, []);

        const buildOwnedDeckCards = React.useCallback(async () => {
            return await tradeService.buildOwnedDeckCards(userName, activeUser?.cards || {});
        }, [activeUser, userName]);

        React.useEffect(() => {
            if (!isDeckOverlayOpen) return;
            (async () => {
                setOwnedDeckCards(await buildOwnedDeckCards());
            })();
        }, [isDeckOverlayOpen, buildOwnedDeckCards]);

        React.useEffect(() => {
            (async () => {
                const initialPendingTrade = await tradeService.loadPendingTrade(userName);
                setOtherUserLabel(initialPendingTrade.otherUserLabel);
                setOtherUserName(initialPendingTrade.otherUserName);
                setOtherTradeCards(initialPendingTrade.otherTradeCards);
            })();
        }, [userName]);

        React.useEffect(() => {
            (async () => {
                const parsed = await tradeService.loadSelectedTradeCards(userName);
                setSelectedTradeCards(parsed);
            })();
        }, [userName]);

        React.useEffect(() => {
            (async () => {
                await tradeService.saveSelectedTradeCards(userName, selectedTradeCards);
            })();
        }, [userName, selectedTradeCards]);

        React.useEffect(() => {
            (async () => {
                await tradeService.savePendingTrade(userName, {
                    otherUserName,
                    otherUserLabel,
                    otherTradeCards,
                });
            })();
        }, [userName, otherUserName, otherUserLabel, otherTradeCards]);

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

        const handleRequestTradeUser = async () => {
            const response = await tradeService.requestTradeUser(userName, requestUserInput);
            if (response.error) {
                setRequestUserError(response.error);
                return;
            }

            setRequestUserError('');
            setTradeSuccessMessage('');
            setOtherUserLabel(response.otherUserLabel);
            setOtherUserName(response.otherUserName);
            setOtherTradeCards(response.otherTradeCards);
            setIsRequestOverlayOpen(false);
        };

        const handleDeckCardClick = async (clickedCard) => {
            const cardName = clickedCard?.name;
            if (!userName || !cardName) return;

            await tradeService.transferCardFromOwnedToTrade(userName, cardName, activeUser?.cards);
            setOwnedDeckCards(await buildOwnedDeckCards());

            setSelectedTradeCards((prev) => ([
                ...prev,
                {
                    ...clickedCard,
                    tradeEntryId: `${clickedCard.name}-${Date.now()}-${Math.random()}`,
                },
            ]));
        };

        const handleRemoveTradeCard = async (tradeEntryId) => {
            const tradeCard = selectedTradeCards.find((card) => card.tradeEntryId === tradeEntryId);
            if (!tradeCard?.name || !userName) return;

            await tradeService.returnCardFromTradeSelection(userName, tradeCard.name, activeUser?.cards);
            setOwnedDeckCards(await buildOwnedDeckCards());
            setSelectedTradeCards((prev) => prev.filter((card) => card.tradeEntryId !== tradeEntryId));
        };

        const userTradeValue = selectedTradeCards.reduce((sum, card) => {
            return sum + getCurrentCardValue(card);
        }, 0);

        const otherTradeValue = otherTradeCards.reduce((sum, card) => {
            return sum + getCurrentCardValue(card);
        }, 0);

        const handleCancelTrade = async () => {
            await tradeService.cancelTrade(userName, selectedTradeCards, activeUser?.cards);

            setSelectedTradeCards([]);
            setOtherTradeCards([]);
            setOtherUserName('');
            setOtherUserLabel('Other User');
            setTradeSuccessMessage('');
            if (isDeckOverlayOpen) {
                setOwnedDeckCards(await buildOwnedDeckCards());
            }
        };

        const handleAcceptTrade = async () => {
            if (!selectedTradeCards.length && !otherTradeCards.length) return;

            if (!userName || !otherUserName) return;
            await tradeService.acceptTrade(userName, otherUserName, selectedTradeCards, otherTradeCards);

            setSelectedTradeCards([]);
            setOtherTradeCards([]);
            setOtherUserName('');
            setOtherUserLabel('Other User');
            setTradeSuccessMessage('Your trade was successful!');
            if (isDeckOverlayOpen) {
                setOwnedDeckCards(await buildOwnedDeckCards());
            }
        };

  return (
        <main className="trades-page">

        <button className="request" onClick={() => setIsRequestOverlayOpen(true)}>Request trade</button>
        {tradeSuccessMessage && <div className="trade-success-message">{tradeSuccessMessage}</div>}
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
                                cost={card.cost}
                                rarity={card.rarity}
                                cardType={card.cardType}
                                description={card.description}
                                strength={card.strength}
                                endurance={card.endurance}
                            />
                            <div className="card-value mt-1">
                                <small>Value: ${getCurrentCardValue(card).toFixed(2)}</small>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
                

            <h3 className="value">Trade Value: ${otherTradeValue.toFixed(2)}</h3>
        </section>

        <button className="accept" onClick={handleAcceptTrade}>
            <h2>Accept Trade</h2>
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
                                cost={card.cost}
                                rarity={card.rarity}
                                cardType={card.cardType}
                                description={card.description}
                                strength={card.strength}
                                endurance={card.endurance}
                            />
                            <div className="card-value mt-1">
                                <small>Value: ${getCurrentCardValue(card).toFixed(2)}</small>
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