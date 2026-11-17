"""Cache Pokemon product prices daily, following TCGCSV's usage guidelines."""
import json
import math
import os
import shutil
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / "data" / "tcgplayer-prices"
AGENT = "PokeLedger/1.0 (+https://github.com/nacheesi-gif/pokeledger)"


def download(path):
    time.sleep(0.15)
    request = urllib.request.Request("https://tcgcsv.com/" + path, headers={"User-Agent": AGENT})
    # Retry transient transport failures only; keep the previous published snapshot on failure.
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return response.read().decode()
        except (OSError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2)


def group_prices(rows):
    products = {}
    for row in rows:
        product_id, value = row.get("productId"), row.get("marketPrice")
        finish = row.get("subTypeName", "").lower().replace(" ", "-")
        if not isinstance(product_id, int) or isinstance(product_id, bool) or product_id <= 0:
            continue
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0:
            continue
        if finish not in ("normal", "holofoil", "reverse-holofoil"):
            continue
        product = products.setdefault(str(product_id), {})
        if finish in product:
            raise ValueError("Ambiguous product/finish " + str(product_id))
        product[finish] = value
    return products


def main():
    updated = datetime.fromisoformat(download("last-updated.txt").strip()).astimezone(timezone.utc).isoformat()
    manifest = TARGET / "index.json"
    current = json.loads(manifest.read_text()) if manifest.exists() else {}
    if current.get("updated") == updated:
        print("TCGCSV timestamp unchanged; no group downloads.")
        return
    groups = json.loads(download("tcgplayer/3/groups"))["results"]
    if not groups:
        raise ValueError("No Pokemon groups; preserving the prior snapshot")
    buckets = {}
    for i, group in enumerate(groups):
        rows = json.loads(download(f"tcgplayer/3/{group['groupId']}/prices"))["results"]
        for product_id, prices in group_prices(rows).items():
            bucket = buckets.setdefault(str(int(product_id) // 10000), {})
            if product_id in bucket and bucket[product_id] != prices:
                raise ValueError("Product ID collision " + product_id)
            bucket[product_id] = prices
        if (i + 1) % 25 == 0:
            print(f"Downloaded {i + 1}/{len(groups)} groups", flush=True)
    count = sum(len(bucket) for bucket in buckets.values())
    if count < 10000:
        raise ValueError("Unexpectedly small Pokemon snapshot; preserving previous cache")
    # Publish only a complete snapshot. Group failure never removes older public files.
    staging = TARGET.with_name("tcgplayer-prices-staging")
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    for key, prices in buckets.items():
        payload = {"source": "TCGplayer via TCGCSV", "unit": "USD", "updated": updated, "products": prices}
        (staging / (key + ".json")).write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    info = {"source": "TCGplayer via TCGCSV", "updated": updated, "groups": len(groups),
            "products": count, "buckets": sorted(buckets, key=int)}
    (staging / "index.json").write_text(json.dumps(info, separators=(",", ":")) + "\n")
    TARGET.mkdir(parents=True, exist_ok=True)
    for file in staging.iterdir():
        os.replace(file, TARGET / file.name)
    staging.rmdir()
    print(f"Cached {count} Pokemon products across {len(groups)} groups dated {updated}")


if __name__ == "__main__":
    main()
