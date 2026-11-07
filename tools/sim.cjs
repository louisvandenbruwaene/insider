// Headless checks for Insider: loads the game script (§1-§7 run without a browser) and
//   node tools/sim.cjs equivalence — the fast forecast simulator gives exactly what tickMarket (the real day) gives
//   node tools/sim.cjs fairness   — are the market maker's 7-day option prices fair? (fair value vs the real average payoff)
//   node tools/sim.cjs bots [runs] — full runs by simple players: cash holder, coin flipper, rumour trader (each closes everything before the open)
const fs = require('fs'), path = require('path');

// The script is run as a plain function (not node's vm, whose sandboxed globals make the simulator ~15× slower).
// Outside a browser there is no document, so § 13 START does not run.
function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `
    ;return { newRun, prepareDay, advanceTick, closeDay, startNextDay, tradeStock, closeStock, buyOption, writeOption, useTip,
      quoteOption, simulateForecast, nextOpenPrice, tickMarket, closeEverything, makeRandom, deckToPile, buildDeck, shopCatalogue, buyShopItem, applyDeckEdit,
      totalEquity, currentPrice, tipStatus, meetingTarget,
      TICKS_PER_DAY, OPTION_EXPIRY_DAYS, MEETING_EVERY_DAYS, MEETING_MULTIPLES };`)();
}
const game = loadGame();

// The slow reference: the real tickMarket over the same days, dealing from the same shoe (and a fresh deck when it
// runs out) with the same random draws as the fast simulator.
function referenceForecast(market, shoe, deck, ticksLeftToday, daysAhead, paths, random) {
  const shoePool = shoe.slice(), deckPool = game.deckToPile(deck);
  const closesByDay = Array.from({ length: daysAhead + 1 }, () => []);
  for (let path = 0; path < paths; path++) {
    const state = { ...market };
    let pool = shoePool, drawn = 0;
    const drawCard = () => {
      if (drawn >= pool.length) { pool = deckPool; drawn = 0; }
      const pick = drawn + Math.floor(random() * (pool.length - drawn));
      const cardId = pool[pick]; pool[pick] = pool[drawn]; pool[drawn] = cardId; drawn++;
      return cardId;
    };
    for (let day = 0; day <= daysAhead; day++) {
      if (day > 0) Object.assign(state, { price: game.nextOpenPrice(state.price), sigma: 1, fedTicksLeft: 0, lastPriceMove: 0 });
      for (let tick = 0; tick < (day === 0 ? ticksLeftToday : game.TICKS_PER_DAY); tick++) game.tickMarket(state, drawCard);
      closesByDay[day].push(state.price);
    }
  }
  return closesByDay;
}
function equivalence() {
  // a deck with every event card; a short shoe so paths run into fresh shuffles
  const deck = { ...game.buildDeck({ small: 20, medium: 20, large: 6, huge: 2 }, { small: 20, medium: 20, large: 6, huge: 2 }), earnings: 6, fed: 4, halt: 3, momentum: 5, squeeze: 3 };
  const shoe = game.deckToPile(deck).slice(0, 60);
  for (const [ticksLeft, market] of [[90, { price: 100, sigma: 1, fedTicksLeft: 0, lastPriceMove: 0 }], [17, { price: 37, sigma: 1.7, fedTicksLeft: 5, lastPriceMove: -0.05 }]]) {
    const fast = game.simulateForecast(market, shoe, deck, ticksLeft, 3, 200, game.makeRandom(9));
    const slow = referenceForecast(market, shoe, deck, ticksLeft, 3, 200, game.makeRandom(9));
    let worst = 0;
    fast.forEach((closes, day) => closes.forEach((close, path) => { worst = Math.max(worst, Math.abs(close / slow[day][path] - 1)); }));
    console.log(`${ticksLeft} ticks + 3 days: largest relative difference ${worst.toExponential(1)} ${worst < 1e-9 ? 'OK' : 'MISMATCH'}`);
    if (worst >= 1e-9) process.exitCode = 1;
  }
}

