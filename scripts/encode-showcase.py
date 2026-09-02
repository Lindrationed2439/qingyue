"""Encode recorded application frames as a compact GIF; never fabricate UI pixels."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
STAGING = ROOT / "release" / ".github-media"
capture_dir = Path(json.loads((STAGING / "latest.json").read_text(encoding="utf-8"))["directory"]).resolve()
if not capture_dir.is_relative_to(STAGING.resolve()):
    raise ValueError("Capture path must remain inside the media staging directory")
capture = json.loads((capture_dir / "capture.json").read_text(encoding="utf-8"))
frames = []
for item in capture["frames"]:
    with Image.open(capture_dir / item["file"]) as source:
        rgb = source.convert("RGB")
        rgb.thumbnail((1120, 724), Image.Resampling.LANCZOS)
        frames.append(rgb.quantize(colors=192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
target = ROOT / "docs" / "media" / "qingyue-demo.gif"
frames[0].save(target, save_all=True, append_images=frames[1:],
               duration=[frame["delayMs"] for frame in capture["frames"]], loop=0, optimize=True, disposal=1)
with Image.open(target) as gif:
    assert gif.is_animated and gif.n_frames > 5
    dimensions = list(gif.size)
    count = gif.n_frames
    for index in range(count):
        gif.seek(index)
        decoded = gif.convert("RGB")
        decoded.load()
        if index in {0, 5, 6, 10, count - 1}:
            decoded.save(capture_dir / f"gif-check-{index:02d}.png")
        decoded.close()
for frame in frames:
    frame.close()
files = [item["file"] for item in capture["screenshots"]] + [target.name]
manifest = {key:value for key,value in capture.items() if key != "frames"}
manifest["demo"] = {"file":target.name,"dimensions":dimensions,"encodedFrames":count,
                    "durationMs":sum(frame["delayMs"] for frame in capture["frames"]),
                    "sequence":[{"action":f["action"],"durationMs":f["delayMs"]} for f in capture["frames"]]}
manifest["files"] = [{"file":name,"bytes":(target.parent/name).stat().st_size,
                       "sha256":hashlib.file_digest((target.parent/name).open("rb"),"sha256").hexdigest()} for name in files]
(target.parent / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n",encoding="utf-8")
print(json.dumps({"gif":str(target),"frames":count,"bytes":target.stat().st_size,"dimensions":dimensions}))
