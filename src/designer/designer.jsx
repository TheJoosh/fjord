import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../data/card';
import { cardNameExists } from '../data/cards';
import { gameApiClient } from '../../service/gameApiClient';

export function Designer({ userName }) { 
    const imageInputRef = useRef(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [title, setTitle] = useState('');
    const [isNamedCharacter, setIsNamedCharacter] = useState(false);
    const [cardType, setCardType] = useState('');
    const [cost, setCost] = useState('');
    const [balance, setBalance] = useState('');
    const [abilities, setAbilities] = useState('');
    const [spellDescription, setSpellDescription] = useState('');
    const [passiveValue, setPassiveValue] = useState('1');
    const [commandValue, setCommandValue] = useState('1');
    const [passiveModifierType, setPassiveModifierType] = useState('');
    const [passiveTarget, setPassiveTarget] = useState('');
    const [pexelsQuery, setPexelsQuery] = useState('');
    const [isFetchingPexels, setIsFetchingPexels] = useState(false);
    const [pexelsError, setPexelsError] = useState('');
    const [pexelsResults, setPexelsResults] = useState([]);
    const [isPexelsOverlayOpen, setIsPexelsOverlayOpen] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');

    const PEXELS_API_KEY = '3PQVY2DSpPY5xU8aU95IxDF8j2VOL19hZGc4GtnSVwk5amlxTPBUwo9Y';

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    async function optimizeUploadedImage(file) {
        const originalDataUrl = await fileToDataUrl(file);

        try {
            const image = await loadImage(originalDataUrl);
            const sourceWidth = image.naturalWidth || image.width;
            const sourceHeight = image.naturalHeight || image.height;

            if (!sourceWidth || !sourceHeight) {
                return originalDataUrl;
            }

            const maxDimension = 1400;
            const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
            const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
            const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const context = canvas.getContext('2d');
            if (!context) {
                return originalDataUrl;
            }

            context.drawImage(image, 0, 0, targetWidth, targetHeight);

            const optimizedDataUrl = canvas.toDataURL('image/webp', 0.82);
            if (!optimizedDataUrl) {
                return originalDataUrl;
            }

            return optimizedDataUrl.length < originalDataUrl.length ? optimizedDataUrl : originalDataUrl;
        } catch {
            return originalDataUrl;
        }
    }

    function handleFileChange(e) {
        const input = e.target;
        if (!input || !input.files || input.files.length === 0) return;
        const file = input.files[0];

        if (!file.type.startsWith('image/')) return;

        (async () => {
            const optimizedImage = await optimizeUploadedImage(file);
            setPreviewImage(optimizedImage);
        })();
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
            if (num < 2 && abilities === 'Command') {
                setAbilities('');
            }
        }
    }

    async function handlePexelsFetch() {
        const query = (pexelsQuery || title || cardType || 'mythology').trim();
        if (!query) return;

        setIsPexelsOverlayOpen(true);
        setIsFetchingPexels(true);
        setPexelsError('');
        setPexelsResults([]);

        try {
            const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=120&orientation=portrait`, {
                headers: {
                    Authorization: PEXELS_API_KEY,
                },
            });

            if (!response.ok) {
                throw new Error('Pexels request failed');
            }

            const data = await response.json();
            const photos = Array.isArray(data?.photos) ? data.photos : [];
            const formattedResults = photos
                .map(photo => ({
                    id: photo.id,
                    thumb: photo?.src?.medium || photo?.src?.small || photo?.src?.tiny,
                    image: photo?.src?.large2x || photo?.src?.large || photo?.src?.original,
                    alt: photo?.alt || 'Pexels image',
                }))
                .filter(photo => photo.thumb && photo.image);

            if (!formattedResults.length) {
                setPexelsError('No images found for that search.');
                return;
            }

            setPexelsResults(formattedResults);
        } catch (error) {
            setPexelsError('Unable to load image from Pexels right now.');
        } finally {
            setIsFetchingPexels(false);
        }
    }

    function handlePexelsQueryKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePexelsFetch();
        }
    }

    useEffect(() => {
        if (!isPexelsOverlayOpen) return;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsPexelsOverlayOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isPexelsOverlayOpen]);

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

    function getValueMax() {
        if (stats.strength === '-' || stats.endurance === '-') return 1;
        return Math.max(1, stats.strength + stats.endurance - 2);
    }

    function getCommandFieldMax(otherValue) {
        const max = getValueMax();
        const other = parseInt(otherValue, 10);
        const safeOther = isNaN(other) ? 1 : Math.max(1, other);
        return Math.max(1, max - safeOther);
    }

    function handleBoundedValueChange(e, setter, options = {}) {
        const value = e.target.value;
        const max = options.maxOverride ?? (options.coupled ? getCommandFieldMax(options.otherValue) : getValueMax());

        if (value === '') {
            setter('1');
            return;
        }

        const num = parseInt(value, 10);
        if (isNaN(num)) {
            setter('1');
            return;
        }

        setter(Math.min(max, Math.max(1, num)).toString());
    }

    useEffect(() => {
        const max = getValueMax();
        let nextPassive = parseInt(passiveValue, 10);
        let nextCommand = parseInt(commandValue, 10);

        nextPassive = isNaN(nextPassive) ? 1 : Math.min(max, Math.max(1, nextPassive));
        nextCommand = isNaN(nextCommand) ? 1 : Math.min(max, Math.max(1, nextCommand));

        if (abilities === 'Command' && nextPassive + nextCommand > max) {
            nextCommand = Math.max(1, max - nextPassive);
            if (nextPassive + nextCommand > max) {
                nextPassive = Math.max(1, max - nextCommand);
            }
        }

        if (nextPassive.toString() !== passiveValue) {
            setPassiveValue(nextPassive.toString());
        }
        if (nextCommand.toString() !== commandValue) {
            setCommandValue(nextCommand.toString());
        }
    }, [cost, balance, abilities, passiveValue, commandValue]);

    useEffect(() => {
        if (!abilities) return;

        const standardOneDisabled = balance === 'Standard' && cost === '1';
        const invalidSelectedAbility =
            ((abilities === 'Forge' || abilities === 'Passive' || abilities === 'Flight') && standardOneDisabled) ||
            (abilities === 'Command' && Number(cost) < 2);

        if (invalidSelectedAbility) {
            setAbilities('');
        }
    }, [cost, balance, abilities]);

    function calculatePassiveStats() {
        if (stats.strength === '-' || stats.endurance === '-') {
            return stats;
        }
        
        const passiveVal = getEffectivePassiveValue();
        const commandVal = getEffectiveCommandValue();
        const totalReduction = abilities === 'Command' ? passiveVal + commandVal : passiveVal;
        if (totalReduction === 0) return stats;
        
        let strength = stats.strength;
        let endurance = stats.endurance;
        
        // For defensive balance, start reducing endurance; otherwise start with strength
        const startWithEndurance = balance === 'Defensive';
        
        for (let i = 0; i < totalReduction; i++) {
            if ((startWithEndurance && i % 2 === 0) || (!startWithEndurance && i % 2 === 1)) {
                endurance = Math.max(1, endurance - 1);
            } else {
                strength = Math.max(1, strength - 1);
            }
        }
        
        return { strength, endurance };
    }

    const displayStats = (abilities === 'Passive' || abilities === 'Forge' || abilities === 'Flight' || abilities === 'Command' || abilities === 'Berserk') ? calculatePassiveStats() : stats;

    function getCommandInputMax(currentValue, otherValue) {
        return getCommandFieldMax(otherValue);
    }

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

    function getNumberWord(value) {
        const numberWords = {
            0: 'zero',
            1: 'one',
            2: 'two',
            3: 'three',
            4: 'four',
            5: 'five',
            6: 'six',
            7: 'seven',
            8: 'eight',
            9: 'nine',
            10: 'ten',
        };
        const parsed = parseInt(value, 10);
        return numberWords[parsed] || value;
    }

    function getNormalizedModifierType(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getModifierLabel(value) {
        const normalized = getNormalizedModifierType(value);
        if (normalized === 'strength') return 'Strength';
        if (normalized === 'endurance') return 'Endurance';
        if (normalized === 'maximum fate' || normalized === 'fate') return 'Maximum Fate';
        return '';
    }

    function getEffectivePassiveValue() {
        const passiveVisible = abilities === 'Flight' || abilities === 'Forge' || abilities === 'Passive' || abilities === 'Command' || abilities === 'Berserk';
        if (!passiveVisible) return 0;
        const parsed = parseInt(passiveValue, 10);
        return isNaN(parsed) ? 0 : parsed;
    }

    function getEffectiveCommandValue() {
        if (abilities !== 'Command') return 0;
        const parsed = parseInt(commandValue, 10);
        return isNaN(parsed) ? 0 : parsed;
    }

    function calculateRarityScore() {
        const parsedCost = parseInt(cost, 10);
        const safeCost = isNaN(parsedCost) ? 0 : parsedCost;
        const abilityWeight = getEffectivePassiveValue() + getEffectiveCommandValue();
        const novelty = isNamedCharacter ? 2 : 0;

        return 2 * safeCost + abilityWeight + novelty;
    }

    function calculateRarity() {
        const rarityScore = calculateRarityScore();

        if (rarityScore <= 2) return 'Common';
        if (rarityScore <= 4) return 'Uncommon';
        if (rarityScore <= 6) return 'Rare';
        if (rarityScore <= 8) return 'Loric';
        if (rarityScore <= 10) return 'Mythical';
        return 'Legendary';
    }

    const calculatedRarity = calculateRarity();

    function getRewardPackKeyForDesignCount(designCount) {
        const safeCount = Math.max(1, parseInt(designCount, 10) || 1);
        const cyclePosition = ((safeCount - 1) % 100) + 1;

        const targets = [
            { pack: 'Default Pack', count: 40 },
            { pack: 'Saga Pack', count: 30 },
            { pack: 'Heroic Pack', count: 18 },
            { pack: 'Mythbound Pack', count: 12 },
        ];

        const assigned = {
            'Default Pack': 0,
            'Saga Pack': 0,
            'Heroic Pack': 0,
            'Mythbound Pack': 0,
        };

        let selectedPack = 'Default Pack';

        for (let position = 1; position <= cyclePosition; position++) {
            let bestPack = null;
            let bestDeficit = Number.NEGATIVE_INFINITY;

            for (const target of targets) {
                if (assigned[target.pack] >= target.count) continue;

                const expectedByNow = (position * target.count) / 100;
                const deficit = expectedByNow - assigned[target.pack];

                if (deficit > bestDeficit) {
                    bestDeficit = deficit;
                    bestPack = target.pack;
                }
            }

            if (!bestPack) break;

            assigned[bestPack] += 1;
            if (position === cyclePosition) {
                selectedPack = bestPack;
            }
        }

        return selectedPack;
    }

    function isNumberInRange(value, min, max) {
        const parsed = parseInt(value, 10);
        return !isNaN(parsed) && parsed >= min && parsed <= max;
    }

    // Image is optional; if none is provided we submit with Default.png.
    const isImageValid = true;
    const isTitleValid = title.trim().length > 0;
    const isClassValid = Boolean(cardType);
    const isCostValid = isNumberInRange(cost, 1, 5);
    const isBalanceValid = ['Standard', 'Aggressive', 'Defensive'].includes(balance);
    const isAbilityValid = ['Berserk', 'Command', 'Flight', 'Forge', 'Passive', 'Spell', 'Swift'].includes(abilities);

    const passiveMax = getValueMax();
    const isPassiveValueValid = isNumberInRange(passiveValue, 1, passiveMax);
    const isCommandValueValid = isNumberInRange(commandValue, 1, passiveMax);
    const commandTotalValid = (parseInt(passiveValue, 10) || 0) + (parseInt(commandValue, 10) || 0) <= passiveMax;

    let isAbilitySubFieldsValid = true;
    if (abilities === 'Spell') {
        isAbilitySubFieldsValid = spellDescription.trim().length > 0;
    } else if (abilities === 'Flight' || abilities === 'Forge' || abilities === 'Berserk') {
        isAbilitySubFieldsValid = isPassiveValueValid;
    } else if (abilities === 'Passive') {
        const isPassiveTypeValid = ['Maximum Fate', 'Strength', 'Endurance'].includes(passiveModifierType);
        const requiresTarget = passiveModifierType === 'Strength' || passiveModifierType === 'Endurance';
        const isTargetValid = ['Enemy', 'Allied'].includes(passiveTarget);
        isAbilitySubFieldsValid = isPassiveValueValid && isPassiveTypeValid && (!requiresTarget || isTargetValid);
    } else if (abilities === 'Command') {
        const normalizedModifierType = getNormalizedModifierType(passiveModifierType);
        const isCommandTypeValid = normalizedModifierType === 'strength' || normalizedModifierType === 'endurance';
        isAbilitySubFieldsValid = isPassiveValueValid && isCommandValueValid && commandTotalValid && isCommandTypeValid;
    }

    const isSubmitReady =
        isImageValid &&
        isTitleValid &&
        isClassValid &&
        isCostValid &&
        isBalanceValid &&
        isAbilityValid &&
        isAbilitySubFieldsValid;

    let submitDisabledReason = '';
    if (!isSubmitReady) {
        if (!isTitleValid) {
            submitDisabledReason = 'Enter a card title.';
        } else if (!isClassValid) {
            submitDisabledReason = 'Select a class.';
        } else if (!isCostValid) {
            submitDisabledReason = 'Choose a cost between 1 and 5.';
        } else if (!isBalanceValid) {
            submitDisabledReason = 'Select a balance.';
        } else if (!isAbilityValid) {
            submitDisabledReason = 'Select an ability.';
        } else if (abilities === 'Spell' && spellDescription.trim().length === 0) {
            submitDisabledReason = 'Enter a spell description.';
        } else if (abilities === 'Passive') {
            if (!isPassiveValueValid) {
                submitDisabledReason = `Passive value must be between 1 and ${passiveMax}.`;
            } else if (!['Maximum Fate', 'Strength', 'Endurance'].includes(passiveModifierType)) {
                submitDisabledReason = 'Select a passive type.';
            } else if ((passiveModifierType === 'Strength' || passiveModifierType === 'Endurance') && !['Enemy', 'Allied'].includes(passiveTarget)) {
                submitDisabledReason = 'Select a passive target.';
            }
        } else if (abilities === 'Flight' || abilities === 'Forge' || abilities === 'Berserk') {
            submitDisabledReason = `Ability value must be between 1 and ${passiveMax}.`;
        } else if (abilities === 'Command') {
            if (!isPassiveValueValid) {
                submitDisabledReason = `Command boost must be between 1 and ${passiveMax}.`;
            } else if (!isCommandValueValid) {
                submitDisabledReason = `Command target count must be between 1 and ${passiveMax}.`;
            } else if (!commandTotalValid) {
                submitDisabledReason = `Command values must add up to ${passiveMax} or less.`;
            } else if (!['strength', 'endurance'].includes(getNormalizedModifierType(passiveModifierType))) {
                submitDisabledReason = 'Select Command type: Strength or Endurance.';
            }
        }
    }

    const previewDescription = abilities
        ? (abilities === "Swift"
            ? "Swift - this card can attack on the same turn it enters play"
            : abilities === "Spell"
                ? `Spell - ${spellDescription}`
                : abilities === "Command"
                    ? `Command - can temporarily increase the ${(getModifierLabel(passiveModifierType) || 'passiveType').toLowerCase()} of any ${getNumberWord(commandValue || 1)} allied ${parseInt(commandValue, 10) === 1 ? 'card' : 'cards'} by ${passiveValue || 1} each turn`
                    : abilities === "Passive"
                        ? generatePassiveDescription()
                        : abilities === "Forge"
                            ? `Forge - permanently increases the strength of any one allied card by ${passiveValue || 0} when played`
                            : abilities === "Flight"
                                ? `Flight - requires +${passiveValue || 0} strength to be blocked by a card without flight`
                                : abilities === "Berserk"
                                    ? `Berserk - gains +${passiveValue || 1} strength while attacking`
                                    : `${abilities} - `)
        : "Description";

    async function handleSubmitCard(e) {
        e.preventDefault();
        if (!isSubmitReady) return;

        const cardName = title.trim();
        if (!cardName) return;
        if (cardNameExists(cardName)) {
            setSubmitMessage('Error: A card with that name already exists. Please choose a different name.');
            return;
        }

        const submittedImage = previewImage || "Default.png";
        const activeUserName = (userName || '').trim();

        try {
            const cardPayload = {
                image: submittedImage,
                cardType,
                cost: parseInt(cost, 10) || cost,
                description: previewDescription,
                strength: displayStats.strength,
                endurance: displayStats.endurance,
                value: 0,
                author: activeUserName,
                rarity: calculatedRarity,
            };

            const pendingSubmit = await gameApiClient.submitPendingApprovalCard(cardName, cardPayload);
            if (!pendingSubmit.ok) {
                setSubmitMessage(pendingSubmit.error || 'Error: Unable to submit card for approval.');
                return;
            }

            if (activeUserName) {
                const progress = await gameApiClient.submitDesignerProgress(activeUserName);

                const rewardMessageName = progress.rewardPackKey === 'Default Pack'
                    ? 'Normal Pack'
                    : progress.rewardPackKey;
                setSubmitMessage(`You earned a ${rewardMessageName}`);
            }
        } catch (error) {
            console.error('Unable to save designed card', error);
            return;
        }

        setPreviewImage(null);
        setTitle('');
        setIsNamedCharacter(false);
        setCardType('');
        setCost('');
        setBalance('');
        setAbilities('');
        setSpellDescription('');
        setPassiveValue('1');
        setCommandValue('1');
        setPassiveModifierType('');
        setPassiveTarget('');
        setPexelsQuery('');
        setPexelsError('');
        setPexelsResults([]);
        setIsPexelsOverlayOpen(false);
        setIsFetchingPexels(false);

        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    }

    return (
        <main>
            <h1 className="designer-title">Design a card to get card packs</h1>
            <div className="designer">
                <form className ="design-form" onSubmit={handleSubmitCard}>
                    <div className="design-image-row">
                        <h4 className="design-image-helper">Upload an image or search stock photos from Pexels</h4>
                        <hr className="design-divider" />
                        <span>Image:</span>
                        <input ref={imageInputRef} onChange={handleFileChange} type="file" id="image_uploads" name="image_uploads" accept="image/png, image/jpeg" />
                        <div className="pexels-actions">
                            <input
                                className="pexels-query"
                                value={pexelsQuery}
                                onChange={e => setPexelsQuery(e.target.value)}
                                onKeyDown={handlePexelsQueryKeyDown}
                                type="text"
                                placeholder="Search Pexels"
                            />
                            <button
                                type="button"
                                className="pexels-logo-btn"
                                onClick={handlePexelsFetch}
                                disabled={isFetchingPexels}
                                title="Fetch image from Pexels"
                            >
                                <img src="https://images.pexels.com/lib/api/pexels-white.png" alt="Pexels" />
                            </button>
                        </div>
                        {pexelsError && <div className="pexels-error">{pexelsError}</div>}
                    </div>

                    <hr className="design-divider" />

                    <div className="design-row design-row-title">
                        <span>Title:</span>
                        <input value={title} onChange={e => setTitle(e.target.value)} type="text" placeholder="Card Title" required />
                        <label htmlFor="named_character" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            <input id="named_character" type="checkbox" checked={isNamedCharacter} onChange={e => setIsNamedCharacter(e.target.checked)} />
                            <span>Named Character?</span>
                        </label>
                    </div>

                    <div>
                        <label htmlFor="card_class">class:</label>
                        <select id="card_class" name="class" value={cardType} required onChange={e => setCardType(e.target.value)}>
                            <option value="">-- Select Class --</option>
                            <option value="Warrior">Warrior</option>
                            <option value="Chieftan">Chieftan</option>
                            <option value="God">God</option>
                            <option value="Beast">Beast</option>
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
                            <select id="card_abilities" name="abilities" value={abilities} required onChange={e => {
                                const selectedAbility = e.target.value;
                                setAbilities(selectedAbility);
                                if (selectedAbility === 'Command') {
                                    setPassiveTarget('');
                                    if (passiveModifierType === 'Maximum Fate') {
                                        setPassiveModifierType('');
                                    }
                                }
                            }}>
                                <option value="">-- Select Ability --</option>
                                <option value="Berserk" disabled={balance === 'Standard' && cost === '1'}>Berserk</option>
                                <option value="Command" disabled={Number(cost) < 2}>Command</option>
                                <option value="Flight" disabled={balance === 'Standard' && cost === '1'}>Flight</option>
                                <option value="Forge" disabled={balance === 'Standard' && cost === '1'}>Forge</option>
                                <option value="Passive" disabled={balance === 'Standard' && cost === '1'}>Passive</option>
                                <option value="Spell">Spell</option>
                                <option value="Swift">Swift</option>
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
                            <input value={passiveValue} onChange={e => handleBoundedValueChange(e, setPassiveValue)} type="number" min="1" max={stats.strength !== '-' && stats.endurance !== '-' ? Math.max(1, stats.strength + stats.endurance - 2) : 1} placeholder="0" />
                        </div>
                    )}

                    {abilities === 'Forge' && (
                        <div>
                            <input value={passiveValue} onChange={e => handleBoundedValueChange(e, setPassiveValue)} type="number" min="1" max={stats.strength !== '-' && stats.endurance !== '-' ? Math.max(1, stats.strength + stats.endurance - 2) : 1} placeholder="0" />
                        </div>
                    )}

                    {abilities === 'Berserk' && (
                        <div>
                            <input value={passiveValue} onChange={e => handleBoundedValueChange(e, setPassiveValue)} type="number" min="1" max={stats.strength !== '-' && stats.endurance !== '-' ? Math.max(1, stats.strength + stats.endurance - 2) : 1} placeholder="0" />
                        </div>
                    )}

                    {abilities === 'Command' && (
                        <div className="design-row design-row-command">
                            <input value={passiveValue} onChange={e => handleBoundedValueChange(e, setPassiveValue, { coupled: true, otherValue: commandValue, maxOverride: getCommandInputMax(passiveValue, commandValue) })} type="number" min="1" max={getCommandInputMax(passiveValue, commandValue)} placeholder="0" className="design-inline-input" />
                            <input value={commandValue} onChange={e => handleBoundedValueChange(e, setCommandValue, { coupled: true, otherValue: passiveValue, maxOverride: getCommandInputMax(commandValue, passiveValue) })} type="number" min="1" max={getCommandInputMax(commandValue, passiveValue)} placeholder="0" className="design-inline-input" />
                            <select id="command_passive_type" name="command_passive_type" onChange={e => {
                                const selectedType = e.target.value;
                                setPassiveModifierType(selectedType);
                                setPassiveTarget('');
                            }} value={['strength', 'endurance'].includes(getNormalizedModifierType(passiveModifierType)) ? getNormalizedModifierType(passiveModifierType) : ''} className="design-inline-input">
                                <option value="">-- Select Type --</option>
                                <option value="fate" disabled>Maximum Fate</option>
                                <option value="strength">Strength</option>
                                <option value="endurance">Endurance</option>
                            </select>
                        </div>
                    )}

                    {abilities === 'Passive' && (
                        <div className="design-row design-row-passive">
                            <input value={passiveValue} onChange={e => handleBoundedValueChange(e, setPassiveValue)} type="number" min="1" max={stats.strength !== '-' && stats.endurance !== '-' ? Math.max(1, stats.strength + stats.endurance - 2) : 1} placeholder="0" className="design-inline-input" />
                            <select id="passive_type" name="passive_type" onChange={e => {
                                const selectedType = e.target.options[e.target.selectedIndex].text;
                                setPassiveModifierType(selectedType);
                                if (selectedType !== 'Strength' && selectedType !== 'Endurance') {
                                    setPassiveTarget('');
                                }
                            }} className="design-inline-input">
                                <option value="">-- Select Type --</option>
                                <option value="fate">Maximum Fate</option>
                                <option value="strength">Strength</option>
                                <option value="endurance">Endurance</option>
                            </select>
                            {(passiveModifierType === 'Strength' || passiveModifierType === 'Endurance') && (
                                <select id="passive_target" name="passive_target" onChange={e => setPassiveTarget(e.target.options[e.target.selectedIndex].text)} className="design-inline-input">
                                    <option value="">-- Select Target --</option>
                                    <option value="enemy">Enemy</option>
                                    <option value="allied">Allied</option>
                                </select>
                            )}
                        </div>
                    )}

                    {isSubmitReady && (
                        <div>
                            <button type="submit" className="submit-card-btn">Submit Card</button>
                        </div>
                    )}

                    {!isSubmitReady && submitDisabledReason && (
                        <div>
                            <h4 className="designer-message">{submitDisabledReason}</h4>
                        </div>
                    )}

                    <div>
                        <h1 className="designer-message">{submitMessage}</h1>
                    </div>

                </form>
                <Card image={previewImage || "Default.png"} strength={displayStats.strength} endurance={displayStats.endurance} cost={cost || "-"} name={title || "Your Card"} rarity={calculatedRarity} cardType={cardType || "Type"} description={previewDescription}/>
            </div>

            {isPexelsOverlayOpen && (
                <div className="pexels-overlay" onClick={() => setIsPexelsOverlayOpen(false)}>
                    <div className="pexels-overlay-panel" onClick={e => e.stopPropagation()}>
                        <div className="pexels-overlay-header">
                            <h3>Pexels Search Results</h3>
                            <button type="button" className="pexels-overlay-close" onClick={() => setIsPexelsOverlayOpen(false)}>Close</button>
                        </div>

                        {isFetchingPexels && <div className="pexels-overlay-state">Loading images...</div>}
                        {!isFetchingPexels && pexelsError && <div className="pexels-overlay-state">{pexelsError}</div>}

                        {!isFetchingPexels && !pexelsError && (
                            <div className="pexels-overlay-grid">
                                {pexelsResults.map(result => (
                                    <button
                                        key={result.id}
                                        type="button"
                                        className="pexels-overlay-item"
                                        onClick={() => {
                                            setPreviewImage(result.image);
                                            setIsPexelsOverlayOpen(false);
                                            setPexelsError('');
                                        }}
                                    >
                                        <img src={result.thumb} alt={result.alt} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </main>
    );
}