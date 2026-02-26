import React, { useState } from 'react';
import { Card } from '../deck/card';

export function Designer() { 
    const [previewImage, setPreviewImage] = useState(null);
    const [title, setTitle] = useState('');
    const [cardType, setCardType] = useState('');
    const [cost, setCost] = useState('');
    const [balance, setBalance] = useState('');
    const [abilities, setAbilities] = useState('');

    function handleFileChange(e) {
        const input = e.target;
        if (!input || !input.files || input.files.length === 0) return;
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            setPreviewImage(reader.result);
        };
        reader.readAsDataURL(file);
    }

    function handleCostChange(e) {
        const value = e.target.value;
        if (value === '') {
            setCost('');
            return;
        }
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 1 && num <= 5) {
            setCost(num.toString());
        }
    }

    function calculateStats() {
        if (!cost || !balance) return { strength: '-', endurance: '-' };
        const costNum = parseInt(cost, 10);
        
        if (balance === 'Standard') {
            return { strength: costNum, endurance: costNum };
        } else if (balance === 'Aggressive') {
            return { strength: costNum + 1, endurance: Math.max(1, costNum - 1) };
        } else if (balance === 'Defensive') {
            return { strength: Math.max(1, costNum - 1), endurance: costNum + 1 };
        }
        return { strength: '-', endurance: '-' };
    }

    const stats = calculateStats();

    return (
        <main>

            <div className="designer">
                <form className ="design-form">
                    <div>
                        <span>Image:</span>
                        <input onChange={handleFileChange} type="file" id="image_uploads" name="image_uploads" accept="image/png, image/jpeg" />
                    </div>

                    <div>
                        <span>Title:</span>
                        <input value={title} onChange={e => setTitle(e.target.value)} type="text" placeholder="Card Title" required />
                    </div>

                    <div>
                        <label htmlFor="card_class">class:</label>
                        <select id="card_class" name="class" required onChange={e => setCardType(e.target.options[e.target.selectedIndex].text)}>
                            <option value="">-- Select Class --</option>
                            <option value="warrior">Warrior</option>
                            <option value="chieftan">Chieftan</option>
                            <option value="god">God</option>
                            <option value="beast">Beast</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="card_balance">Balance:</label>
                        <select id="card_balance" name="balance" required onChange={e => setBalance(e.target.options[e.target.selectedIndex].text)}>
                            <option value="">-- Select Balance --</option>
                            <option value="standard">Standard</option>
                            <option value="aggressive">Aggressive</option>
                            <option value="defensive">Defensive</option>
                        </select>
                    </div>

                    <div>
                        <span>Description:</span>
                        <textarea placeholder="Description" ></textarea>
                    </div>

                    <div>
                        <label htmlFor="card_abilities">Abilities:</label>
                        <select id="card_abilities" name="abilities" required onChange={e => setAbilities(e.target.options[e.target.selectedIndex].text)}>
                            <option value="">-- Select Ability --</option>
                            <option value="berserk">Berserk</option>
                            <option value="command">Command</option>
                            <option value="flight">Flight</option>
                            <option value="forge">Forge</option>
                            <option value="passive">Passive</option>
                            <option value="spell">Spell</option>
                            <option value="swift">Swift</option>
                        </select>
                    </div>

                    <div>
                        <span>Cost:</span>
                        <input value={cost} onChange={handleCostChange} type="number" min="1" max="5" step="1" placeholder="Fate cost" required />
                    </div>
                </form>
                <Card image={previewImage || "Default.png"} strength={stats.strength} endurance={stats.endurance} cost={cost || "-"} name={title || "Your Card"} rarity={"Common"} cardType={cardType || "Type"} description={"Description"}/>
            </div>

        </main>
    );
}