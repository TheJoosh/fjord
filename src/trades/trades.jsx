import React from 'react';

export function Trades() {
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
            <h2 className="user_name">User</h2>
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

            <button className="picker">Pick from your deck</button>
        

    </main>
  );
}