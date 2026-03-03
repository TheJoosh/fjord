import React from 'react';
import { NavLink } from 'react-router-dom';
import '../app.css';
import { getUser, normalizeWalletValue, users } from '../data/users';
import {
    drawWeightedCards,
    getCardByName,
    incrementCardPopulations,
    recalcCardValues,
    syncCardPopulationsFromOwnedCards,
} from '../data/cards';
import { storageService } from '../services/storageService';
import { Card } from '../data/card';

export function Packs({ userName }) {
    const user = getUser(userName);
    const walletValue = normalizeWalletValue(user?.wallet);
    const normalPackPrice = 3.5;
    const sagaPackPrice = 4.5;
    const heroicPackPrice = 8;
    const mythboundPackPrice = 11.5;
    const packs = user?.packs || {};

    const getPacksFromStorage = async (activeUserName, fallbackPacks) => {
        if (!activeUserName) return { ...(fallbackPacks || {}) };
        return await storageService.getUserPacks(activeUserName, fallbackPacks);
    };

    const persistPacksToStorage = async (activeUserName, nextPacks) => {
        if (!activeUserName) return;
        await storageService.setUserPacks(activeUserName, nextPacks);
    };

    const [defaultPackCount, setDefaultPackCount] = React.useState(packs['Default Pack'] ?? 0);
    const [sagaPackCount, setSagaPackCount] = React.useState(packs['Saga Pack'] ?? 0);
    const [heroicPackCount, setHeroicPackCount] = React.useState(packs['Heroic Pack'] ?? 0);
    const [mythboundPackCount, setMythboundPackCount] = React.useState(packs['Mythbound Pack'] ?? 0);
    const [openedCards, setOpenedCards] = React.useState([]);
    const [isPackOverlayOpen, setIsPackOverlayOpen] = React.useState(false);

    const openedCardsTotalValue = openedCards.reduce((sum, card) => {
        const value = card && typeof card.value === 'number' ? card.value : 0;
        return sum + value;
    }, 0);

    React.useEffect(() => {
        (async () => {
            const latestPacks = await getPacksFromStorage(userName, packs);
            setDefaultPackCount(latestPacks['Default Pack'] ?? 0);
            setSagaPackCount(latestPacks['Saga Pack'] ?? 0);
            setHeroicPackCount(latestPacks['Heroic Pack'] ?? 0);
            setMythboundPackCount(latestPacks['Mythbound Pack'] ?? 0);
        })();
    }, [userName]);

    const showOpenedCards = (cards) => {
        setOpenedCards(cards || []);
        setIsPackOverlayOpen(true);
    };

    const applyGeneratedCardsToValueCalculation = (generatedCards) => {
        syncCardPopulationsFromOwnedCards(users);
        incrementCardPopulations(generatedCards);
        recalcCardValues();

        return generatedCards.map((card) => {
            if (!card?.name) return card;
            const updatedCard = getCardByName(card.name);
            return updatedCard ? { ...card, value: updatedCard.value } : card;
        });
    };

    const claimOpenedCards = async () => {
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

        if (userName) {
            const existingOwned = await storageService.getOwnedCards(userName);

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
            await storageService.setOwnedCards(userName, nextOwned);
        }

        setOpenedCards([]);
        setIsPackOverlayOpen(false);
    };

    React.useEffect(() => {
        if (!isPackOverlayOpen) return;

        const onKeyDown = (event) => {
            if (event.key !== 'Enter' && event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            claimOpenedCards();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isPackOverlayOpen, claimOpenedCards]);

    const openNormalPack = async () => {
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
        await persistPacksToStorage(userName, nextPacks);
    };

    const openSagaPack = async () => {
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
        await persistPacksToStorage(userName, nextPacks);
    };

    const openHeroicPack = async () => {
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
        await persistPacksToStorage(userName, nextPacks);
    };

    const openMythboundPack = async () => {
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
        await persistPacksToStorage(userName, nextPacks);
    };

    const persistWalletToStorage = async (activeUserName, nextWalletValue, activeUser) => {
        if (!activeUserName) return;

        if (users[activeUserName] && typeof users[activeUserName] === 'object') {
            users[activeUserName].wallet = nextWalletValue;
        }

        const usersMap = await storageService.getUsersMap();
        const storageUserKey = Object.prototype.hasOwnProperty.call(usersMap, activeUserName)
            ? activeUserName
            : Object.keys(usersMap).find((name) => name.toLowerCase() === activeUserName.toLowerCase());

        if (storageUserKey) {
            const existingStoredUser = usersMap[storageUserKey];
            if (existingStoredUser && typeof existingStoredUser === 'object') {
                usersMap[storageUserKey] = {
                    ...existingStoredUser,
                    wallet: nextWalletValue,
                };
            } else {
                usersMap[storageUserKey] = {
                    wallet: nextWalletValue,
                };
            }
        } else {
            usersMap[activeUserName] = {
                ...(activeUser || {}),
                wallet: nextWalletValue,
            };
        }

        await storageService.setUsersMap(usersMap);
    };

    const buyPack = async (packName, packPrice) => {
        if (!userName || !user || !packName) return;

        const currentWallet = normalizeWalletValue(user.wallet);
        if (currentWallet < packPrice) return;

        const nextWallet = normalizeWalletValue(currentWallet - packPrice);
        user.wallet = nextWallet;
        await persistWalletToStorage(userName, nextWallet, user);

        const nextPacks = {
            'Default Pack': defaultPackCount,
            'Saga Pack': sagaPackCount,
            'Heroic Pack': heroicPackCount,
            'Mythbound Pack': mythboundPackCount,
        };
        nextPacks[packName] = (parseInt(nextPacks[packName], 10) || 0) + 1;

        setDefaultPackCount(nextPacks['Default Pack']);
        setSagaPackCount(nextPacks['Saga Pack']);
        setHeroicPackCount(nextPacks['Heroic Pack']);
        setMythboundPackCount(nextPacks['Mythbound Pack']);

        if (user?.packs) Object.assign(user.packs, nextPacks);
        await persistPacksToStorage(userName, nextPacks);
    };

  return (
    <main>
        <div className="container-fluid">
            <div className="row" width="100%" justify-content="center">
                <h2>Open Packs!</h2>
                <h3>Wallet: ${walletValue.toFixed(2)}</h3>
                <div className="col">
                    <div className="cardpack default">
                        <h3>Normal Pack</h3>
                        <div className="pack-price-row">
                            <h4>${normalPackPrice.toFixed(2)}</h4>
                            <button
                                type="button"
                                className="open pack-buy-btn"
                                disabled={walletValue < normalPackPrice}
                                style={walletValue < normalPackPrice ? { color: 'red' } : undefined}
                                onClick={() => buyPack('Default Pack', normalPackPrice)}
                            >
                                Buy
                            </button>
                        </div>
                        <h4>10 cards</h4>
                        <button className="open" onClick={openNormalPack} disabled={defaultPackCount <= 0}>Unopened Packs: {defaultPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack saga">
                        <h3>Saga Pack</h3>
                        <div className="pack-price-row">
                            <h4>${sagaPackPrice.toFixed(2)}</h4>
                            <button
                                type="button"
                                className="open pack-buy-btn"
                                disabled={walletValue < sagaPackPrice}
                                style={walletValue < sagaPackPrice ? { color: 'red' } : undefined}
                                onClick={() => buyPack('Saga Pack', sagaPackPrice)}
                            >
                                Buy
                            </button>
                        </div>
                        <h4>2x Mythical and Legendary cards</h4>
                        <button className="open" onClick={openSagaPack} disabled={sagaPackCount <= 0}>Unopened Packs: {sagaPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack heroic">
                        <h3>Heroic Pack</h3>
                        <div className="pack-price-row">
                            <h4>${heroicPackPrice.toFixed(2)}</h4>
                            <button
                                type="button"
                                className="open pack-buy-btn"
                                disabled={walletValue < heroicPackPrice}
                                style={walletValue < heroicPackPrice ? { color: 'red' } : undefined}
                                onClick={() => buyPack('Heroic Pack', heroicPackPrice)}
                            >
                                Buy
                            </button>
                        </div>
                        <h4>No Common cards</h4>
                        <button className="open" onClick={openHeroicPack} disabled={heroicPackCount <= 0}>Unopened Packs: {heroicPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack mythbound">
                        <h3>Mythbound Pack</h3>
                        <div className="pack-price-row">
                            <h4>${mythboundPackPrice.toFixed(2)}</h4>
                            <button
                                type="button"
                                className="open pack-buy-btn"
                                disabled={walletValue < mythboundPackPrice}
                                style={walletValue < mythboundPackPrice ? { color: 'red' } : undefined}
                                onClick={() => buyPack('Mythbound Pack', mythboundPackPrice)}
                            >
                                Buy
                            </button>
                        </div>
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