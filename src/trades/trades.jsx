import React from 'react';
import { Card } from '../deck/card';
import { getCardByName, recalcCardValues } from '../data/cards';
import { getUser, users } from '../data/users';

export function Trades({ userName }) {
        const currentUserLabel = userName || 'User';
        const [isDeckOverlayOpen, setIsDeckOverlayOpen] = React.useState(false);

        recalcCardValues(users);
        const activeUser = getUser(userName);

        const ownedDeckCards = activeUser
            ? Object.keys(activeUser.cards || {})
                    .map((name) => {
                        const qty = Math.max(0, parseInt(activeUser.cards[name], 10) || 0);
                        const card = getCardByName(name);
                        if (!card || qty <= 0) return null;
                        return { ...card, qty };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.name.localeCompare(b.name))
            : [];

  return (
        <main className="trades-page">

        <button className="request">Request trade</button>
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

        <button className="cancel">
            <h2>Cancel Trade</h2>
        </button>
            <h2 className="user_name">{currentUserLabel}</h2>
            <section className="yoUser">
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
                        <button className="remove">Remove Card</button>
                    </div>
                </div>
            </div>
                

            <h3 className="value">Trade Value: $0.00</h3>
        </section>

            <button className="picker" onClick={() => setIsDeckOverlayOpen(true)}>Pick from your deck</button>

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