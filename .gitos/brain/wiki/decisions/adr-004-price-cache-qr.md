# ADR-004 · All-set TCGplayer cache and explicit QR reading
Accepted 2026-11-16.

TCGdex supplies card identities but can omit available TCGplayer prices. Use explicit TCGplayer product IDs from card metadata to join a daily public TCGCSV snapshot across all Pokemon groups. No fuzzy matching. Preserve exact finish, date, USD currency, unknown values and existing saved/accounting data. TCGCSV usage guidelines require a daily backend cache with custom User-Agent, timestamp gate and paced requests. The scheduled GitHub Action downloads price data only, with contents/pages write limited to its refresh job, and explicitly requests a Pages rebuild after a bot commit. Browser loads small same-origin shards on demand. Failed refreshes preserve the previous snapshot; the UI continues to mark old quotes.

Slab QR decoding uses vendored jsQR 1.4.0 at upstream commit 8e6a036beafa7053dd44b1b76ac578d22b1b3311, Apache-2.0. Source inspected for standalone local pixel processing. Upstream maintenance inactive since 2021, so pin the code, retain its license and test real decoding. Run only on explicit Read QR / label or photo upload. QR payloads fill supported cert fields, never navigate automatically or confirm authenticity. Camera preview and capture retain their actual aspect ratio.

Sources inspected:
- https://tcgcsv.com/docs#usage-guidelines
- https://tcgcsv.com/faq
- https://github.com/CptSpaceToaster/tcgcsv
- https://github.com/cozmo/jsQR
- https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build
