// Headless checks for Insider: loads the game script (§1-§7 run without a browser) and
//   node tools/sim.cjs equivalence — the fast forecast simulator gives exactly what tickMarket (the real day) gives
//   node tools/sim.cjs fairness   — are the market maker's option prices fair? (fair value vs the real average payoff)
//   node tools/sim.cjs bots [runs] — full runs by simple players: cash holder, coin flipper, rumour trader, rumour + options
const fs = require('fs'), path = require('path');

// The script is run as a plain function (not node's vm, whose sandboxed globals make the simulator ~15× slower).
// Outside a browser there is no document, so § 13 START does not run.
function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `
    ;return { newRun, prepareDay, advanceTick, closeDay, startNextDay, tradeStock, closeStock, buyOption, useTip,
      quoteOption, simulateCloses, tickMarket, makeRandom, deckToPile, buildDeck, shopCatalogue, buyShopItem, applyDeckEdit,
      totalEquity, currentPrice, tipStatus, meetingTarget,
      TICKS_PER_DAY, STRIKE_OFFSETS, SIZE_STEPS, MEETING_EVERY_DAYS, MEETING_MULTIPLES };`)();
}
const game = loadGame();

// The slow reference: the real tickMarket with the same random draws as the fast simulator.
function referenceCloses(market, pile, ticksLeft, paths, random) {
  const pool = pile.slice(), closes = [];
  for (let path = 0; path < paths; path++) {
    const state = { ...market };
    let drawn = 0;
    const drawCard = () => {
      if (drawn >= pool.length) return null;
      const pick = drawn + Math.floor(random() * (pool.length - drawn));
      const cardId = pool[pick]; pool[pick] = pool[drawn]; pool[drawn] = cardId; drawn++;
      return cardId;
    };
    for (let tick = 0; tick < ticksLeft; tick++) game.tickMarket(state, drawCard);
    closes.push(state.price);
  }
  return closes.sort((a, b) => a - b);
}
function equivalence() {
  // a deck with every event card, small enough to run dry during some paths
  const deck = { ...game.buildDeck({ small: 20, medium: 20, large: 6, huge: 2 }, { small: 20, medium: 20, large: 6, huge: 2 }), earnings: 6, fed: 4, halt: 3, momentum: 5, squeeze: 3 };
  const pile = game.deckToPile(deck);
  for (const [ticksLeft, market] of [[90, { price: 100, sigma: 1, fedTicksLeft: 0, lastPriceMove: 0 }], [150, { price: 37, sigma: 1.7, fedTicksLeft: 5, lastPriceMove: -0.05 }]]) {
    const fast = Array.from(game.simulateCloses(market, pile, ticksLeft, 300, game.makeRandom(9)));
    const slow = referenceCloses(market, pile, ticksLeft, 300, game.makeRandom(9));
    const worst = Math.max(...fast.map((close, index) => Math.abs(close / slow[index] - 1)));
    console.log(`${ticksLeft} ticks: largest relative difference ${worst.toExponential(1)} ${worst < 1e-9 ? 'OK' : 'MISMATCH'}`);
    if (worst >= 1e-9) process.exitCode = 1;
  }
}

function fairness(days = 400) {
  const run = game.newRun(12345);
  let premiums = 0, payoffs = 0, closeReturns = 0;
  for (let day = 0; day < days; day++) {
    const today = run.today, open = game.currentPrice(today);
    const quote = game.quoteOption(today.forecast, 'call', open);
    const close = today.schedule.states[game.TICKS_PER_DAY].price;
    premiums += quote.fairValue / open;
    payoffs += Math.max(0, close - open) / open;
    closeReturns += close / open - 1;
    run.day++; game.prepareDay(run);
  }
  console.log(`ATM call: fair ${(premiums / days * 100).toFixed(2)}% of the open, real average payoff ${(payoffs / days * 100).toFixed(2)}%`);
  console.log(`average day return ${(closeReturns / days * 100).toFixed(2)}%`);
}

// A day for a bot: decide before the open, then play every tick.
function playDay(run, strategy) {
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
    beforeOpen(run) { run.controls.stockSize = 3; game.tradeStock(run, Math.random() < 0.5 ? 1 : -1); },
    shop(run) { buyFirstAffordable(run, ['unlock:short']); },
  },
  rumour: {
    beforeOpen(run) {
      run.controls.stockSize = 3;
      if (game.tipStatus(run, 'rumour') === 'ready' && run.heat < 85) game.useTip(run, 'rumour');
      const rumour = run.today.insights.rumour;
      if (rumour) game.tradeStock(run, rumour.direction === 'up' ? 1 : -1);
    },
    shop(run) { buyFirstAffordable(run, ['unlock:short', 'leverage']) || rigDeck(run); },
  },
  options: {
    beforeOpen(run) {
      for (const tipId of ['exactClose', 'analyst', 'rumour'])
        if (game.tipStatus(run, tipId) === 'ready' && run.heat + 20 < 100) game.useTip(run, tipId);
      const insights = run.today.insights, open = game.currentPrice(run.today);
      let direction = 0;
      if (insights.exactClose) direction = insights.exactClose.close > open * 1.02 ? 1 : insights.exactClose.close < open * 0.98 ? -1 : 0;
      else if (insights.analyst) direction = insights.analyst.low > open ? 1 : insights.analyst.high < open ? -1 : 0;
      else if (insights.rumour) direction = insights.rumour.direction === 'up' ? 1 : -1;
      if (!direction) return;
      const kind = direction > 0 ? 'call' : 'put';
      if (run.unlocked[kind]) {
        run.controls.optionKind = kind; run.controls.optionSize = insights.rumour && !insights.analyst && !insights.exactClose ? 1 : 3;
        run.controls.strikeStep = game.STRIKE_OFFSETS.indexOf(0);
        game.buyOption(run);
      }
      run.controls.stockSize = 3;
      if (run.unlocked.short || direction > 0) game.tradeStock(run, direction);
    },
    shop(run) {
      buyFirstAffordable(run, ['unlock:call', 'unlock:put', 'unlock:short', 'tip:analyst', 'leverage', 'tip:exactClose']) || rigDeck(run);
    },
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
