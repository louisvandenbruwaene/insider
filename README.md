# Insider

A trading roguelike. The stock price is a deck of cards: every quarter second one card is drawn. Move cards move the price (±1%, ±5%, ±10%, ±50%, × σ), vol cards change σ, repeat / reverse / double / halve act on the moves around them, and rule cards change the rest of the day (+1% all day, ×2 all day, no buying, no selling, draw 3). The deck starts fair; your edge comes from insider tips (they raise SEC heat), the cards you add and remove (offered by chance), and the leverage and options you unlock. Prices inflate 1% a day, investors want a target every 10 days, and the run ends when you have no money left to trade.

Open `index.html` in a browser, or install the Mac app with `app/install_app.sh`.

The game is played with the mouse only.

- `DESIGN.md`: every system and the setting that tunes it.
- `tools/sim.cjs`: headless checks (`fairness`, `bots [runs] [days]`).
- `tools/fingerprint.cjs`: a hash of scripted play over fixed seeds; unchanged hash = unchanged game (use around cleanups).
- `tools/fuzz.cjs`: a random player over many days, checking that money, positions, decks and saves stay valid.
