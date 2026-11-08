# Insider

A roguelike deckbuilder about day trading. The price is a deck of cards: every quarter second one card moves it. You hold your own deck: trade cards (long or short stock, calls and puts), leverage cards stacked on a trade in order (+n, ×n, (L + 1)ⁿ), specials (double, top-up, dividends, ceiling, floor) and manipulation (hype, bash, turmoil, calm). Every trade closes at the close. The shop is four slot-machine reels. Heat brings the SEC, and every 10 days a boss-day meeting wants a target.

Open `index.html` in a browser, or install the Mac app with `app/install_app.sh`. The game is played with the mouse only.

- `DESIGN.md`: every system and the setting that tunes it.
- `tools/sim.cjs`: headless checks (`fairness`, `bots [runs]`).
- `tools/fingerprint.cjs`: a hash of scripted play over fixed seeds; unchanged hash = unchanged game (use around cleanups).
- `tools/fuzz.cjs`: a random player over many days, checking that money, trades, card piles and saves stay valid.
