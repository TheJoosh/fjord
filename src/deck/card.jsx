import React from 'react';

export function Card({ image, name, cost, rarity, cardType, description, strength, endurance }) {
  const stats = strength === '-' && endurance === '-' ? '-/-' : `${strength}/${endurance}`;

  return (
    <div className="fj-card">
      <div className="card-image">
        <img src={`Card Images/${image}`} alt={name} />
      </div>
      <div className="card-cost">{cost}</div>
      <div className="card-content">
        <h1 className="card-name">{name}</h1>
        <span className="card-type">{rarity} {cardType}</span>
        <span className="card-description">{description}</span>
      </div>
      <div className="card-stats">{stats}</div>
    </div>
  );
}
