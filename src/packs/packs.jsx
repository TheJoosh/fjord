import React from 'react';
import { NavLink } from 'react-router-dom';
import '../app.css';
import { getUser, users } from '../data/users';
import { drawWeightedCards, getCardByName, recalcCardValues } from '../data/cards';
import { Card } from '../deck/card';

export function Packs({ userName }) {
    const user = getUser(userName);
    const packs = user?.packs || {};
    const ownedCardsStorageKey = userName ? `ownedCards:${userName}` : null;

    const getPacksFromStorage = (activeUserName, fallbackPacks) => {
        if (!activeUserName) return { ...(fallbackPacks || {}) };

        try {
            const rawPacksMap = localStorage.getItem('usersPacks');
            const packsMap = rawPacksMap ? JSON.parse(rawPacksMap) : {};
            const storedPacks = packsMap?.[activeUserName];
            if (storedPacks && typeof storedPacks === 'object') {
                return {
                    'Default Pack': parseInt(storedPacks['Default Pack'], 10) || 0,
                    'Saga Pack': parseInt(storedPacks['Saga Pack'], 10) || 0,
                    'Heroic Pack': parseInt(storedPacks['Heroic Pack'], 10) || 0,
                    'Mythbound Pack': parseInt(storedPacks['Mythbound Pack'], 10) || 0,
                };
            }
        } catch {
            // Ignore malformed localStorage and fallback to in-memory packs.
        }

        return {
            'Default Pack': parseInt(fallbackPacks?.['Default Pack'], 10) || 0,
            'Saga Pack': parseInt(fallbackPacks?.['Saga Pack'], 10) || 0,
            'Heroic Pack': parseInt(fallbackPacks?.['Heroic Pack'], 10) || 0,
            'Mythbound Pack': parseInt(fallbackPacks?.['Mythbound Pack'], 10) || 0,
        };
    };

    const persistPacksToStorage = (activeUserName, nextPacks) => {
        if (!activeUserName) return;

        let packsMap = {};
        try {
            const rawPacksMap = localStorage.getItem('usersPacks');
            packsMap = rawPacksMap ? JSON.parse(rawPacksMap) : {};
        } catch {
            packsMap = {};
        }

        packsMap[activeUserName] = { ...nextPacks };
        localStorage.setItem('usersPacks', JSON.stringify(packsMap));
    };

    const startingPacks = getPacksFromStorage(userName, packs);

    const [defaultPackCount, setDefaultPackCount] = React.useState(startingPacks['Default Pack'] ?? 0);
    const [sagaPackCount, setSagaPackCount] = React.useState(startingPacks['Saga Pack'] ?? 0);
    const [heroicPackCount, setHeroicPackCount] = React.useState(startingPacks['Heroic Pack'] ?? 0);
    const [mythboundPackCount, setMythboundPackCount] = React.useState(startingPacks['Mythbound Pack'] ?? 0);
    const [openedCards, setOpenedCards] = React.useState([]);
    const [isPackOverlayOpen, setIsPackOverlayOpen] = React.useState(false);

    const openedCardsTotalValue = openedCards.reduce((sum, card) => {
        const value = card && typeof card.value === 'number' ? card.value : 0;
        return sum + value;
    }, 0);

    React.useEffect(() => {
        const latestPacks = getPacksFromStorage(userName, packs);
        setDefaultPackCount(latestPacks['Default Pack'] ?? 0);
        setSagaPackCount(latestPacks['Saga Pack'] ?? 0);
        setHeroicPackCount(latestPacks['Heroic Pack'] ?? 0);
        setMythboundPackCount(latestPacks['Mythbound Pack'] ?? 0);
    }, [userName]);

    const showOpenedCards = (cards) => {
        setOpenedCards(cards || []);
        setIsPackOverlayOpen(true);
    };

    const applyGeneratedCardsToValueCalculation = (generatedCards) => {
        const simulatedUsers = {};

        for (const [name, data] of Object.entries(users || {})) {
            simulatedUsers[name] = {
                ...data,
                cards: { ...(data.cards || {}) },
                packs: { ...(data.packs || {}) },
            };
        }

        if (userName && simulatedUsers[userName]) {
            for (const card of generatedCards) {
                if (!card?.name) continue;
                simulatedUsers[userName].cards[card.name] =
                    (parseInt(simulatedUsers[userName].cards[card.name], 10) || 0) + 1;
            }
        }

        recalcCardValues(simulatedUsers);

        return generatedCards.map((card) => {
            if (!card?.name) return card;
            const updatedCard = getCardByName(card.name);
            return updatedCard ? { ...card, value: updatedCard.value } : card;
        });
    };

    const claimOpenedCards = () => {
        if (!openedCards.length) {
            setIsPackOverlayOpen(false);
            return;
        }

        if (user) {
            user.cards = user.cards || {};
            for (const card of openedCards) {
                if (!card?.name) continue;
                user.cards[card.name] = (parseInt(user.cards[card.name], 10) || 0) + 1;
            }
        }

        if (ownedCardsStorageKey) {
            let existingOwned = [];
            try {
                const raw = localStorage.getItem(ownedCardsStorageKey);
                existingOwned = raw ? JSON.parse(raw) : [];
            } catch {
                existingOwned = [];
            }

            const byName = new Map();
            for (const entry of existingOwned) {
                if (!entry?.name) continue;
                byName.set(entry.name, {
                    name: entry.name,
                    qty: Math.max(0, parseInt(entry.qty, 10) || 0),
                    card: entry.card || null,
                });
            }

            for (const card of openedCards) {
                if (!card?.name) continue;
                const prev = byName.get(card.name);
                if (prev) {
                    prev.qty += 1;
                    prev.card = card;
                } else {
                    byName.set(card.name, { name: card.name, qty: 1, card });
                }
            }

            const nextOwned = Array.from(byName.values()).filter(entry => entry.qty > 0);
            localStorage.setItem(ownedCardsStorageKey, JSON.stringify(nextOwned));
        }

        setOpenedCards([]);
        setIsPackOverlayOpen(false);
    };

    React.useEffect(() => {
        if (!isPackOverlayOpen) return;

        const onKeyDown = (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            claimOpenedCards();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isPackOverlayOpen, claimOpenedCards]);

    const openNormalPack = () => {
        if (defaultPackCount <= 0) return;
        const cards = drawWeightedCards(10, 47, 28, 14, 7, 3, 1);
        showOpenedCards(applyGeneratedCardsToValueCalculation(cards));
        const nextCount = defaultPackCount - 1;
        setDefaultPackCount(nextCount);
        const nextPacks = {
            'Default Pack': nextCount,
            'Saga Pack': sagaPackCount,
            'Heroic Pack': heroicPackCount,
            'Mythbound Pack': mythboundPackCount,
        };
        if (user?.packs) Object.assign(user.packs, nextPacks);
        persistPacksToStorage(userName, nextPacks);
    };

    const openSagaPack = () => {
        if (sagaPackCount <= 0) return;
        const cards = drawWeightedCards(10, 32, 30, 23, 7, 7, 1);
        showOpenedCards(applyGeneratedCardsToValueCalculation(cards));
        const nextCount = sagaPackCount - 1;
        setSagaPackCount(nextCount);
        const nextPacks = {
            'Default Pack': defaultPackCount,
            'Saga Pack': nextCount,
            'Heroic Pack': heroicPackCount,
            'Mythbound Pack': mythboundPackCount,
        };
        if (user?.packs) Object.assign(user.packs, nextPacks);
        persistPacksToStorage(userName, nextPacks);
    };

    const openHeroicPack = () => {
        if (heroicPackCount <= 0) return;
        const cards = drawWeightedCards(10, 0, 35, 30, 18, 12, 5);
        showOpenedCards(applyGeneratedCardsToValueCalculation(cards));
        const nextCount = heroicPackCount - 1;
        setHeroicPackCount(nextCount);
        const nextPacks = {
            'Default Pack': defaultPackCount,
            'Saga Pack': sagaPackCount,
            'Heroic Pack': nextCount,
            'Mythbound Pack': mythboundPackCount,
        };
        if (user?.packs) Object.assign(user.packs, nextPacks);
        persistPacksToStorage(userName, nextPacks);
    };

    const openMythboundPack = () => {
        if (mythboundPackCount <= 0) return;
        const cards = drawWeightedCards(10, 0, 0, 40, 30, 20, 10);
        showOpenedCards(applyGeneratedCardsToValueCalculation(cards));
        const nextCount = mythboundPackCount - 1;
        setMythboundPackCount(nextCount);
        const nextPacks = {
            'Default Pack': defaultPackCount,
            'Saga Pack': sagaPackCount,
            'Heroic Pack': heroicPackCount,
            'Mythbound Pack': nextCount,
        };
        if (user?.packs) Object.assign(user.packs, nextPacks);
        persistPacksToStorage(userName, nextPacks);
    };

  return (
    <main>
        <div className="container-fluid">
            <div className="row" width="100%" justify-content="center">
                <h2>Open Packs!</h2>
                <div className="col">
                    <div className="cardpack default">
                        <h3>Normal Pack</h3>
                        <h4>$3.50</h4>
                        <h4>10 cards</h4>
                        <button className="open" onClick={openNormalPack} disabled={defaultPackCount <= 0}>Unopened Packs: {defaultPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack saga">
                        <h3>Saga Pack</h3>
                        <h4>$4.50</h4>
                        <h4>2x Mythical and Legendary cards</h4>
                        <button className="open" onClick={openSagaPack} disabled={sagaPackCount <= 0}>Unopened Packs: {sagaPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack heroic">
                        <h3>Heroic Pack</h3>
                        <h4>$7.50</h4>
                        <h4>No Common cards</h4>
                        <button className="open" onClick={openHeroicPack} disabled={heroicPackCount <= 0}>Unopened Packs: {heroicPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack mythbound">
                        <h3>Mythbound Pack</h3>
                        <h4>$11.25</h4>
                        <h4>No Common or Uncommon cards</h4>
                        <button className="open" onClick={openMythboundPack} disabled={mythboundPackCount <= 0}>Unopened Packs: {mythboundPackCount}</button>
                    </div>
                </div>
                    <NavLink className="design packs-more-btn" to="/designer">Get more Packs!</NavLink>
            </div>
        </div>

        {isPackOverlayOpen && (
            <div className="pexels-overlay" onClick={claimOpenedCards}>
                <div className="pexels-overlay-panel pack-overlay-panel" onClick={e => e.stopPropagation()}>
                    <div className="pexels-overlay-header">
                        <h3>Pack Value: ${openedCardsTotalValue.toFixed(2)}</h3>
                        <button type="button" className="pexels-overlay-close" onClick={claimOpenedCards}>Claim Cards</button>
                    </div>

                    <div className="row deck-row pack-overlay-cards">
                        {openedCards.map((card, index) => (
                            <div key={`${card.name}-${index}`} className="col deck-col pack-overlay-col">
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
            </div>
        )}
    </main>
  );
}