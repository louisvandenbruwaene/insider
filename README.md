# Insider

A roguelike deckbuilder about day trading. You build two decks: the market (every quarter second one of its cards moves the price; each market type, stock, commodity or ETF, has its own cards) and your playbook (a hand of 5 plays each day: pick the next card, skip it, flip it, freeze the price, push it, hedge …). Options, leverage and new markets are bought in the shop; heat brings the SEC; every 10 days a boss-day meeting wants a target.

Open `index.html` in a browser, or install the Mac app with `app/install_app.sh`.

The game is played with the mouse only.

- `DESIGN.md`: every system and the setting that tunes it.
- `tools/sim.cjs`: headless checks (`fairness`, `bots [runs] [days]`).
- `tools/fingerprint.cjs`: a hash of scripted play over fixed seeds; unchanged hash = unchanged game (use around cleanups).
- `tools/fuzz.cjs`: a random player over many days, checking that money, positions, decks and saves stay valid.
