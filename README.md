# Insider

A roguelike deckbuilder about day trading. The price is a deck of cards: every quarter second one card moves it. You play your own cards by dragging them up from the hand: BUY / SELL STOCK and options at fixed sizes (a card the other way closes your oldest trade), leverage for the next trade (+n, ×n, (L + 1)ⁿ), double, top-up, dividends, ceiling, floor, hype, bash, turmoil, calm. Every trade still open closes at the close. Redraws and the shop are slot machines. Heat brings the SEC, and every 10 days a boss-day meeting wants a target.

Open `index.html` in a browser, or install the Mac app with `app/install_app.sh`. The game is played with the mouse only.

- `DESIGN.md`: every system and the setting that tunes it.
- `tools/sim.cjs`: headless checks (`fairness`, `bots [runs]`).
- `tools/fingerprint.cjs`: a hash of scripted play over fixed seeds; unchanged hash = unchanged game (use around cleanups).
- `tools/fuzz.cjs`: a random player over many days, checking that money, trades, card piles and saves stay valid.
