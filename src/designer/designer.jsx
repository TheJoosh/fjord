import React, { useState } from 'react';
import { Card } from '../deck/card';

export function Designer() {
    const [previewImage, setPreviewImage] = useState(null);

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
                        <input type="text" placeholder="Card Title" required />
                    </div>

                    <div>
                        <label htmlFor="card_class">class:</label>
                        <select id="card_class" name="class" required>
                            <option value="warrior">Warrior</option>
                            <option value="chieftan">Chieftan</option>
                            <option value="god">God</option>
                            <option value="beast">Beast</option>
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

                <Card image={previewImage || "Default.png"} strength={"-"} endurance={"-"} cost={"-"} name={"Your Card"} rarity={"Common"} cardType={"Type"} description={"Description"}/>
            </div>

        </main>
    );
}