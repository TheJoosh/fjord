import React from 'react';

export function Card({ className = '', image, name, displayname, cost, rarity, cardType, description, strength, endurance, imageOnly = false }) {
  const stats = strength === '-' && endurance === '-' ? '-/-' : `${strength}/${endurance}`;
  const title = (typeof displayname === 'string' && displayname.trim()) ? displayname.trim() : name;

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
    <div className={`fj-card ${className}`.trim()}>
      <div className="card-image">
        <img
          src={src}
          alt={title}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          width="300"
          height="420"
        />
      </div>
      {!imageOnly && (
        <>
          <div className="card-cost">{cost}</div>
          <div className="card-content">
            <h1 className="card-name">{title}</h1>
            <span className="card-type">{rarity} {cardType}</span>
            <span className="card-description">{description}</span>
          </div>
          <div className="card-stats">{stats}</div>
        </>
      )}
    </div>
  );
}
