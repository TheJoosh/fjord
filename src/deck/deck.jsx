import React from 'react';
import { Card } from './card';

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
                        <Card image="loki.png" name="Loki, God of Mischief" cost={5} type="Legendary God" description="Spell - each turn, this card assumes the strength and endurance of any other card in play" strength="-" endurance="-" />
                    </div>
                    <div className="col">
                        <Card image="frost-giant.png" name="Thrym, Frost Giant King" cost={5} type="Legendary Chieftan" description="Berserk - gains +2 strength while attacking" strength={3} endurance={5} />
                    </div>
                    <div className="col">
                        <Card image="grunt.png" name="Drengr" cost={1} type="Common Warrior" description="Swift - this card can attack on the same turn it enters play" strength={2} endurance={1} />
                    </div>
                    <div className="col">
                        <Card image="mythologyart-odin-10069805_1280.png" name="Odin, King of the Gods" cost={5} type="Legendary God" description="Passive - +2 maximum fate while this card is in play" strength={4} endurance={5} />
                    </div>
                    <div className="col">
                        <Card image="thor.png" name="Thor, God of Thunder" cost={5} type="Legendary God" description="Passive - the strength of all enemy cards is reduced by 1 while this card is in play" strength={5} endurance={3} />
                    </div>
                    <div className="col">
                        <Card image="Ratatoskr.png" name="Ratatoskr, The Messenger" cost={4} type="Loric Beast" description="Passive - the endurance of all enemy cards is reduced by 1 while this card is in play" strength={4} endurance={3} />
                    </div>
                    <div className="col">
                        <Card image="Ragnar.png" name="Ragnar Lothbrok" cost={3} type="Rare Chieftan" description="Passive - the endurance of all allied cards is increased by 1 while this card is in play" strength={3} endurance={4} />
                    </div>
                    <div className="col">
                        <Card image="Níðhǫggr.png" name="Níðhǫggr, Curse Striker" cost={5} type="Mythical Beast" description="Spell - each turn, one slain allied card can return to your hand" strength={6} endurance={4} />
                    </div>
                    <div className="col">
                        <Card image="Shield Maiden.png" name="Shield Maiden" cost={1} type="Uncommon Warrior" description="Berserk - gains +1 strength while attacking" strength={1} endurance={2} />
                    </div>
                    <div className="col">
                        <Card image="Bear Shaman.png" name="Bear Shaman" cost={3} type="Uncommon Warrior" description="Berserk - gains +2 strength while attacking" strength={4} endurance={2} />
                    </div>
                    <div className="col">
                        <Card image="Dokkalfr.png" name="Dökkálfr" cost={2} type="Uncommon Warrior" description="Spell - cannot be blocked during its first turn attacking" strength={3} endurance={1} />
                    </div>
                    <div className="col">
                        <Card image="Ljosalfr.png" name="Ljósálfr" cost={2} type="Uncommon Warrior" description="Spell - can raise its endurance to 5 once per game; resets on death" strength={2} endurance={2} />
                    </div>
                    <div className="col">
                        <Card image="Dvergr.png" name="Dvergr" cost={2} type="Uncommon Warrior" description="Forge - permanently increases the strength of any one allied card by 1 when played" strength={3} endurance={1} />
                    </div>
                    <div className="col">
                        <Card image="Valkyrie2.png" name="Valkyrie" cost={3} type="Rare Warrior" description="Flight - requires +2 strength to be blocked by a card without flight" strength={4} endurance={2} />
                    </div>
                    <div className="col">
                        <Card image="Erik the Red.png" name="Erik the Red" cost={3} type="Loric Chieftan" description="Command - can temporarily increase the strength of any two allied cards by 1 each turn" strength={2} endurance={2} />
                    </div>
                    <div className="col">
                        <Card image="Leif Erikson.png" name="Leif Erikson" cost={3} type="Rare Chieftan" description="Command - can temporarily increase the endurance of any two allied cards by 1 each turn" strength={3} endurance={3} />
                    </div>
                </div>
            </div>


        </main>
  );
}