#!/usr/bin/env python3
"""Query the Open Pulse OpenSearch cluster.

Reads OPENSEARCH_ENDPOINT, OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD
from .env at the repo root, or from the environment. The endpoint is
HTTPS with a self-signed cert by default, so TLS verification is
disabled (override with --verify).

Usage:
    # Cluster health
    python query.py health

    # List indices
    python query.py indices

    # Count docs in an index
    python query.py count <index>

    # DSL search (body from CLI, stdin, or file)
    python query.py search <index> '{"query":{"match_all":{}}}'
    python query.py search <index> -                 # stdin
    python query.py search <index> -f path.json      # file

    # Arbitrary GET — useful for _cat/* and one-off introspection
    python query.py get /<path>

Each subcommand prints JSON to stdout. Errors go to stderr with the
HTTP status and response body.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def load_dotenv() -> None:
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        env = parent / ".env"
        if env.is_file():
            for raw in env.read_text().splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())
            return


def request(method: str, path: str, body: bytes | None, verify: bool) -> dict:
    endpoint = os.environ["OPENSEARCH_ENDPOINT"].rstrip("/")
    user = os.environ["OPENSEARCH_USERNAME"]
    password = os.environ["OPENSEARCH_PASSWORD"]
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    headers = {"Authorization": f"Basic {token}", "Accept": "application/json"}

    proxy = os.environ.get("OPENSEARCH_DASHBOARDS_PROXY", "").strip().lower() in ("1", "true", "yes")
    if proxy:
        # OpenSearch Dashboards' Dev Tools proxy. The cluster API path goes
        # in the `path` query param (URL-encoded so its own `?query` survives),
        # the inner verb in `method`, and the outer request is always POST.
        inner = path[1:] if path.startswith("/") else path
        proxy_qs = urllib.parse.urlencode({"path": inner, "method": method.upper()})
        url = f"{endpoint}/api/console/proxy?{proxy_qs}"
        outer_method = "POST"
        headers["osd-xsrf"] = "true"
        # The proxy expects a content-type on POSTs even when the inner verb
        # is GET, so always set it.
        headers.setdefault("Content-Type", "application/json")
    else:
        url = f"{endpoint}{path}"
        outer_method = method
        if body is not None:
            headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=headers, method=outer_method)
    ctx = ssl.create_default_context()
    if not verify:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        print(f"http {e.code}: {e.read().decode(errors='replace')}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"network error: {e.reason}", file=sys.stderr)
        sys.exit(1)

    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw.decode(errors="replace")}


def read_body(arg: str | None, file: str | None) -> bytes | None:
    if file:
        return Path(file).read_bytes()
    if arg == "-":
        return sys.stdin.buffer.read()
    if arg is None:
        return None
    return arg.encode()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--verify", action="store_true", help="enforce TLS verification (default: skip)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("health")
    p_indices = sub.add_parser("indices")
    p_indices.add_argument("pattern", nargs="?", default="*")

    p_count = sub.add_parser("count")
    p_count.add_argument("index")

    p_search = sub.add_parser("search")
    p_search.add_argument("index")
    p_search.add_argument("body", nargs="?", help="JSON body, or '-' for stdin")
    p_search.add_argument("-f", "--file")
    p_search.add_argument("--size", type=int, default=10)

    p_get = sub.add_parser("get")
    p_get.add_argument("path", help="path under the endpoint, eg /_cat/indices?v")

    args = parser.parse_args()
    load_dotenv()
    for key in ("OPENSEARCH_ENDPOINT", "OPENSEARCH_USERNAME", "OPENSEARCH_PASSWORD"):
        if not os.environ.get(key):
            print(f"error: {key} must be set", file=sys.stderr)
            return 2

    if args.cmd == "health":
        payload = request("GET", "/_cluster/health", None, args.verify)
    elif args.cmd == "indices":
        payload = request("GET", f"/_cat/indices/{args.pattern}?format=json&h=index,docs.count,store.size&s=index", None, args.verify)
    elif args.cmd == "count":
        payload = request("GET", f"/{args.index}/_count", None, args.verify)
    elif args.cmd == "search":
        body = read_body(args.body, args.file) or b'{"query":{"match_all":{}}}'
        payload = request("POST", f"/{args.index}/_search?size={args.size}", body, args.verify)
    elif args.cmd == "get":
        path = args.path if args.path.startswith("/") else f"/{args.path}"
        payload = request("GET", path, None, args.verify)
    else:
        parser.print_help()
        return 2

    json.dump(payload, sys.stdout, indent=2, default=str)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
