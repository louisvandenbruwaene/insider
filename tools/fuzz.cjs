// Usage: node tools/fuzz.cjs index.html [runs]
// A random player: random trades of every kind (long, short, add, partial close), tips, stock switches, shop buys
// (desk strategies included) and deck edits, over many days. After every action and tick it checks that money, positions and decks stay valid, and
// that saving and loading keeps the same equity. Prints every problem it finds (at most 15).
const fs = require('fs');

function loadGame(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const code = html.split('<script id="game">')[1].split('</script>')[0];
  return new Function(code + `;return { newRun, advanceTick, closeDay, startNextDay, tradeStock, buyOption, writeOption,
    closeOption, closeStockPart, closeEverything, useTip, totalEquity, currentPrice, shopCatalogue, buyShopItem,
    pickOfferedCard, switchTicker, strikeOffsets, openTheMarket, deckSize, serialiseRun, loadRun, CARD_ORDER, TIP_ORDER };`)();
}
const game = loadGame(process.argv[2]);
const RUNS = Number(process.argv[3]) || 40;
const DAYS_PER_RUN = 60;

// A small seeded random generator, so every fuzz run is repeatable.
function seededRandom(seed) {
  let state = seed;
  return () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
}
const pickFrom = (list, random) => list[Math.floor(random() * list.length)];

let problemCount = 0;
function report(run, where, problem) {
  if (problemCount++ < 15) console.log('PROBLEM day', run.day, 'tick', run.today && run.today.tick, where, problem);
}
function checkInvariants(run, where) {
  const today = run.today;
  if (!Number.isFinite(run.cash)) report(run, where, 'cash ' + run.cash);
  if (!Number.isFinite(game.totalEquity(run))) report(run, where, 'equity ' + game.totalEquity(run));
  if (!Number.isFinite(today.shares)) report(run, where, 'shares ' + today.shares);
  if (!(game.currentPrice(today) > 0)) report(run, where, 'price ' + game.currentPrice(today));
  for (const option of today.options)
    if (!(option.quantity > 0) || !Number.isFinite(option.premiumTotal) || !(option.expiryDay >= run.day)) report(run, where, 'option ' + JSON.stringify(option));
  for (const tickerId in run.decks)
    for (const cardId of game.CARD_ORDER) if (run.decks[tickerId][cardId] < 0) report(run, where, `negative count ${tickerId} ${cardId}`);
  if (run.heat < 0) report(run, where, 'heat below 0');
}

// One random trade.
function randomTrade(run, random) {
  const action = Math.floor(random() * 7), fraction = random(), price = game.currentPrice(run.today);
  const randomStrike = type => price * (1 + pickFrom(game.strikeOffsets(type), random));
  const randomType = () => (random() < 0.5 ? 'call' : 'put');
  const options = run.today.options;
  if (action === 0) game.tradeStock(run, random() < 0.5 ? 1 : -1, fraction);
  if (action === 1) { const type = randomType(); game.buyOption(run, type, randomStrike(type), fraction); }
  if (action === 2) { const type = randomType(); game.writeOption(run, type, randomStrike(type), fraction * 0.3); }
  if (action === 3 && options.length) game.closeOption(run, Math.floor(random() * options.length), random() < 0.5 ? 1 : fraction);
  if (action === 4) game.closeStockPart(run, random() < 0.5 ? 1 : fraction);
  if (action === 5 && options.length) {                     // add more of an open option
    const option = options[0], addMore = option.direction === 'long' ? game.buyOption : game.writeOption;
    addMore(run, option.type, option.strikePrice, fraction * 0.3, option.expiryDay);
  }
  if (action === 6 && random() < 0.2) game.closeEverything(run);
  return action;
}

// A few random purchases; adding or removing a card picks a random offered card (or skips).
function randomShopping(run, random) {
  for (let purchase = 0; purchase < 4; purchase++) {
    const shopItem = pickFrom(game.shopCatalogue(run), random);
    if (!game.buyShopItem(run, shopItem) || !run.cardOffer) continue;
    game.pickOfferedCard(run, random() < 0.8 ? pickFrom(run.cardOffer.cards, random) : null);
  }
  for (const tickerId in run.decks) if (game.deckSize(run.decks[tickerId]) < 150) report(run, 'shop', 'deck below the minimum ' + tickerId);
}

let daysPlayed = 0, highestEquity = 0;
for (let seed = 1; seed <= RUNS; seed++) {
  const random = seededRandom(seed * 7919), run = game.newRun(seed);
  run.cash *= 1 + random() * 20;
  for (let dayNumber = 0; dayNumber < DAYS_PER_RUN && !run.gameOverReason; dayNumber++) {
    for (const tipId of game.TIP_ORDER) if (random() < 0.3) game.useTip(run, tipId);
    if (random() < 0.1 && run.tickersOwned.length > 1) game.switchTicker(run, pickFrom(run.tickersOwned, random));
    game.openTheMarket(run);
    while (run.phase === 'trading') {
      if (random() < 0.08) checkInvariants(run, 'after trade ' + randomTrade(run, random));
      const outcome = game.advanceTick(run);
      checkInvariants(run, 'tick');
      if (outcome.closed) game.closeDay(run);
    }
    daysPlayed++;
    highestEquity = Math.max(highestEquity, game.totalEquity(run));
    const reloaded = game.loadRun(game.serialiseRun(run));
    if (Math.abs(game.totalEquity(reloaded) - game.totalEquity(run)) > 1e-6 * Math.max(1, Math.abs(game.totalEquity(run))))
      report(run, 'save/load', `equity ${game.totalEquity(reloaded)} vs ${game.totalEquity(run)}`);
    if (run.gameOverReason) break;
    run.phase = 'shop';
    randomShopping(run, random);
    game.startNextDay(run);
    checkInvariants(run, 'next day');
  }
}
console.log('runs', RUNS, 'days', daysPlayed, 'problems', problemCount, 'highest equity', highestEquity.toExponential(2));
