# Insider

A trading roguelike. The stock price is a deck of cards: every second one card is drawn (up +1%, UP +5%, bull +10%, BULL +50%, the same downwards, and vol cards that scale every later move). The deck is fair. Your edge comes from insider tips (they raise SEC heat), from rigging the deck in the shop, and from the shorting, leverage and options you unlock. Prices inflate 1% a day, investors want a target every 10 days, and the run ends when you have no money left to trade.

Open `index.html` in a browser, or install the Mac app with `app/install_app.sh`.

| Key | |
|---|---|
| T | trade menu (1–9 choose, ← → amount, Enter confirm, Esc back) |
| X | close everything |
| Space | open the market / pause |
| F, K | speed, skip to the close |
| D, Esc | deck, menu |

Shop and deck picker: arrows move by position, Enter takes the selected card, Space starts the next day.

- `DESIGN.md`: every system and the setting that tunes it.
- `tools/sim.cjs`: headless checks (`fairness`, `bots [runs] [days]`).
- `tools/fingerprint.cjs`: a hash of scripted play over fixed seeds; unchanged hash = unchanged game (use around cleanups).
- `tools/fuzz.cjs`: a random player over many days, checking that money, positions, decks and saves stay valid.
