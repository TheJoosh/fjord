import React from 'react';

export function Card({ image, name, cost, rarity, cardType, description, strength, endurance }) {
  const stats = strength === '-' && endurance === '-' ? '-/-' : `${strength}/${endurance}`;

  // Support both local filenames (assumed in Card Images/) and data URLs / absolute URLs.
  const src = image
    ? (typeof image === 'string' && (image.startsWith('data:') || image.startsWith('http') || image.includes('/'))
        ? image
        : `Card Images/${image}`)
    : '';

  return (
    <div className="fj-card">
      <div className="card-image">
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          width="300"
          height="420"
        />
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
