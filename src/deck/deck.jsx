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
                                <span className="card-type">Legendary God</span>
                                <span className="card-description">Spell - each turn, this card assumes the strength and endurance of any other card in play</span>
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
                                <span className="card-type">Legendary Chieftan</span>
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
                                <span className="card-type">Legendary God</span>
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
                                <span className="card-type">Legendary God</span>
                                <span className="card-description">Passive - the strength of all enemy cards is reduced by 1 while this card is in play</span>
                            </div>
                            <div className="card-stats">5/3</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Ratatoskr.png" alt="Ratatoskr, Messenger of the World Tree"/>
                            </div>
                            <div className="card-cost">4</div>
                            <div className="card-content">
                                <h1 className="card-name">Ratatoskr, The Messenger</h1>
                                <span className="card-type">Loric Beast</span>
                                <span className="card-description">Passive - the endurance of all enemy cards is reduced by 1 while this card is in play</span>
                            </div>
                            <div className="card-stats">4/3</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Ragnar.png" alt="Ragnar Lothbrok"/>
                            </div>
                            <div className="card-cost">3</div>
                            <div className="card-content">
                                <h1 className="card-name">Ragnar Lothbrok</h1>
                                <span className="card-type">Rare Chieftan</span>
                                <span className="card-description">Passive - the endurance of all allied cards is increased by 1 while this card is in play</span>
                            </div>
                            <div className="card-stats">3/4</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Níðhǫggr.png" alt="Níðhǫggr, Curse Striker"/>
                            </div>
                            <div className="card-cost">5</div>
                            <div className="card-content">
                                <h1 className="card-name">Níðhǫggr, Curse Striker</h1>
                                <span className="card-type">Mythical Beast</span>
                                <span className="card-description">Spell - each turn, one slain allied card can return to your hand</span>
                            </div>
                            <div className="card-stats">6/4</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Shield Maiden.png" alt="Shield Maiden"/>
                            </div>
                            <div className="card-cost">1</div>
                            <div className="card-content">
                                <h1 className="card-name">Shield Maiden</h1>
                                <span className="card-type">Uncommon Warrior</span>
                                <span className="card-description">Berserk - gains +1 strength while attacking</span>
                            </div>
                            <div className="card-stats">1/2</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Bear Shaman.png" alt="Bear Shaman"/>
                            </div>
                            <div className="card-cost">3</div>
                            <div className="card-content">
                                <h1 className="card-name">Bear Shaman</h1>
                                <span className="card-type">Uncommon Warrior</span>
                                <span className="card-description">Berserk - gains +2 strength while attacking</span>
                            </div>
                            <div className="card-stats">4/2</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Dokkalfr.png" alt="Dökkálfr"/>
                            </div>
                            <div className="card-cost">2</div>
                            <div className="card-content">
                                <h1 className="card-name">Dökkálfr</h1>
                                <span className="card-type">Uncommon Warrior</span>
                                <span className="card-description">Spell - cannot be blocked during its first turn attacking</span>
                            </div>
                            <div className="card-stats">3/1</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Ljosalfr.png" alt="Ljosalfr"/>
                            </div>
                            <div className="card-cost">2</div>
                            <div className="card-content">
                                <h1 className="card-name">Ljósálfr</h1>
                                <span className="card-type">Uncommon Warrior</span>
                                <span className="card-description">Spell - can raise its endurance to 5 once per game; resets on death</span>
                            </div>
                            <div className="card-stats">2/2</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Dvergr.png" alt="Dvergr"/>
                            </div>
                            <div className="card-cost">2</div>
                            <div className="card-content">
                                <h1 className="card-name">Dvergr</h1>
                                <span className="card-type">Uncommon Warrior</span>
                                <span className="card-description">Forge - permanently increases the strength of any one allied card by 1 when played</span>
                            </div>
                            <div className="card-stats">3/1</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Valkyrie2.png" alt="Valkyrie"/>
                            </div>
                            <div className="card-cost">3</div>
                            <div className="card-content">
                                <h1 className="card-name">Valkyrie</h1>
                                <span className="card-type">Rare Warrior</span>
                                <span className="card-description">Flight - requires +2 strength to be blocked by a card without flight</span>
                            </div>
                            <div className="card-stats">4/2</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Erik the Red.png" alt="Erik the Red"/>
                            </div>
                            <div className="card-cost">3</div>
                            <div className="card-content">
                                <h1 className="card-name">Erik the Red</h1>
                                <span className="card-type">Loric Chieftan</span>
                                <span className="card-description">Command - can temporarily increase the strength of any two allied cards by 1 each turn</span>
                            </div>
                            <div className="card-stats">2/2</div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="fj-card">
                            <div className="card-image">
                                <img src="Card Images/Leif Erikson.png" alt="Leif Erikson"/>
                            </div>
                            <div className="card-cost">3</div>
                            <div className="card-content">
                                <h1 className="card-name">Leif Erikson</h1>
                                <span className="card-type">Rare Chieftan</span>
                                <span className="card-description">Command - can temporarily increase the endurance of any two allied cards by 1 each turn</span>
                            </div>
                            <div className="card-stats">3/3</div>
                        </div>
                    </div>
                </div>
            </div>


        </main>
  );
}