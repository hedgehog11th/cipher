"""Rasterise the texture SVGs in this folder into assets/textures/ (development only).

The site uses the resulting JPEGs rather than live SVG filters, because browsers (Safari in particular)
render feTurbulence / lighting filters differently. Re-run only after editing an SVG here:
  E:\\Cipher-materials\\work\\.venv\\Scripts\\python.exe tools\\textures\\render.py
Needs Google Chrome and PyMuPDF (in the work venv). Not needed for adding questions.
"""
import pathlib
import subprocess
import tempfile
import pymupdf

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / "assets" / "textures"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
# name: (source svg, css width, css height, device scale, jpeg quality or None for transparent PNG)
JOBS = {
    "paper": ("paper-a.svg", 600, 600, 1, 88),
    "ring": ("ring.svg", 200, 140, 2, None),
}


def render(src, w, h, scale, quality, name):
    if quality is None:
        return render_png(src, w, h, scale, name)
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        page = pathlib.Path(tmp) / "p.html"
        page.write_text(f"<!doctype html><body style='margin:0'><img src='{(HERE / src).as_uri()}' width='{w}' height='{h}' style='display:block'>",
                        encoding="utf-8")
        png = pathlib.Path(tmp) / "p.png"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={tmp}\\prof",
                        "--allow-file-access-from-files", f"--force-device-scale-factor={scale}", f"--window-size={w},{h}",
                        f"--screenshot={png}", page.as_uri()], check=True, capture_output=True)
        pix = pymupdf.Pixmap(str(png))
        if pix.alpha:
            pix = pymupdf.Pixmap(pix, 0)
        pix.save(str(OUT / f"{name}.jpg"), jpg_quality=quality)
        print(f"{name}.jpg {pix.width}x{pix.height} {(OUT / f'{name}.jpg').stat().st_size // 1024} KB")


def render_png(src, w, h, scale, name):
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        page = pathlib.Path(tmp) / "p.html"
        page.write_text(f"<!doctype html><body style='margin:0;background:transparent'><img src='{(HERE / src).as_uri()}' width='{w}' height='{h}' style='display:block'>",
                        encoding="utf-8")
        out = OUT / f"{name}.png"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={tmp}\\prof",
                        "--allow-file-access-from-files", "--default-background-color=00000000",
                        f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", f"--screenshot={out}", page.as_uri()],
                       check=True, capture_output=True)
        pix = pymupdf.Pixmap(str(out))
        print(f"{name}.png {pix.width}x{pix.height} alpha={bool(pix.alpha)} {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    for name, (src, w, h, scale, q) in JOBS.items():
        render(src, w, h, scale, q, name)
