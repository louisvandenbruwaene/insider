// Headless checks for Insider (loads the game script; § 13 START does not run without a browser).
//   node tools/sim.cjs fairness      are the market maker's same-day option prices fair? (price at the open vs real payoff)
//   node tools/sim.cjs bots [runs]   full runs by simple players:
//     cash      never trades
//     coin      one long or short stock trade a day at the open, all its leverage cards, half the cash, held to the close
//     hype      the edge play: a long under Hype (a short under Bash) with every leverage card, closed at the top;
//               buys leverage and manipulation cards in the shop
const fs = require('fs'), path = require('path');

function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `;return { newRun, advanceTick, closeDay, startNextDay, openTheMarket, openShop, buyReelCard, spinReels,
    cardBlockedReason, playMarketCard, redrawHand, openBenchTrade, closeTrade, closeAllTrades, totalEquity, currentPrice, averagePayoff, cardPrice,
    PLAYER_CARDS, TICKS_PER_DAY, HYPE_TICKS };`)();
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

// Take cards out of the hand and onto the bench: the trade card, then add, multiply, power (the best order).
const LEVERAGE_ORDER = { add: 0, times: 1, power: 2 };
function buildTrade(run, tradeCardId) {
  const today = run.today;
  run.hand.splice(run.hand.indexOf(tradeCardId), 1);
  today.bench.tradeCard = tradeCardId;
  if (today.investigation) return;
  const leverageCards = run.hand.filter(cardId => game.PLAYER_CARDS[cardId].family === 'leverage')
    .sort((first, second) => LEVERAGE_ORDER[game.PLAYER_CARDS[first].operation] - LEVERAGE_ORDER[game.PLAYER_CARDS[second].operation]);
  for (const cardId of leverageCards) { run.hand.splice(run.hand.indexOf(cardId), 1); today.bench.leverageCards.push(cardId); }
}
function playableCard(run, test) { return run.hand.find(cardId => test(game.PLAYER_CARDS[cardId]) && !game.cardBlockedReason(run, cardId)); }
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
      const side = Math.random() < 0.5 ? 'long' : 'short';
      const tradeCard = playableCard(run, card => card.kind === 'stock' && card.family === side);
      if (!tradeCard) return;
      buildTrade(run, tradeCard);
      game.openBenchTrade(run, 0.5);
    },
  },
  hype: {
    morning(run) {
      run.today.closeAtTick = null;
      // spin the hand while it holds no Hype or Bash
      for (let redraw = 0; redraw < 2; redraw++)
        if (!run.hand.some(cardId => ['HYPE', 'BASH'].includes(game.PLAYER_CARDS[cardId].name))) game.redrawHand(run);
      for (const [manipulation, side] of [['HYPE', 'long'], ['BASH', 'short']]) {
        const manipulationCard = playableCard(run, card => card.name === manipulation);
        const tradeCard = playableCard(run, card => card.kind === 'stock' && card.family === side);
        if (!manipulationCard || !tradeCard) continue;
        buildTrade(run, tradeCard);
        if (typeof game.openBenchTrade(run, 0.9) === 'string') continue;
        game.playMarketCard(run, run.hand.indexOf(manipulationCard));
        run.today.closeAtTick = game.HYPE_TICKS;
        return;
      }
    },
    everyTick(run) { if (run.today.tick === run.today.closeAtTick) game.closeAllTrades(run); },
    shop(run) {
      game.openShop(run);
      for (let spin = 0; spin < 3; spin++) {
        run.shop.reels.forEach((cardId, reelIndex) => {
          const card = game.PLAYER_CARDS[cardId];
          const wanted = card.family === 'leverage' || card.name === 'HYPE' || card.name === 'BASH' || card.effect === 'floor';
          if (wanted && run.cash > 4 * game.cardPrice(run, cardId)) game.buyReelCard(run, reelIndex);
        });
        if (run.cash < 200 || !game.spinReels(run)) break;
      }
    },
  },
};

function bots(runs = 30, maximumDays = 60) {
  for (const [botName, bot] of Object.entries(BOTS)) {
    const days = [], peaks = [], meetings = [];
    for (let runNumber = 0; runNumber < runs; runNumber++) {
      const run = game.newRun(7000 + runNumber);
      while (!run.gameOverReason && run.day < maximumDays) {
        playDay(run, bot.morning, bot.everyTick);
        if (run.gameOverReason) break;
        if (bot.shop) bot.shop(run);
        game.startNextDay(run);
      }
      days.push(run.day); peaks.push(run.peakEquity); meetings.push(run.meetingsPassed);
    }
    const median = list => list.slice().sort((first, second) => first - second)[Math.floor(list.length / 2)];
    console.log(`${botName.padEnd(5)} days median ${median(days)}, best ${Math.max(...days)} · meetings median ${median(meetings)}, best ${Math.max(...meetings)} · peak median $${Math.round(median(peaks))}, best $${Math.max(...peaks).toExponential(2)}`);
  }
}

const [command, argument] = process.argv.slice(2);
if (command === 'fairness') fairness();
else if (command === 'bots') bots(Number(argument) || 30);
else console.log('usage: node tools/sim.cjs fairness | bots [runs]');
