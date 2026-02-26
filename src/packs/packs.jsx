import React from 'react';
import { NavLink } from 'react-router-dom';
import '../app.css';
import { getUser } from '../data/users';
import { drawWeightedCards } from '../data/cards';

export function Packs({ userName }) {
    const user = getUser(userName);
    const packs = user?.packs || {};

    const [defaultPackCount, setDefaultPackCount] = React.useState(packs['Default Pack'] ?? 0);
    const [sagaPackCount, setSagaPackCount] = React.useState(packs['Saga Pack'] ?? 0);
    const [heroicPackCount, setHeroicPackCount] = React.useState(packs['Heroic Pack'] ?? 0);
    const [mythboundPackCount, setMythboundPackCount] = React.useState(packs['Mythbound Pack'] ?? 0);

    const openNormalPack = () => {
        if (defaultPackCount <= 0) return;
        drawWeightedCards(10, 47, 28, 14, 7, 3, 1);
        const nextCount = defaultPackCount - 1;
        setDefaultPackCount(nextCount);
        if (user?.packs) user.packs['Default Pack'] = nextCount;
    };

    const openSagaPack = () => {
        if (sagaPackCount <= 0) return;
        drawWeightedCards(10, 30, 29, 22, 11, 6, 2);
        const nextCount = sagaPackCount - 1;
        setSagaPackCount(nextCount);
        if (user?.packs) user.packs['Saga Pack'] = nextCount;
    };

    const openHeroicPack = () => {
        if (heroicPackCount <= 0) return;
        drawWeightedCards(8, 0, 35, 30, 18, 12, 5);
        const nextCount = heroicPackCount - 1;
        setHeroicPackCount(nextCount);
        if (user?.packs) user.packs['Heroic Pack'] = nextCount;
    };

    const openMythboundPack = () => {
        if (mythboundPackCount <= 0) return;
        drawWeightedCards(5, 0, 0, 40, 30, 20, 10);
        const nextCount = mythboundPackCount - 1;
        setMythboundPackCount(nextCount);
        if (user?.packs) user.packs['Mythbound Pack'] = nextCount;
    };

  return (
    <main>
        <div className="container-fluid">
            <div className="row" width="100%" justify-content="center">
                <h2>Open Packs!</h2>
                <div className="col">
                    <div className="cardpack default">
                        <h3>Normal Pack</h3>
                        <h4>$2.00</h4>
                        <h4>10 cards</h4>
                        <button className="open" onClick={openNormalPack} disabled={defaultPackCount <= 0}>Unopened Packs: {defaultPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack saga">
                        <h3>Saga Pack</h3>
                        <h4>$3.50</h4>
                        <h4>10 cards - 2x Mythical and Legendary cards</h4>
                        <button className="open" onClick={openSagaPack} disabled={sagaPackCount <= 0}>Unopened Packs: {sagaPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack heroic">
                        <h3>Heroic Pack</h3>
                        <h4>$6.00</h4>
                        <h4>8 cards - No Common cards</h4>
                        <button className="open" onClick={openHeroicPack} disabled={heroicPackCount <= 0}>Unopened Packs: {heroicPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack mythbound">
                        <h3>Mythbound Pack</h3>
                        <h4>$10.00</h4>
                        <h4>5 cards - No Common or Uncommon cards</h4>
                        <button className="open" onClick={openMythboundPack} disabled={mythboundPackCount <= 0}>Unopened Packs: {mythboundPackCount}</button>
                    </div>
                </div>
                    <NavLink className="design packs-more-btn" to="/designer">Get more Packs!</NavLink>
            </div>
        </div>
    </main>
  );
}