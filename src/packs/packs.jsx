import React from 'react';
import '../app.css';
import { getUser } from '../data/users';

export function Packs({ userName }) {
    const user = getUser(userName);
    const packs = user?.packs || {};

    const defaultPackCount = packs['Default Pack'] ?? 0;
    const sagaPackCount = packs['Saga Pack'] ?? 0;
    const heroicPackCount = packs['Heroic Pack'] ?? 0;
    const mythboundPackCount = packs['Mythbound Pack'] ?? 0;

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
                        <button className="open">Unopened Packs: {defaultPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack saga">
                        <h3>Saga Pack</h3>
                        <h4>$3.50</h4>
                        <h4>10 cards - 2x Mythical and Legendary cards</h4>
                        <button className="open">Unopened Packs: {sagaPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack heroic">
                        <h3>Heroic Pack</h3>
                        <h4>$6.00</h4>
                        <h4>8 cards - No Common cards</h4>
                        <button className="open">Unopened Packs: {heroicPackCount}</button>
                    </div>
                </div>

                <div className="col">
                    <div className="cardpack mythbound">
                        <h3>Mythbound Pack</h3>
                        <h4>$10.00</h4>
                        <h4>5 cards - No Common or Uncommon cards</h4>
                        <button className="open">Unopened Packs: {mythboundPackCount}</button>
                    </div>
                </div>
                <button className="design" href="designer.html">Get more Packs!</button>
            </div>
        </div>
    </main>
  );
}