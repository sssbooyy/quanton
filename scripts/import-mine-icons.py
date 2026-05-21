#!/usr/bin/env python3
"""Import dedicated Quanton Mining icons into frontend assets."""
from pathlib import Path
from PIL import Image

ASSETS = Path(
    "/Users/abatubbiev/.cursor/projects/Users-abatubbiev-nft-ai-marketplace/assets"
)
OUT = Path(__file__).resolve().parents[1] / "frontend/src/assets/mine-icons"

# source filename glob key -> output name(s)
IMPORTS = {
    "Shards": ["shards"],
    "Gams": ["gems"],
    "Energy": ["energy", "battery"],
    "Mine": ["mine-tap"],
    "LevelUp": ["level-up"],
    "Daily": ["daily"],
    "Mission": ["missions"],
    "Invite": ["invite"],
    "Boost": ["boost"],
    "Crates": ["crates"],
    "Rank_Crown": ["rank-crown", "leaders"],
    "SpeedBoost": ["speed-boost", "turbo-miner"],
}


def find_source(key: str) -> Path:
    matches = sorted(ASSETS.glob(f"{key}*.png"))
    if not matches:
        raise FileNotFoundError(f"No asset for {key}")
    return matches[0]


def key_background(im: Image.Image) -> Image.Image:
    """Remove black backgrounds and dark UI tile boxes baked into assets."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            peak = max(r, g, b)
            low = min(r, g, b)
            # Near-black backdrop
            if peak <= 48:
                px[x, y] = (0, 0, 0, 0)
                continue
            # Dark purple/grey icon tiles and frames
            if peak <= 72 and (r + g + b) <= 140 and (peak - low) <= 28:
                if b >= r - 8 or peak <= 58:
                    px[x, y] = (0, 0, 0, 0)
    return im


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 16:
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if not found:
        return im
    return im.crop(
        (
            max(0, minx - pad),
            max(0, miny - pad),
            min(w, maxx + pad + 1),
            min(h, maxy + pad + 1),
        )
    )


def crop_shards(src: Image.Image) -> Image.Image:
    w, h = src.size
    if h > w * 1.2:
        return src.crop((int(w * 0.05), int(h * 0.62), int(w * 0.95), int(h * 0.96)))
    return src


def find_mine_tap_source() -> Path:
    hero = sorted(ASSETS.glob("image-2848763b*.png"))
    if hero:
        return hero[0]
    return find_source("Mine")


def process(src: Image.Image, target: int = 128) -> Image.Image:
    icon = key_background(src.convert("RGBA"))
    icon = trim(icon)
    mx = max(icon.size)
    if mx > target:
        ratio = target / mx
        icon = icon.resize(
            (max(1, int(icon.width * ratio)), max(1, int(icon.height * ratio))),
            Image.Resampling.LANCZOS,
        )
    return icon


SHEET_ONLY = {
    "multi-tap", "recharge", "rank-badge", "multiplier", "nav-market", "nav-mine",
    "nav-activity", "nav-profile", "crate-common", "crate-rare", "crate-epic",
    "crown-gold", "crown-silver", "crown-bronze", "top-badge", "sync", "close",
    "info", "settings", "online", "offline", "xp", "time", "streak", "reward",
    "bonus", "protect", "critical", "lucky", "multi-x10", "auto-mining",
    "badge-rookie", "badge-gift-hunter", "badge-shard-collector", "badge-rare-seeker",
    "badge-market-raider", "badge-whale-scout", "badge-quanton-elite", "badge-legendary",
}


def reprocess_sheet_icons(target: int = 128) -> None:
    for path in sorted(OUT.glob("*.png")):
        if path.stem not in SHEET_ONLY:
            continue
        icon = process(Image.open(path))
        icon.save(path, optimize=True)
        print(f"reprocessed {path.name} ({icon.size})")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, outputs in IMPORTS.items():
        path = find_mine_tap_source() if key == "Mine" else find_source(key)
        src = Image.open(path)
        if key == "Shards":
            src = crop_shards(src)
        t = 256 if key == "Mine" else 128
        icon = process(src, target=t)
        for name in outputs:
            out = OUT / f"{name}.png"
            icon.save(out, optimize=True)
            print(f"{path.name} -> {name}.png ({icon.size})")
    reprocess_sheet_icons()


if __name__ == "__main__":
    main()
