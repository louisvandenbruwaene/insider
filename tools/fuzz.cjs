// Usage: node tools/fuzz.cjs [runs] [days]
// A random player: random cards from the hand (trades with random leverage stacks and stakes, manipulation, specials on
// random open trades), redraws, random closes, random shop spins, buys and sales, over many days. After every action and
// tick it checks that money, trades and card piles stay valid, and that saving and loading keeps the same equity.
// Prints every problem it finds (at most 15) and a short summary.
const fs = require('fs'), path = require('path');

function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `;return { newRun, advanceTick, closeDay, startNextDay, openTheMarket, openShop, spinReels, buyReelCard, sellCard,
    cardBlockedReason, isTradeCard, playMarketCard, playTradeCard, openBenchTrade, closeTrade, redrawCards, totalEquity, currentPrice,
    tradeValue, serialiseRun, loadRun, PLAYER_CARDS, TICKS_PER_DAY };`)();
}
const game = loadGame();
const RUNS = Number(process.argv[2]) || 40;
const DAYS_PER_RUN = Number(process.argv[3]) || 60;

function seededRandom(seed) {
  let state = seed;
  return () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
}
let problemCount = 0;
function report(run, where, problem) {
  if (problemCount++ < 15) console.log('PROBLEM day', run.day, 'tick', run.today && run.today.tick, where, problem);
}
function checkInvariants(run, where) {
  const today = run.today;
  if (!Number.isFinite(run.cash) || run.cash < -1e-6) report(run, where, 'cash ' + run.cash);
  if (!Number.isFinite(game.totalEquity(run))) report(run, where, 'equity ' + game.totalEquity(run));
  if (!(game.currentPrice(today) > 0)) report(run, where, 'price ' + game.currentPrice(today));
  for (const trade of today.trades) {
    if (!(trade.quantity > 0) || !Number.isFinite(trade.margin) || !Number.isFinite(trade.referenceUnitPrice)) report(run, where, 'trade ' + JSON.stringify(trade));
    if (!(game.tradeValue(run, trade) >= 0)) report(run, where, 'trade value ' + game.tradeValue(run, trade));
  }
  // every owned card is in exactly one place
  const placed = [...run.drawPile, ...run.hand, ...run.discardPile, ...(today.bench.tradeCard ? [today.bench.tradeCard] : []), ...today.bench.leverageCards];
  if (placed.slice().sort().join() !== run.deck.slice().sort().join()) report(run, where, `cards: deck ${run.deck.length}, placed ${placed.length}`);
  if (run.heat < 0) report(run, where, 'heat below 0');
}
function checkSave(run, where) {
  const copy = game.loadRun(game.serialiseRun(run));
  if (!copy) { report(run, where, 'save not loaded'); return; }
  const before = game.totalEquity(run), after = game.totalEquity(copy);
  if (Math.abs(before - after) > 1e-6 * Math.max(1, Math.abs(before))) report(run, where, `save changed equity ${before} → ${after}`);
}

// One random action during the day.
function randomAction(run, random) {
  const today = run.today, roll = random();
  if (roll < 0.08 && today.trades.length) { game.closeTrade(run, Math.floor(random() * today.trades.length)); return; }
  if (roll < 0.11) { game.redrawCards(run, run.hand.map((cardId, index) => index).filter(() => random() < 0.5)); return; }
  if (today.bench.tradeCard && random() < 0.5) { game.openBenchTrade(run, 0.05 + random() * 0.95); return; }
  const handIndex = Math.floor(random() * run.hand.length), cardId = run.hand[handIndex];
  if (!cardId || game.cardBlockedReason(run, cardId)) return;
  const card = game.PLAYER_CARDS[cardId];
  if (game.isTradeCard(cardId)) { run.hand.splice(handIndex, 1); today.bench.tradeCard = cardId; }
  else if (card.family === 'leverage') { run.hand.splice(handIndex, 1); today.bench.leverageCards.push(cardId); }
  else if (card.target === 'trade') game.playTradeCard(run, handIndex, Math.floor(random() * today.trades.length));
  else game.playMarketCard(run, handIndex);
}
function randomShop(run, random) {
  game.openShop(run);
  for (let step = 0; step < 6; step++) {
    const roll = random();
    if (roll < 0.3) game.spinReels(run);
    else if (roll < 0.8) game.buyReelCard(run, Math.floor(random() * 4));
    else game.sellCard(run, run.deck[Math.floor(random() * run.deck.length)]);
  }
}

let totalDays = 0, longest = 0, peak = 0, trades = 0, liquidations = 0;
const started = Date.now();
for (let runNumber = 0; runNumber < RUNS; runNumber++) {
  const random = seededRandom(1000 + runNumber);
  const run = game.newRun(500 + runNumber);
  for (let day = 0; day < DAYS_PER_RUN && !run.gameOverReason; day++) {
    for (let step = 0; step < 4; step++) { randomAction(run, random); checkInvariants(run, 'preopen'); }
    if (run.today.bench.tradeCard) game.openBenchTrade(run, 0.5);
    game.openTheMarket(run);
    while (run.phase === 'trading') {
      if (random() < 0.08) { randomAction(run, random); checkInvariants(run, 'action'); }
      if (run.today.bench.tradeCard) game.openBenchTrade(run, 0.5);
      const outcome = game.advanceTick(run);
      liquidations += outcome.liquidated;
      checkInvariants(run, 'tick');
      if (run.today.tick === 45) checkSave(run, 'mid-day');
      if (outcome.closed) { trades += run.today.closedTrades.length; game.closeDay(run); }
    }
    if (run.today.trades.length) report(run, 'close', 'trades left open after the close');
    peak = Math.max(peak, run.peakEquity);
    totalDays++;
    if (run.gameOverReason) break;
    randomShop(run, random);
    game.startNextDay(run);
    checkInvariants(run, 'new day');
  }
  longest = Math.max(longest, run.day);
}
console.log(`${RUNS} runs, ${totalDays} days, ${trades} trades, ${liquidations} liquidations, longest ${longest} days, peak $${peak.toExponential(2)}, ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(problemCount ? `${problemCount} problems` : 'no problems');
