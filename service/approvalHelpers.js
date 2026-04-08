const persistence = require('./persistence');

async function trackDesignApprovalForAuthor(author, cardName) {
  if (!author || !cardName) return;

  await persistence.addDiscoveredCards(author, [cardName]);

  if (author === 'Fjord') return;

  await persistence.addDesignedCard(author, cardName);

  const currentDesigned = await persistence.ensureDesignedCount(author, 0);
  await persistence.setDesignedCount(author, currentDesigned + 1);
}

module.exports = {
  trackDesignApprovalForAuthor,
};