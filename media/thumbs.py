"""Make the media pages' thumbnails: one JPEG per copy, at most 360 pixels on its longer side.

    python media/thumbs.py [folder]   (default: media/_out; thumbnails go to <folder>/media/thumbs/<variant id>.jpg)

The pictures are read from files/ beside this script, as media.json names them. A thumbnail already made is kept.
"""

import json
import sys
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent
MEDIA = SITE / "files"
SIDE = 360


def main():
    out = (Path(sys.argv[1]) if len(sys.argv) > 1 else SITE / "_out") / "media" / "thumbs"
    out.mkdir(parents=True, exist_ok=True)
    data = json.loads((SITE / "media.json").read_text(encoding="utf-8"))
    made = kept = 0
    for image in data["images"]:
        for variant in image["variants"]:
            target = out / f"{variant['id']}.jpg"
            if target.exists():
                kept += 1
                continue
            with Image.open(MEDIA / Path(variant["file"]).name) as opened:
                opened.seek(0)
                picture = opened.convert("RGB")
            picture.thumbnail((SIDE, SIDE), Image.Resampling.LANCZOS)
            picture.save(target, "JPEG", quality=82, optimize=True, progressive=True)
            made += 1
    print(f"made {made} thumbnails, kept {kept}, in {out}")


if __name__ == "__main__":
    main()
