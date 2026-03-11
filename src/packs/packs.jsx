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
import { gameApiClient } from '../../services/gameApiClient';
import { Card } from '../data/card';

export function Packs({ userName }) {
    const user = getUser(userName);
    if (user && (!user.cards || typeof user.cards !== 'object')) {
        user.cards = {};
    }
    const normalPackPrice = 3.5;
    const sagaPackPrice = 4.5;
    const heroicPackPrice = 8;
    const mythboundPackPrice = 11.5;
    const packs = user?.packs || {};

    const [defaultPackCount, setDefaultPackCount] = React.useState(packs['Default Pack'] ?? 0);
    const [sagaPackCount, setSagaPackCount] = React.useState(packs['Saga Pack'] ?? 0);
    const [heroicPackCount, setHeroicPackCount] = React.useState(packs['Heroic Pack'] ?? 0);
    const [mythboundPackCount, setMythboundPackCount] = React.useState(packs['Mythbound Pack'] ?? 0);
    const [walletBalance, setWalletBalance] = React.useState(user?.wallet ?? 0);
    const [openedCards, setOpenedCards] = React.useState([]);
    const [isPackOverlayOpen, setIsPackOverlayOpen] = React.useState(false);
    const walletValue = normalizeWalletValue(walletBalance);

    const openedCardsTotalValue = openedCards.reduce((sum, card) => {
        const value = card && typeof card.value === 'number' ? card.value : 0;
        return sum + value;
    }, 0);

    const currentPacksState = React.useMemo(() => ({
        'Default Pack': defaultPackCount,
        'Saga Pack': sagaPackCount,
        'Heroic Pack': heroicPackCount,
        'Mythbound Pack': mythboundPackCount,
    }), [defaultPackCount, sagaPackCount, heroicPackCount, mythboundPackCount]);

    const applyPackState = React.useCallback((nextPacks, nextWallet) => {
        const normalizedPacks = {
            'Default Pack': parseInt(nextPacks?.['Default Pack'], 10) || 0,
            'Saga Pack': parseInt(nextPacks?.['Saga Pack'], 10) || 0,
            'Heroic Pack': parseInt(nextPacks?.['Heroic Pack'], 10) || 0,
            'Mythbound Pack': parseInt(nextPacks?.['Mythbound Pack'], 10) || 0,
        };

        setDefaultPackCount(normalizedPacks['Default Pack']);
        setSagaPackCount(normalizedPacks['Saga Pack']);
        setHeroicPackCount(normalizedPacks['Heroic Pack']);
        setMythboundPackCount(normalizedPacks['Mythbound Pack']);

        const normalizedWallet = normalizeWalletValue(nextWallet);
        setWalletBalance(normalizedWallet);

        if (user) {
            user.packs = normalizedPacks;
            user.wallet = normalizedWallet;
        }

        if (userName && users?.[userName]) {
            users[userName].packs = normalizedPacks;
            users[userName].wallet = normalizedWallet;
        }
    }, [user, userName]);

    React.useEffect(() => {
        (async () => {
            const response = await gameApiClient.loadPackState(userName, packs, user?.wallet || 0);
            applyPackState(response.packs, response.wallet);
        })();
    }, [applyPackState, packs, user, userName]);

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

        await gameApiClient.claimOpenedPackCards(userName, openedCards, user?.cards || {});

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

    const openPack = async (packName, cardGenerator) => {
        if (!userName) return;

        const response = await gameApiClient.openPack(userName, packName, currentPacksState);
        if (!response.ok) return;

        applyPackState(response.packs, walletValue);

        const cards = cardGenerator();
        showOpenedCards(applyGeneratedCardsToValueCalculation(cards));
    };

    const openNormalPack = async () => {
        if (defaultPackCount <= 0) return;
        await openPack('Default Pack', () => drawWeightedCards(10, 47, 28, 14, 7, 3, 1));
    };

    const openSagaPack = async () => {
        if (sagaPackCount <= 0) return;
        await openPack('Saga Pack', () => drawWeightedCards(10, 32, 30, 23, 7, 7, 1));
    };

    const openHeroicPack = async () => {
        if (heroicPackCount <= 0) return;
        await openPack('Heroic Pack', () => drawWeightedCards(10, 0, 35, 30, 18, 12, 5));
    };

    const openMythboundPack = async () => {
        if (mythboundPackCount <= 0) return;
        await openPack('Mythbound Pack', () => drawWeightedCards(10, 0, 0, 40, 30, 20, 10));
    };

    const buyPack = async (packName, packPrice) => {
        if (!userName || !user || !packName) return;

        const currentWallet = normalizeWalletValue(user.wallet);
        if (currentWallet < packPrice) return;

        const response = await gameApiClient.buyPack(
            userName,
            packName,
            packPrice,
            currentPacksState,
            currentWallet
        );
        if (!response.ok) return;

        applyPackState(response.packs, response.wallet);
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