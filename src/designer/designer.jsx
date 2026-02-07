import React from 'react';

export function Designer() {
  return (
    <main>

        <div className="designer">
            <form className ="design-form">
                <div>
                    <span>Image:</span>
                    <input type="file" id="image_uploads" name="image_uploads" accept="image/png, image/jpeg" required/>
                    <button>Upload</button>
                </div>

                <div>
                    <span>Title:</span>
                    <input type="text" placeholder="Card Title" required />
                </div>
                
                <div>
                    <label for="card_class">class:</label>
                    <select id="card_class" name="class" required>
                        <option value="warrior">Warrior</option>
                        <option value="spell">Spell</option>
                        <option value="attachment">Weapon</option>
                        <option value="attachment">Mount</option>
                        <option value="attachment">Companion</option>
                    </select>
                </div>
                
                <div>
                    <span>Description:</span>
                    <textarea placeholder="Description" ></textarea>
                </div>

                
                <div>
                    <span>Cost:</span>
                    <input type="number" min="1" max="5" placeholder="Fate cost" required />
                </div>

                <div>
                    <span>Abilities:</span>
                    <textarea placeholder="Abilities" required></textarea>
                </div>

                <button type="submit">Submit Design</button>
            </form>

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

            
    </main>
  );
}