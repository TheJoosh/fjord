import React from 'react';

export function Deck({ userName }) {
  const title = userName ? `${userName}'s Deck` : "User's Deck";
  return (
    <main>
            <div className="user">
                <h2>{title}</h2>
            </div>

            <div className="container-fluid">
                <div className="row">
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/loki.png" alt="Loki, the god of mischief"/>
                            </div>
                            <div className="card-cost">5</div>
                            <div className="card-content">
                                <h1 className="card-name">Loki, God of Mischief</h1>
                                <span className="card-type">Legendary Warrior</span>
                                <span className="card-description">Spell - each turn, this card assumes the strength and endurance of any other warrior in play</span>
                            </div>
                            <div className="card-stats">-/-</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/frost-giant.png" alt="Thrym, Frost Giant King"/>
                            </div>
                            <div className="card-cost">5</div>
                            <div className="card-content">
                                <h1 className="card-name">Thrym, Frost Giant King</h1>
                                <span className="card-type">Legendary Warrior</span>
                                <span className="card-description">Berserk - gains +2 strength while attacking</span>
                            </div>
                            <div className="card-stats">3/5</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/grunt.png" alt="Viking warrior"/>
                            </div>
                            <div className="card-cost">1</div>
                            <div className="card-content">
                                <h1 className="card-name">Drengr</h1>
                                <span className="card-type">Common Warrior</span>
                                <span className="card-description">Swift - this card can attack on the same turn it enters play</span>
                            </div>
                            <div className="card-stats">2/1</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/mythologyart-odin-10069805_1280.png" alt="Odin, King of the Gods"/>
                            </div>
                            <div className="card-cost">5</div>
                            <div className="card-content">
                                <h1 className="card-name">Odin, King of the Gods</h1>
                                <span className="card-type">Legendary Warrior</span>
                                <span className="card-description">Passive - +2 maximum fate while this card is in play</span>
                            </div>
                            <div className="card-stats">4/5</div>
                        </div>
                    </div>
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


        </main>
  );
}