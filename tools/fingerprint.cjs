// Usage: node tools/fingerprint.cjs
// Plays a fixed script over fixed seeds (every playable card of the hand, left to right, at the open and at tick 50; the
// shop's first affordable reel) and prints a hash of every number that
// matters (cash, equity, heat, trades, piles, the shop). Run it before and after a cleanup: the same hash means the same game.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `;return { newRun, advanceTick, closeDay, startNextDay, openTheMarket, openShop, buyReelCard, spinReels, sellCard,
    cardBlockedReason, playCard, redrawHand, totalEquity };`)();
}
const game = loadGame();
const hash = crypto.createHash('sha256');
const record = (...values) => hash.update(JSON.stringify(values));

// Play every card the hand allows, left to right, until none can be played.
function playHand(run) {
  for (let index = 0; index < run.hand.length; index++) {
    if (game.cardBlockedReason(run, run.hand[index])) continue;
    record(game.playCard(run, index));
    index = -1;                                   // the hand changed: start again from the left
  }
}

for (const seed of [11, 22, 33]) {
  const run = game.newRun(seed);
  for (let day = 0; day < 25 && !run.gameOverReason; day++) {
    if (day % 3 === 1) game.redrawHand(run);
    playHand(run);
    game.openTheMarket(run);
    while (run.phase === 'trading') {
      const outcome = game.advanceTick(run);
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
