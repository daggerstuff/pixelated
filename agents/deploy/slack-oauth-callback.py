#!/usr/bin/env python3
"""Capture Slack OAuth redirect codes for px-* app installation.

Slack's oauth.v2.authorize redirects the browser to the app's redirect URL
with ?code=...&state=.... This server listens on 127.0.0.1:8977, appends each
callback's query params to /tmp/slack-oauth-codes.jsonl, and shows a plain
success page. Run it while the user clicks the authorize links.
"""

import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

OUT = "/tmp/slack-oauth-codes.jsonl"
PAGE = b"<h2>Slack app authorized</h2><p>You can close this tab and return to the terminal.</p>"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        if qs:
            with open(OUT, "a", encoding="utf-8") as f:
                f.write(json.dumps({"ts": time.time(), "path": self.path, "query": qs}) + "\n")
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(PAGE)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8977), Handler).serve_forever()
