// Usage: node tools/fingerprint.cjs index.html
// Plays a fixed script of trades over fixed seeds and prints a hash of every number that matters (cash, equity,
// heat, shares, open options). Run it before and after a cleanup: the same hash means the same game.
const fs = require('fs');
const crypto = require('crypto');

function loadGame(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `;return { newRun, advanceTick, closeDay, startNextDay, tradeStock, buyOption, writeOption,
    closeOption, closeStockPart, useTip, totalEquity, currentPrice, shopCatalogue, buyShopItem, pickOfferedCard, strikeOffsets };`)();
}
const game = loadGame(process.argv[2]);

// The same trades every day, at fixed ticks.
function tradeOnTick(run, tick, dayNumber) {
  const price = game.currentPrice(run.today);
  if (tick === 5) game.tradeStock(run, dayNumber % 2 ? 1 : -1, 0.3);
  if (tick === 20) game.buyOption(run, 'put', price * (1 + game.strikeOffsets('put')[dayNumber % 8]), 0.2);
  if (tick === 40) game.writeOption(run, 'call', price * 1.2, 0.1);
  if (tick === 60 && run.today.options.length) game.closeOption(run, 0, 0.5);
  if (tick === 75) game.closeStockPart(run, 0.5);
}

const lines = [];
for (let seed = 1; seed <= 6; seed++) {
  const run = game.newRun(seed);
  run.cash = 50000;
  for (const positionId in run.unlocked) run.unlocked[positionId] = true;
  run.leverageTier = 2;
  for (let dayNumber = 0; dayNumber < 12 && !run.gameOverReason; dayNumber++) {
    game.useTip(run, 'rumour');
    run.phase = 'trading';
    let tick = 0;
    while (run.phase === 'trading') {
      tradeOnTick(run, tick, dayNumber);
      const outcome = game.advanceTick(run);
      tick++;
      if (outcome.closed) game.closeDay(run);
    }
    lines.push([seed, run.day, run.cash.toFixed(6), game.totalEquity(run).toFixed(6), run.heat.toFixed(3),
      run.today.shares.toFixed(6), run.today.options.length].join(' '));
    if (run.gameOverReason) break;
    game.pickOfferedCard(run, run.cardReward[0], true);                   // always plant the first free tip
    game.startNextDay(run);
  }
}
console.log(crypto.createHash('sha1').update(lines.join('\n')).digest('hex'), lines.length, 'days');
