#!/usr/bin/env python3
"""Slice Quanton Mining icon sheet into frontend assets."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    "/Users/abatubbiev/.cursor/projects/Users-abatubbiev-nft-ai-marketplace/assets/"
    "image-c018f631-7506-4897-8294-3bb9667ceb3d.png"
)
OUT = ROOT / "frontend/src/assets/mine-icons"

# left, top, right, bottom — calibrated on 1024×682 sheet (icon art only)
CROPS = {
    # Currency & resources
    "shards": (48, 55, 125, 115),
    "gems": (128, 55, 210, 118),
    "energy": (210, 55, 300, 118),
    # Level & rank (center columns)
    "rank-badge": (318, 55, 400, 118),
    "rank-crown": (395, 172, 485, 248),
    "level-up": (520, 62, 580, 145),
    # Main action (right column)
    "mine-tap": (585, 62, 715, 148),
    "multiplier": (718, 62, 798, 145),
    "speed-boost": (800, 62, 900, 155),
    # Side menu — row 1
    "daily": (48, 172, 125, 248),
    "missions": (148, 172, 225, 248),
    "invite": (248, 172, 325, 248),
    # Side menu — row 2
    "boost": (348, 172, 425, 248),
    "crates": (448, 172, 525, 248),
    "leaders": (548, 172, 625, 248),
    # Bottom nav
    "nav-market": (48, 355, 125, 415),
    "nav-mine": (148, 355, 225, 415),
    "nav-activity": (248, 355, 325, 415),
    "nav-profile": (348, 355, 425, 415),
    # Upgrades
    "multi-tap": (48, 545, 125, 615),
    "turbo-miner": (148, 545, 225, 615),
    "battery": (248, 545, 325, 615),
    "recharge": (348, 545, 425, 615),
    # Crate types (right column top)
    "crate-common": (532, 68, 632, 132),
    "crate-rare": (658, 68, 758, 132),
    "crate-epic": (782, 68, 882, 132),
    # Leaderboard crowns
    "crown-gold": (532, 310, 618, 380),
    "crown-silver": (658, 310, 744, 380),
    "crown-bronze": (782, 310, 868, 380),
    "top-badge": (898, 310, 988, 380),
    # Status & UI
    "sync": (532, 288, 608, 358),
    "close": (648, 288, 724, 358),
    "info": (768, 288, 844, 358),
    "settings": (888, 288, 964, 358),
    "online": (532, 368, 592, 428),
    "offline": (648, 368, 708, 428),
    # Utility row
    "xp": (768, 368, 828, 428),
    "time": (888, 368, 948, 428),
    "streak": (532, 448, 592, 508),
    "reward": (648, 448, 718, 508),
    "bonus": (768, 448, 838, 508),
    "protect": (888, 448, 958, 508),
    # Effect icons
    "critical": (532, 528, 608, 608),
    "lucky": (648, 528, 724, 608),
    "multi-x10": (768, 528, 844, 608),
    "auto-mining": (888, 528, 964, 608),
    # Rank badge frames (icon only, above labels)
    "badge-rookie": (40, 598, 108, 665),
    "badge-gift-hunter": (133, 598, 201, 665),
    "badge-shard-collector": (226, 598, 294, 665),
    "badge-rare-seeker": (319, 598, 387, 665),
    "badge-market-raider": (412, 598, 480, 665),
    "badge-whale-scout": (505, 598, 573, 665),
    "badge-quanton-elite": (598, 598, 666, 665),
    "badge-legendary": (691, 598, 759, 665),
}


def trim(im: Image.Image, pad: int = 2) -> Image.Image:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 24:
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


def save_icon(name: str, box: tuple[int, int, int, int], src: Image.Image) -> None:
    l, t, r, b = box
    crop = trim(src.crop((l, t, r, b)))
    mx = max(crop.size)
    target = 128 if mx > 128 else mx
    if mx > target:
        ratio = target / mx
        crop = crop.resize(
            (max(1, int(crop.width * ratio)), max(1, int(crop.height * ratio))),
            Image.Resampling.LANCZOS,
        )
    path = OUT / f"{name}.png"
    crop.save(path, optimize=True)
    print(f"  {name} -> {crop.size}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    print(f"Source {src.size}")
    for name, box in CROPS.items():
        save_icon(name, box, src)
    print(f"Exported {len(CROPS)} icons to {OUT}")


if __name__ == "__main__":
    main()
