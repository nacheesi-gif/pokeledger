# PokéLedger — Pokémon Collection, Scan & Spending

A local-first, phone-friendly Pokémon collection organizer hosted by GitHub Pages.

## Main features

- **My Collection** only shows cards actually owned or being graded, with quantities and household owners.
- **Explore Sets** loads English Pokémon sets and reference artwork from TCGdex, with rarity filters and one-tap ownership.
- **Artist collections** for **Tomokazu Komiya** and **Shinji Kanda**, searched by illustrator credit via TCGdex. English database coverage varies.
- **Scan Cards** uses a webcam or uploaded image, Tesseract.js OCR on the device, and a TCGdex card-name/number lookup. Matches require manual confirmation. Auto mode repeats scans with an on-device OCR worker, not visual-art recognition. Real device performance and accuracy must be tested.
- **Raw market snapshots** show TCGplayer market pricing from TCGdex when available, not individual confirmed completed-sales transactions.
- **Source verification links** open TCGplayer search, eBay sold searches (raw/PSA 9/PSA 10), and PriceCharting. Graded prices are not automatically quoted without verified data.
- **Custom collection binders** let one owned card appear in multiple overlapping user-created organizational collections. No duplication of ownership or purchase cost.
- **Rename family profiles** while preserving earlier purchases and card ownership.
- **Financial ledger** tracks purchases, sales, fees, LastPack cashouts, and family-vs-resale budgets without double-counting transfers.
- **Backup/restore** exports and imports local JSON. Cloud sync remains optional.

## Run and test

Live site: https://nacheesi-gif.github.io/pokeledger/

To test on desktop:

1. Open PokéLedger on HTTPS in Chrome, Edge, or Safari.
2. Select **Scan** and **Start camera**. Grant browser camera permission.
3. Place one English Pokémon card within the guide frame; press **Read card** (or enable **Auto**).
4. Review the matching card image, set/number, and raw market preview, and open **Value / sources** to verify.
5. Choose a family member and a custom collection (created under My Collection), then press **Add owned**.
6. Confirm the card in **My Collection** and export a **JSON backup** in Settings.
7. Alternatively select **upload a card photo** if a webcam is unavailable.

### Important limitations

The scanning stage is an OCR-based prototype. It can misread collector numbers, reverse holo vs regular variants, Japanese text, stamps, and visually similar printings. Confirm every match before committing. Tesseract.js loads from an external CDN during the first scan; network required for initial OCR and card search. After first load the worker is reused. Actual phone-camera recognition and speed remain to be tested.

Raw pricing may be missing or delayed. eBay sold pages may require sign-in; links are for independent verification, not an automated completed-sales feed. Not all cards have available PSA 9/10 pricing. Never count an estimated market price or a cashout as realized profit.

The repository/source and website are public. **Your personal collection and financial records are saved in the current browser's localStorage, not in the public GitHub repository.** They do not automatically sync across devices. Export JSON regularly and never commit a backup containing personal financial data to the public repo.

## Sources

- TCGdex API: https://tcgdex.dev/
- Tesseract.js OCR: https://github.com/naptha/tesseract.js
- Gen III box sprites: https://github.com/PokeAPI/sprites

## Binder, card zoom and market-value labels

- **My Binder** (previously **My Collection**) contains owned and grading cards. Ownership and purchases are unchanged by the rename.
- Clicking a card picture in My Binder, Explore Sets, or scanner results opens a large image with a market summary and source-detail action. Images use the high-resolution TCGdex rendition where available.
- Card-grid price chips load near the viewport from TCGdex TCGplayer raw-market pricing when provided. Multiple finish variants display **From $X** rather than claiming a specific finish; cards without a quote display **Value N/A**. Owned cards with manually saved prices show **saved** (not a live price).
- Confirm set, card number, condition, edition, and holo variant when checking sale comparisons.

## Slab Verify (beta)

- The separate **Slab Verify** tab reads English slab labels using an uploaded photo or a live camera and OCR. It suggests cert number, grader and grade for user confirmation. It supports official links for PSA, CGC Cards, Beckett BGS/BVG/BCCG, TAG, AGS, SGC and HGA; other graders can be entered manually.
- The app opens the original grading company's public verification site; available data and authentication services differ by grader, and automated registry access is **not** claimed.
- It provides eBay *completed/sold* searches and PriceCharting graded comparisons. A graded-market estimate is user entered, not invented or silently substituted from a raw quote.
- Slab verification statuses are **Not verified**, **Official cert record manually matched**, and **Discrepancy reported**. Green means the user checked the official cert details, **not** that the physical slab is guaranteed genuine, unaltered, or unflagged. Some physical authentication needs company-specific tools or an expert.
- Slab checks are saved in the same local JSON backup, separate from owned inventory, to avoid double-counting a slab that is already recorded as an owned card.
