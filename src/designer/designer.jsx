import React, { useState } from 'react';
import { Card } from '../deck/card';

export function Designer() { 
    const [previewImage, setPreviewImage] = useState(null);
    const [title, setTitle] = useState('');
    const [cardType, setCardType] = useState('');
    const [cost, setCost] = useState('');
    const [balance, setBalance] = useState('');
    const [abilities, setAbilities] = useState('');
    const [spellDescription, setSpellDescription] = useState('');
    const [passiveValue, setPassiveValue] = useState('');
    const [passiveModifierType, setPassiveModifierType] = useState('');
    const [passiveTarget, setPassiveTarget] = useState('');

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
            setBalance('');
            setAbilities('');
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
    const statSum = stats.strength !== '-' && stats.endurance !== '-' ? stats.strength + stats.endurance : 0;

    function calculatePassiveStats() {
        if (stats.strength === '-' || stats.endurance === '-') {
            return stats;
        }
        
        const passiveVal = parseInt(passiveValue, 10) || 0;
        if (passiveVal === 0) return stats;
        
        let strength = stats.strength;
        let endurance = stats.endurance;
        
        // For defensive balance, start reducing endurance; otherwise start with strength
        const startWithEndurance = balance === 'Defensive';
        
        for (let i = 0; i < passiveVal; i++) {
            if ((startWithEndurance && i % 2 === 0) || (!startWithEndurance && i % 2 === 1)) {
                endurance = Math.max(1, endurance - 1);
            } else {
                strength = Math.max(1, strength - 1);
            }
        }
        
        return { strength, endurance };
    }

    const displayStats = (abilities === 'Passive' || abilities === 'Forge' || abilities === 'Flight') ? calculatePassiveStats() : stats;

    function generatePassiveDescription() {
        if (!passiveModifierType) {
            return 'Passive - ';
        }
        
        if (passiveModifierType === 'Maximum Fate') {
            return `Passive - +${passiveValue} maximum fate while this card is in play`;
        }
        
        const statName = passiveModifierType.toLowerCase();
        const direction = passiveTarget === 'Enemy' ? 'reduced' : 'increased';
        const cardType = passiveTarget === 'Enemy' ? 'enemy' : 'allied';
        
        return `Passive - the ${statName} of all ${cardType} cards is ${direction} by ${passiveValue} while this card is in play`;
    }

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
                        <span>Cost:</span>
                        <input value={cost} onChange={handleCostChange} type="number" min="1" max="5" step="1" placeholder="Fate cost" required />
                    </div>

                    {cost && (
                        <div>
                            <label htmlFor="card_balance">Balance:</label>
                            <select id="card_balance" name="balance" required onChange={e => setBalance(e.target.options[e.target.selectedIndex].text)}>
                                <option value="">-- Select Balance --</option>
                                <option value="standard">Standard</option>
                                <option value="aggressive">Aggressive</option>
                                <option value="defensive">Defensive</option>
                            </select>
                        </div>
                    )}

                    {cost && balance && (
                        <div>
                            <label htmlFor="card_abilities">Abilities:</label>
                            <select id="card_abilities" name="abilities" required onChange={e => setAbilities(e.target.options[e.target.selectedIndex].text)}>
                                <option value="">-- Select Ability --</option>
                                <option value="berserk">Berserk</option>
                                <option value="command">Command</option>
                                <option value="flight" disabled={balance === 'Standard' && cost === '1'}>Flight</option>
                                <option value="forge" disabled={balance === 'Standard' && cost === '1'}>Forge</option>
                                <option value="passive" disabled={balance === 'Standard' && cost === '1'}>Passive</option>
                                <option value="spell">Spell</option>
                                <option value="swift">Swift</option>
                            </select>
                        </div>
                    )}

                    {abilities === 'Spell' && (
                        <div>
                            <span>Spell Description:</span>
                            <textarea value={spellDescription} onChange={e => setSpellDescription(e.target.value)} placeholder="Enter spell description" maxLength="85" style={{ minHeight: '60px', resize: 'vertical' }}></textarea>
                        </div>
                    )}

                    {abilities === 'Flight' && (
                        <div>
                            <span>Strength Requirement:</span>
                            <input value={passiveValue} onChange={e => setPassiveValue(e.target.value)} type="number" min="1" max={stats.strength !== '-' && stats.endurance !== '-' ? Math.max(0, stats.strength + stats.endurance - 2) : 0} placeholder="0" />
                        </div>
                    )}

                    {abilities === 'Forge' && (
                        <div>
                            <input value={passiveValue} onChange={e => setPassiveValue(e.target.value)} type="number" min="1" max={stats.strength !== '-' && stats.endurance !== '-' ? Math.max(0, stats.strength + stats.endurance - 2) : 0} placeholder="0" />
                        </div>
                    )}

                    {abilities === 'Passive' && (
                        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                            <input value={passiveValue} onChange={e => setPassiveValue(e.target.value)} type="number" min="1" max={stats.strength !== '-' && stats.endurance !== '-' ? Math.max(0, stats.strength + stats.endurance - 2) : 0} placeholder="0" style={{ flex: 1, minWidth: 'auto' }} />
                            <select id="passive_type" name="passive_type" onChange={e => {
                                const selectedType = e.target.options[e.target.selectedIndex].text;
                                setPassiveModifierType(selectedType);
                                if (selectedType !== 'Strength' && selectedType !== 'Endurance') {
                                    setPassiveTarget('');
                                }
                            }} style={{ flex: 1, minWidth: 'auto' }}>
                                <option value="">-- Select Type --</option>
                                <option value="fate">Maximum Fate</option>
                                <option value="strength">Strength</option>
                                <option value="endurance">Endurance</option>
                            </select>
                            {(passiveModifierType === 'Strength' || passiveModifierType === 'Endurance') && (
                                <select id="passive_target" name="passive_target" onChange={e => setPassiveTarget(e.target.options[e.target.selectedIndex].text)} style={{ flex: 1, minWidth: 'auto' }}>
                                    <option value="">-- Select Target --</option>
                                    <option value="enemy">Enemy</option>
                                    <option value="allied">Allied</option>
                                </select>
                            )}
                        </div>
                    )}

                </form>
                <Card image={previewImage || "Default.png"} strength={displayStats.strength} endurance={displayStats.endurance} cost={cost || "-"} name={title || "Your Card"} rarity={"Common"} cardType={cardType || "Type"} description={abilities ? (abilities === "Swift" ? "Swift - this card can attack on the same turn it enters play" : abilities === "Spell" ? `Spell - ${spellDescription}` : abilities === "Passive" ? generatePassiveDescription() : abilities === "Forge" ? `Forge - permanently increases the strength of any one allied card by ${passiveValue || 0} when played` : abilities === "Flight" ? `Flight - requires +${passiveValue || 0} strength to be blocked by a card without flight` : `${abilities} - `) : "Description"}/>
            </div>

        </main>
    );
}