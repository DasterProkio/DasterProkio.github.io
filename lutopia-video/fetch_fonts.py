"""Download the fonts used by make_video.py from the npm registry (@fontsource)
and convert them to TTF under ./fonts. Needs: pip install fonttools brotli"""
import glob, io, json, os, tarfile, urllib.request
from fontTools.ttLib import TTFont
from fontTools.merge import Merger

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fonts")
CACHE = os.path.join(OUT, ".npm")

def fetch(pkg):
    dest = os.path.join(CACHE, pkg)
    if os.path.isdir(dest):
        return dest
    meta = json.load(urllib.request.urlopen(f"https://registry.npmjs.org/@fontsource/{pkg}/latest"))
    data = urllib.request.urlopen(meta["dist"]["tarball"]).read()
    tarfile.open(fileobj=io.BytesIO(data)).extractall(dest)
    return dest

def to_ttf(src, dst):
    f = TTFont(src); f.flavor = None; f.save(dst)

def main():
    os.makedirs(OUT, exist_ok=True)
    simple = {  # (package, file stem) -> output name
        ("fredoka", "fredoka-latin-700-normal"): "Fredoka-Bold.ttf",
        ("vt323", "vt323-latin-400-normal"): "VT323.ttf",
        ("caveat", "caveat-latin-700-normal"): "Caveat-Bold.ttf",
        ("playfair-display", "playfair-display-latin-400-normal"): "Playfair.ttf",
    }
    for (pkg, stem), name in simple.items():
        out = os.path.join(OUT, name)
        if not os.path.exists(out):
            to_ttf(os.path.join(fetch(pkg), "package", "files", stem + ".woff"), out)
    # ZCOOL KuaiLe ships as ~100 unicode-range subsets; merge them into one TTF.
    out = os.path.join(OUT, "ZCOOLKuaiLe.ttf")
    if not os.path.exists(out):
        root = fetch("zcool-kuaile")
        parts = []
        for i, f in enumerate(sorted(glob.glob(os.path.join(root, "package", "files", "*-400-normal.woff")))):
            p = os.path.join(CACHE, f"zk{i}.ttf"); to_ttf(f, p); parts.append(p)
        Merger().merge(parts).save(out)
        for p in parts:
            os.remove(p)
    print("fonts ready in", OUT)

if __name__ == "__main__":
    main()
