card-names.json contains 4,638 unique English card names derived from the existing public TCGdex /v2/en/cards endpoint (23,912 cards), retrieved 2026-11-16.
Source https://github.com/tcgdex/cards-database, MIT © 2021 TCGdex. License in TCGdex-LICENSE.txt.
The scanner loads this compact index only when reading a card. It supplies spelling suggestions, never card ownership or automatic printing confirmation. Full card identity and current pricing still use the existing lookup paths. The snapshot can be regenerated from the public endpoint when new names are introduced.
