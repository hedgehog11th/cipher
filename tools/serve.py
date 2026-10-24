"""Local preview server for Cipher (standard library only).

  python tools/serve.py              serve the project folder and open the question bank in the browser
  python tools/serve.py --no-browser

Sets correct content types (Windows can map .js to text/plain, which breaks module scripts) and
disables caching, so edited data shows up on reload. Only listens on 127.0.0.1 (this computer).
"""
import functools
import http.server
import pathlib
import socket
import sys
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent.parent
TYPES = {".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css",
         ".html": "text/html", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
         ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain"}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and str(args[1]).startswith(("4", "5")):     # only show failed requests
            sys.stderr.write("  [%s] %s\n" % (args[1], args[0]))


def free_port(start=8000):
    for port in range(start, start + 50):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise SystemExit("No free port between 8000 and 8049.")


def main():
    port = free_port()
    url = f"http://127.0.0.1:{port}/#/questions"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=str(ROOT)))
    print(f"Cipher preview: {url}")
    print("Keep this window open while you look at the site. Press Ctrl+C (or close the window) to stop.")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
