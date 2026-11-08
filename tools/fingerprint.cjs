// Usage: node tools/fingerprint.cjs
// Plays a fixed script over fixed seeds (trade cards with every leverage card in the hand, manipulation, specials on
// the first open trade, closes at fixed ticks, the shop's first affordable reel) and prints a hash of every number that
// matters (cash, equity, heat, trades, piles, the shop). Run it before and after a cleanup: the same hash means the same game.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `;return { newRun, advanceTick, closeDay, startNextDay, openTheMarket, openShop, buyReelCard, spinReels, sellCard,
    cardBlockedReason, isTradeCard, playMarketCard, playTradeCard, openBenchTrade, closeTrade, redrawCards, totalEquity, PLAYER_CARDS };`)();
}
const game = loadGame();
const hash = crypto.createHash('sha256');
const record = (...values) => hash.update(JSON.stringify(values));

// Play every card the hand allows, in hand order: trade cards get every leverage card after them.
function playHand(run) {
  for (let index = 0; index < run.hand.length; index++) {
    const cardId = run.hand[index], card = game.PLAYER_CARDS[cardId];
    if (game.cardBlockedReason(run, cardId)) continue;
    if (game.isTradeCard(cardId)) {
      run.hand.splice(index, 1);
      run.today.bench.tradeCard = cardId;
      for (const leverageCard of run.hand.filter(other => game.PLAYER_CARDS[other].family === 'leverage' && !game.cardBlockedReason(run, other))) {
        run.hand.splice(run.hand.indexOf(leverageCard), 1);
        run.today.bench.leverageCards.push(leverageCard);
      }
      record(game.openBenchTrade(run, 0.4).number);
    } else if (card.target === 'trade') record(game.playTradeCard(run, index, 0));
    else if (card.family !== 'leverage') record(game.playMarketCard(run, index));
    else continue;
    index = -1;                                   // the hand changed: start again from the left
  }
}

for (const seed of [11, 22, 33]) {
  const run = game.newRun(seed);
  for (let day = 0; day < 25 && !run.gameOverReason; day++) {
    if (day % 3 === 1) game.redrawCards(run, [0, 2]);
    playHand(run);
    game.openTheMarket(run);
    while (run.phase === 'trading') {
      const outcome = game.advanceTick(run);
      if (run.today.tick === 30 && run.today.trades.length) record(game.closeTrade(run, 0));
      if (run.today.tick === 50) playHand(run);
      record(run.today.tick, run.cash, game.totalEquity(run), run.heat, run.today.trades.length, outcome.liquidated);
      if (outcome.closed) game.closeDay(run);
    }
    record(run.lastResult.endEquity, run.hand, run.drawPile.length, run.discardPile.length);
    if (run.gameOverReason) break;
    game.openShop(run);
    game.spinReels(run);
    const reelIndex = run.shop.reels.findIndex((cardId, index) => game.buyReelCard(run, index));
    if (day % 5 === 4) game.sellCard(run, run.deck[0]);
    record(run.shop, reelIndex, run.deck);
    game.startNextDay(run);
  }
}
console.log(hash.digest('hex').slice(0, 16));
