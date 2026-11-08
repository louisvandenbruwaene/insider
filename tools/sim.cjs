// Headless checks for Insider (loads the game script; § 13 START does not run without a browser).
//   node tools/sim.cjs fairness      are the market maker's same-day option prices fair? (price at the open vs real payoff)
//   node tools/sim.cjs bots [runs]   full runs by simple players:
//     cash      never trades
//     coin      plays a random BUY or SELL STOCK card at the open, with every leverage card first, held to the close
//     hype      the edge play: every leverage card, a BUY STOCK, then Hype (or a SELL STOCK, then Bash); at the top of the
//               push it plays a card the other way to close, if it holds one; buys leverage and manipulation in the shop
//               once its cash is above the next meeting's target
const fs = require('fs'), path = require('path');

function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `;return { newRun, advanceTick, closeDay, startNextDay, openTheMarket, openShop, buyReelCard, spinReels,
    cardBlockedReason, playCard, redrawHand, totalEquity, currentPrice, averagePayoff, cardPrice, leverageOf, nextMeeting, PLAYER_CARDS, HYPE_TICKS };`)();
}
const game = loadGame();

function fairness(days = 400) {
  const run = game.newRun(12345);
  let priced = 0, paid = 0;
  for (let day = 0; day < days; day++) {
    const openPrice = game.currentPrice(run.today);
    priced += game.averagePayoff(run.today.closeForecast, 'call', openPrice) / openPrice;
    game.openTheMarket(run);
    while (run.phase === 'trading') if (game.advanceTick(run).closed) game.closeDay(run);
    paid += Math.max(0, run.lastResult.closePrice - openPrice) / openPrice;
    run.gameOverReason = null;
    game.startNextDay(run);
  }
  console.log(`same-day at-the-money call over ${days} days: priced ${(100 * priced / days).toFixed(2)}% of S, paid ${(100 * paid / days).toFixed(2)}% of S`);
}

// Play the first card in the hand that passes the test (and can be played). Returns whether one was played.
function playFirst(run, test) {
  const index = run.hand.findIndex(cardId => test(game.PLAYER_CARDS[cardId]) && !game.cardBlockedReason(run, cardId));
  if (index < 0) return false;
  return !game.playCard(run, index).error;
}
const LEVERAGE_ORDER = { add: 0, times: 1, power: 2 };
// Leverage cards in the best order (add, multiply, power), but only while the next trade stays at most BOT_LEVERAGE×:
// far above that a stock trade is liquidated by ordinary noise within a few ticks.
const BOT_LEVERAGE = 4;
function playAllLeverage(run) {
  for (const operation of Object.keys(LEVERAGE_ORDER))
    while (playFirst(run, card => card.operation === operation && game.leverageOf(run, run.today.pendingLeverage.concat(cardIdOf(card))) <= BOT_LEVERAGE));
}
function cardIdOf(card) { return Object.keys(game.PLAYER_CARDS).find(cardId => game.PLAYER_CARDS[cardId] === card); }
function holds(run, test) { return run.hand.some(cardId => test(game.PLAYER_CARDS[cardId])); }
function playDay(run, morning, everyTick) {
  morning(run);
  game.openTheMarket(run);
  while (run.phase === 'trading') {
    if (everyTick) everyTick(run);
    if (game.advanceTick(run).closed) game.closeDay(run);
  }
}

const BOTS = {
  cash: { morning() {} },
  coin: {
    morning(run) {
      const side = Math.random() < 0.5 ? 'BUY STOCK' : 'SELL STOCK';
      if (!holds(run, card => card.name === side)) return;
      playAllLeverage(run);
      playFirst(run, card => card.name === side);
    },
  },
  hype: {
    morning(run) {
      run.today.closeAtTick = null;
      for (let redraw = 0; redraw < 2 && !holds(run, card => card.name === 'HYPE' || card.name === 'BASH'); redraw++) game.redrawHand(run);
      for (const [manipulation, opening, closing] of [['HYPE', 'BUY STOCK', 'SELL STOCK'], ['BASH', 'SELL STOCK', 'BUY STOCK']]) {
        if (!holds(run, card => card.name === manipulation) || !holds(run, card => card.name === opening)) continue;
        playAllLeverage(run);
        if (!playFirst(run, card => card.name === opening)) continue;
        playFirst(run, card => card.name === manipulation);
        run.today.closeAtTick = game.HYPE_TICKS;
        run.today.closingCard = closing;
        return;
      }
    },
    everyTick(run) { if (run.today.tick === run.today.closeAtTick) playFirst(run, card => card.name === run.today.closingCard); },
    shop(run) {
      game.openShop(run);
      if (run.cash < game.nextMeeting(run, run.day + 1).target) return;      // only shops with money to spare
      for (let spin = 0; spin < 3; spin++) {
        run.shop.reels.forEach((cardId, reelIndex) => {
          const card = game.PLAYER_CARDS[cardId];
          const wanted = card.family === 'leverage' || card.name === 'HYPE' || card.name === 'BASH' || card.kind === 'stock';
          if (wanted && run.cash > 4 * game.cardPrice(run, cardId)) game.buyReelCard(run, reelIndex);
        });
        if (run.cash < 200 || !game.spinReels(run)) break;
      }
    },
  },
};

function bots(runs = 30, maximumDays = 60) {
  for (const [botName, bot] of Object.entries(BOTS)) {
    const days = [], peaks = [], meetings = [], endings = {};
    for (let runNumber = 0; runNumber < runs; runNumber++) {
      const run = game.newRun(7000 + runNumber);
      while (!run.gameOverReason && run.day < maximumDays) {
        playDay(run, bot.morning, bot.everyTick);
        if (run.gameOverReason) break;
        if (bot.shop) bot.shop(run);
        game.startNextDay(run);
      }
      days.push(run.day); peaks.push(run.peakEquity); meetings.push(run.meetingsPassed);
      const ending = run.gameOverReason || 'alive';
      endings[ending] = (endings[ending] || 0) + 1;
    }
    const median = list => list.slice().sort((first, second) => first - second)[Math.floor(list.length / 2)];
    console.log(`${botName.padEnd(5)} days median ${median(days)}, best ${Math.max(...days)} · meetings median ${median(meetings)}, best ${Math.max(...meetings)} · peak median $${Math.round(median(peaks))}, best $${Math.max(...peaks).toExponential(2)} · ends ${JSON.stringify(endings)}`);
  }
}

const [command, argument] = process.argv.slice(2);
if (command === 'fairness') fairness();
else if (command === 'bots') bots(Number(argument) || 30);
else console.log('usage: node tools/sim.cjs fairness | bots [runs]');
