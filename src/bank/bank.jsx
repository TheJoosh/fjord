import React from 'react';
import { Card } from '../data/card';
import { getCardByName, getCardScarcityScore, recalcCardValues, syncCardPopulationsFromOwnedCards } from '../data/cards';
import { getUser, normalizeWalletValue, users } from '../data/users';
import { tradeService } from '../../services/tradeService';

export function Bank({ userName }) {
  const sortOptions = ['Value', 'Rarity', 'Name'];
  const cardsPerPage = 40;
  const [currentPage, setCurrentPage] = React.useState(1);
  const [bankCards, setBankCards] = React.useState([]);
  const [ownedDeckCards, setOwnedDeckCards] = React.useState([]);
  const [isSellMode, setIsSellMode] = React.useState(false);
  const [sortBy, setSortBy] = React.useState('Rarity');
  const [walletBalance, setWalletBalance] = React.useState(0);
  const user = getUser(userName);
  const walletValue = normalizeWalletValue(walletBalance);

  const loadBankCards = React.useCallback(async () => {
    return await tradeService.loadBankInventory([]);
  }, []);

  const sortedOwned = [...bankCards].sort((a, b) => {
    const aCard = a.card;
    const bCard = b.card;

    if (sortBy === 'Value') {
      const av = aCard && typeof aCard.value === 'number' ? aCard.value : 0;
      const bv = bCard && typeof bCard.value === 'number' ? bCard.value : 0;
      const vDiff = bv - av;
      if (vDiff !== 0) return vDiff;
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'Name') {
      return a.name.localeCompare(b.name);
    }

    const aScarcity = getCardScarcityScore(a.name);
    const bScarcity = getCardScarcityScore(b.name);
    const scarcityDiff = bScarcity - aScarcity;
    if (scarcityDiff !== 0) return scarcityDiff;

    return a.name.localeCompare(b.name);
  });

  const sortedOwnedDeckCards = React.useMemo(() => {
    return [...ownedDeckCards].sort((a, b) => {
      if (sortBy === 'Value') {
        const av = typeof a?.value === 'number' ? a.value : 0;
        const bv = typeof b?.value === 'number' ? b.value : 0;
        const vDiff = bv - av;
        if (vDiff !== 0) return vDiff;
        return (a?.name || '').localeCompare(b?.name || '');
      }

      if (sortBy === 'Name') {
        return (a?.name || '').localeCompare(b?.name || '');
      }

      const aScarcity = getCardScarcityScore(a?.name);
      const bScarcity = getCardScarcityScore(b?.name);
      const scarcityDiff = bScarcity - aScarcity;
      if (scarcityDiff !== 0) return scarcityDiff;

      return (a?.name || '').localeCompare(b?.name || '');
    });
  }, [ownedDeckCards, sortBy]);

  const totalRenderedCards = sortedOwned.length;
  const totalPages = Math.max(1, Math.ceil(totalRenderedCards / cardsPerPage));
  const startIndex = totalRenderedCards === 0 ? 0 : (currentPage - 1) * cardsPerPage + 1;
  const endIndex = Math.min(currentPage * cardsPerPage, totalRenderedCards);
  const paginatedCards = sortedOwned.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);
  const showPagination = totalPages > 1;
  const showPreviousPageArrow = currentPage > 1;
  const showNextPageArrow = currentPage < totalPages;

  const goToPreviousPage = () => {
    setCurrentPage((previousPage) => Math.max(1, previousPage - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((previousPage) => (previousPage >= totalPages ? 1 : previousPage + 1));
  };

  const handleBuyCard = async (cardName) => {
    if (!userName || !cardName) return;

    const latestCard = getCardByName(cardName);
    if (!latestCard) return;

    const buyPrice = normalizeWalletValue((typeof latestCard.value === 'number' ? latestCard.value : 0) * 1.15);
    const userObj = getUser(userName);
    const currentWallet = normalizeWalletValue(userObj?.wallet);
    if (!userObj || currentWallet < buyPrice) return;

    const bankEntry = bankCards.find((entry) => entry.name === cardName);
    const bankQty = Math.max(0, parseInt(bankEntry?.qty, 10) || 0);
    if (bankQty <= 0) return;

    const response = await tradeService.buyBankCard(
      userName,
      cardName,
      buyPrice,
      userObj?.cards || {},
      currentWallet
    );
    if (!response.ok) return;

    const nextWallet = normalizeWalletValue(response.wallet);
    userObj.wallet = nextWallet;
    if (users[userName] && typeof users[userName] === 'object') {
      users[userName].wallet = nextWallet;
    }
    setWalletBalance(nextWallet);

    const nextBankCards = (response.bankEntries || [])
      .map((entry) => {
        if (!entry?.name) return null;
        const qty = Math.max(0, parseInt(entry.qty, 10) || 0);
        if (qty <= 0) return null;
        const card = getCardByName(entry.name);
        if (!card) return null;
        return { name: entry.name, qty, card };
      })
      .filter(Boolean);
    setBankCards(nextBankCards);

    syncCardPopulationsFromOwnedCards(users);
    recalcCardValues();
    setOwnedDeckCards(await buildOwnedDeckCards());
  };

  const handleSellCard = async (cardName) => {
    if (!userName || !cardName) return;

    const latestCard = getCardByName(cardName);
    if (!latestCard) return;

    const sellValue = typeof latestCard.value === 'number' ? latestCard.value : 0;
    const payoutAmount = normalizeWalletValue(sellValue * 0.85);
    const userObj = getUser(userName);
    if (!userObj) return;

    const currentWallet = normalizeWalletValue(userObj?.wallet);
    const response = await tradeService.sellBankCard(
      userName,
      cardName,
      payoutAmount,
      userObj?.cards || {},
      currentWallet
    );
    if (!response.ok) return;

    const nextWallet = normalizeWalletValue(response.wallet);
    userObj.wallet = nextWallet;
    if (users[userName] && typeof users[userName] === 'object') {
      users[userName].wallet = nextWallet;
    }
    setWalletBalance(nextWallet);

    const nextBankCards = (response.bankEntries || [])
      .map((entry) => {
        if (!entry?.name) return null;
        const qty = Math.max(0, parseInt(entry.qty, 10) || 0);
        if (qty <= 0) return null;
        const card = getCardByName(entry.name);
        if (!card) return null;
        return { name: entry.name, qty, card };
      })
      .filter(Boolean);
    setBankCards(nextBankCards);

    syncCardPopulationsFromOwnedCards(users);
    recalcCardValues();

    setOwnedDeckCards(await buildOwnedDeckCards());
  };

  const buildOwnedDeckCards = React.useCallback(async () => {
    return await tradeService.buildOwnedDeckCards(userName, user?.cards || {});
  }, [user, userName]);

  React.useEffect(() => {
    (async () => {
      setBankCards(await loadBankCards());
    })();
  }, [loadBankCards]);

  React.useEffect(() => {
    setWalletBalance(normalizeWalletValue(user?.wallet));
  }, [userName, user]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, isSellMode]);
  
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    if (!isSellMode) return;
    (async () => {
      setOwnedDeckCards(await buildOwnedDeckCards());
    })();
  }, [isSellMode, buildOwnedDeckCards]);

  React.useEffect(() => {
    (async () => {
      setOwnedDeckCards(await buildOwnedDeckCards());
    })();
  }, [userName, buildOwnedDeckCards]);

  return (
    <main className="bank-page">
      <div className="user">
        <div className="user-header-row">
          <h2>
            Bank - {isSellMode ? 'sell cards at a slight markdown' : 'buy cards to add to your deck'}
          </h2>
          <div className="deck-controls">
            <label className="sort-by-control">
              <span>Sort By</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {sortOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {
          <div className="deck-value-row">
            <div className="deck-value">
              Wallet: ${walletValue.toFixed(2)}
            </div>
            <div className="deck-value-pagination-slot" aria-hidden={isSellMode || !showPagination}>
              {!isSellMode && showPagination && (
                <div className="deck-pagination">
                  {showPreviousPageArrow && (
                    <button type="button" className="deck-pagination-arrow" onClick={goToPreviousPage} aria-label="Previous page">←</button>
                  )}
                  <span>{startIndex}-{endIndex} of {totalRenderedCards}</span>
                  {showNextPageArrow && (
                    <button type="button" className="deck-pagination-arrow" onClick={goToNextPage} aria-label="Next page">→</button>
                  )}
                </div>
              )}
            </div>
            <button className="picker" onClick={() => setIsSellMode((prev) => !prev)}>
              {isSellMode ? 'Buy Cards!' : 'Sell Cards!'}
            </button>
          </div>
        }
      </div>

      <h3 className="value" style={{ textAlign: 'center', fontSize: '2rem' }}>{isSellMode ? `${userName || 'User'}'s Deck` : 'Bank Inventory'}</h3>

      {!isSellMode && (
        <div className="container-fluid">
          <div className="row deck-row">
            {paginatedCards.map(({ name, card, qty }) => {
              const buyPrice = normalizeWalletValue((typeof card.value === 'number' ? card.value : 0) * 1.15);
              const canAfford = walletValue >= buyPrice;

              return (
                <div className="col deck-col" key={name}>
                  <Card
                    image={card.image}
                    name={card.name}
                    cost={card.cost}
                    rarity={card.rarity}
                    cardType={card.cardType}
                    description={card.description}
                    strength={card.strength}
                    endurance={card.endurance}
                  />
                  <div className="card-value mt-1">
                    <div className="card-meta-row">
                      <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                      <small className="card-quantity">Quantity: {qty}</small>
                    </div>
                    <small>Author: {card.author || 'Unknown'}</small>
                  </div>
                  <button
                    type="button"
                    className="picker"
                    onClick={() => handleBuyCard(name)}
                    disabled={!canAfford}
                    style={!canAfford ? { color: 'red' } : undefined}
                  >
                    Buy for ${buyPrice.toFixed(2)}?
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isSellMode && (
        <>
          <section className="yoUser">
            <div className="container-fluid">
              <div className="row deck-row">
                {sortedOwnedDeckCards.map((card) => {
                  const payoutAmount = normalizeWalletValue(((typeof card.value === 'number' ? card.value : 0) * 0.85));

                  return (
                  <div key={card.name} className="col deck-col">
                    <Card
                      image={card.image}
                      name={card.name}
                      cost={card.cost}
                      rarity={card.rarity}
                      cardType={card.cardType}
                      description={card.description}
                      strength={card.strength}
                      endurance={card.endurance}
                    />
                    <div className="card-value mt-1">
                      <div className="card-meta-row">
                        <small>Value: ${card.value != null ? card.value.toFixed(2) : '0.00'}</small>
                        <small className="card-quantity">Quantity: {card.qty}</small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="picker"
                      onClick={() => handleSellCard(card.name)}
                    >
                      Sell for ${payoutAmount.toFixed(2)}?
                    </button>
                  </div>
                )})}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}