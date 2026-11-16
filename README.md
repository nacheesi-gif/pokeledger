# PokéLedger — Gen III Eeveelutions

A mobile-friendly Pokémon collection, giveaway, family spending, and resale tracking app. Light theme, a Pokémon-logo-inspired wordmark, an unpixelated Poké Ball, and real **Generation III Ruby/Sapphire PC Box sprites**.

### Section icons

- Dashboard — Eevee (133)
- Collection — Vaporeon (134)
- Spending — Jolteon (135)
- Sales — Flareon (136)
- Settings — Umbreon (197)

Sprites are 32×32 static PNGs embedded in `index.html` for offline availability. Source: [PokéAPI sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-iii/icons). The sprite repository is publicly accessible, but the underlying Pokémon artwork belongs to its respective rights holders; public hosting does not imply a free asset license.

### Hosting on iPhone

This repo is deployed through **GitHub Pages** at https://nacheesi-gif.github.io/pokeledger/ after Pages is enabled under Settings → Pages → Deploy from branch → `main`, `/(root)`.

Records are saved **locally on each browser/device**, not in the GitHub repository. Export and safely store JSON backups regularly. No cloud sync is required.

## My Collection vs Explore Sets (November 2026)

- **My Collection** shows only cards explicitly marked Owned or Grading. The original 120 Trainer Gallery sample records remain available but are not counted as owned until marked.
- **Explore Sets** uses the public [TCGdex API](https://tcgdex.dev) to discover English expansions, Black Star Promos, all four Trainer Gallery subsets, Galarian Gallery, vintage sets, and others. Pick a set to browse its complete checklist and click **Add to My Collection** for an owned card. Choose the family profile before adding.
- Cards are sorted by rarity as card details load; rarity sorting is provisional until the metadata request finishes. Some public scans and rarity metadata are missing.
- All owned cards, quantities, family assignments and spending records stay in PokéLedger's existing local storage key and JSON backup. Set browsing doesn't upload or store private ownership details with TCGdex, and exploring doesn't add cards by itself.
- The public card API needs an internet connection when loading new sets. The app shell and some cached catalog metadata can be available offline.
- Market price tracking and camera scanning are separate future enhancements; the Explore Sets tab does not imply live pricing.
