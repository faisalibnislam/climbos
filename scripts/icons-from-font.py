"""Regenerate src/components/icons/index.tsx from the Font Awesome Sharp Light font.

Usage: python3 scripts/icons-from-font.py "/path/to/Font Awesome 6 Sharp-Light-300.otf"
Needs fontTools. Icon names (lucide-compatible) -> Font Awesome glyph names live in
scripts/icon-map.py; add a line there to add an icon. The font file is not committed.
"""
import pathlib, re, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

root = pathlib.Path(__file__).resolve().parent.parent
ns = {}
exec((root / "scripts/icon-map.py").read_text(), ns)
MAP = ns["MAP"]
out = root / "src/components/icons/index.tsx"
current = out.read_text()
header = current.split("/** Font Awesome Sharp Light:")[0]
tail = current[current.index("/* ClimbOS Sharp"):] if "/* ClimbOS Sharp" in current else ""
# Icons drawn in our own ClimbOS Sharp set (src/components/icons/sharp.tsx) are never regenerated from the font.
sharp = set(re.findall(r"export const (\w+) =", (root / "src/components/icons/sharp.tsx").read_text()))
names = sorted((set(re.findall(r"export const (\w+) = icon\(", current)) | set(sys.argv[2:])) - sharp)

font = TTFont(sys.argv[1])
gs, hmtx = font.getGlyphSet(), font["hmtx"]
fmt = lambda v: str(int(round(v, 1))) if round(v, 1) == int(round(v, 1)) else str(round(v, 1))
parts = []
for n in names:
    g = MAP[n]
    pen = SVGPathPen(gs, ntos=fmt)
    gs[g].draw(TransformPen(pen, (1, 0, 0, -1, 0, 448)))
    vb = f"{fmt((hmtx[g][0] - 512) / 2)} 0 512 512"
    parts.append(f'/** Font Awesome Sharp Light: {g} */\nexport const {n} = icon("{n}", "{vb}", "{pen.getCommands()}");')
out.write_text(header + "\n\n".join(parts) + "\n\n" + tail)
print(f"{len(names)} icons -> {out}")
