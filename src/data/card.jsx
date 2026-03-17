import React from 'react';

export function Card({ image, name, cost, rarity, cardType, description, strength, endurance }) {
  const stats = strength === '-' && endurance === '-' ? '-/-' : `${strength}/${endurance}`;

  // Support both local filenames (assumed in Card Images/) and data URLs / absolute URLs.
  const imageRef = typeof image === 'string' ? image.trim() : '';
  const src = image
    ? (imageRef.startsWith('cardimg:')
        ? `/api/card-images/${encodeURIComponent(imageRef.slice('cardimg:'.length))}`
        : (imageRef.startsWith('data:') || imageRef.startsWith('http') || imageRef.includes('/'))
            ? imageRef
            : `Card Images/${imageRef}`)
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