// Weekly at-the-money calls: fair value at the open vs what they really paid 7 days later.
function fairness(days = 300) {
  const run = game.newRun(12345);
  let premiums = 0, payoffs = 0, count = 0;
  const opens = [];
  for (let day = 0; day < days + game.OPTION_EXPIRY_DAYS; day++) {
    const open = game.currentPrice(run.today);
    if (day < days) opens.push({ open, fair: game.quoteOption(run.today.forecast[game.OPTION_EXPIRY_DAYS], 'call', open).fairValue });
    run.phase = 'trading';
    while (run.phase === 'trading') { const outcome = game.advanceTick(run); if (outcome.closed) game.closeDay(run); }
    const settled = day - game.OPTION_EXPIRY_DAYS;
    if (settled >= 0) {
      const { open: strike, fair } = opens[settled];
      premiums += fair / strike; payoffs += Math.max(0, game.currentPrice(run.today) - strike) / strike; count++;
    }
    run.gameOverReason = null; game.startNextDay(run);
  }
  console.log(`7-day ATM call: fair ${(premiums / count * 100).toFixed(2)}% of the strike, real average payoff ${(payoffs / count * 100).toFixed(2)}% (${count} weeks)`);
}

// A day for a bot: decide before the open, then play every tick.
function playDay(run, strategy) {
  game.closeEverything(run);              // these bots only trade one day at a time
  strategy.beforeOpen(run);
  run.phase = 'trading';
  while (run.phase === 'trading') {
    const outcome = game.advanceTick(run);
    if (outcome.closed) game.closeDay(run);
  }
  if (run.gameOverReason) return false;
  strategy.shop(run);
  game.startNextDay(run);
  return true;
}

function buyFirstAffordable(run, ids) {
  for (const id of ids) {
    const item = game.shopCatalogue(run).find(entry => entry.id === id);
    if (item && !item.owned && run.cash > item.price * 3 && game.buyShopItem(run, item)) return true;
  }
  return false;
}
function rigDeck(run) {
  const item = game.shopCatalogue(run).find(entry => entry.id === 'remove');
  if (run.cash > item.price * 5 && run.heat < 60) game.applyDeckEdit(run, item, run.ticker, run.decks[run.ticker].BEAR > 0 ? 'BEAR' : run.decks[run.ticker].DOWN > 0 ? 'DOWN' : 'bear');
}

const STRATEGIES = {
  cash: { beforeOpen() {}, shop() {} },
  coin: {
    beforeOpen(run) { game.tradeStock(run, Math.random() < 0.5 ? 1 : -1, 1); },
    shop() {},
  },
  rumour: {
    beforeOpen(run) {
      if (game.tipStatus(run, 'rumour') === 'ready' && run.heat < 85) game.useTip(run, 'rumour');
      const rumour = run.today.insights.rumour;
      if (rumour) game.tradeStock(run, rumour.direction === 'up' ? 1 : -1, 1);
    },
    shop(run) { buyFirstAffordable(run, ['leverage']) || rigDeck(run); },
  },
};

function bots(runs = 40) {
  for (const [name, strategy] of Object.entries(STRATEGIES)) {
    const daysSurvived = [], peaks = [];
    for (let index = 0; index < runs; index++) {
      const run = game.newRun(1000 + index);
      while (run.day < (Number(process.argv[4]) || 400) && playDay(run, strategy)) { /* keep playing */ }
      if (!Number.isFinite(run.cash)) throw new Error(name + ': cash became ' + run.cash);
      daysSurvived.push(run.day); peaks.push(run.peakEquity);
    }
    daysSurvived.sort((a, b) => a - b); peaks.sort((a, b) => a - b);
    const median = list => list[Math.floor(list.length / 2)];
    console.log(`${name.padEnd(8)} days: median ${median(daysSurvived)}, best ${daysSurvived.at(-1)} · peak equity: median ${median(peaks).toExponential(2)}, best ${peaks.at(-1).toExponential(2)}`);
  }
}

const [command = 'bots', argument] = process.argv.slice(2);
if (command === 'equivalence') equivalence();
else if (command === 'fairness') fairness(Number(argument) || 400);
else bots(Number(argument) || 40);
