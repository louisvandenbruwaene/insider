# Insider

A trading roguelike. The stock price is a deck of cards: every second one card is drawn (up +1%, UP +5%, bull +10%, BULL +50%, the same downwards, and vol cards that scale every later move). The deck is fair. Your edge comes from insider tips (they raise SEC heat), from news cards your network offers and the stories you plant or bury, and from the shorting, leverage and options you unlock. Prices inflate 1% a day, investors want a target every 10 days, and the run ends when you have no money left to trade.

Open `index.html` in a browser, or install the Mac app with `app/install_app.sh`.

The game is played with the mouse only.

- `DESIGN.md`: every system and the setting that tunes it.
- `tools/sim.cjs`: headless checks (`fairness`, `bots [runs] [days]`).
- `tools/fingerprint.cjs`: a hash of scripted play over fixed seeds; unchanged hash = unchanged game (use around cleanups).
- `tools/fuzz.cjs`: a random player over many days, checking that money, positions, decks and saves stay valid.
