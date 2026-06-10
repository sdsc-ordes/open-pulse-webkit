#!/usr/bin/env python3
"""Run a Cypher query against the Open Pulse Neo4j HTTP transactional API.

Reads NEO4J_HTTP_ENDPOINT and NEO4J_AUTH (format: user/password) from
.env at the repo root, or from the environment. Prints the rows as JSON
to stdout.

Usage:
    python query.py 'MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n'
    python query.py -                          # read query from stdin
    python query.py -f path/to/query.cypher    # read query from file
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def load_dotenv() -> None:
    """Walk up from this file to find a .env and merge it into os.environ."""
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


def read_query(args: argparse.Namespace) -> str:
    if args.file:
        return Path(args.file).read_text()
    if args.query == "-" or args.query is None:
        return sys.stdin.read()
    return args.query


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("query", nargs="?", help="Cypher query, or '-' for stdin")
    parser.add_argument("-f", "--file", help="read query from file")
    parser.add_argument("--database", default="neo4j", help="target database (default: neo4j)")
    args = parser.parse_args()

    load_dotenv()
    endpoint = os.environ.get("NEO4J_HTTP_ENDPOINT")
    auth = os.environ.get("NEO4J_AUTH")
    if not endpoint or not auth or "/" not in auth:
        print("error: NEO4J_HTTP_ENDPOINT and NEO4J_AUTH (user/password) must be set", file=sys.stderr)
        return 2

    user, _, password = auth.partition("/")
    cypher = read_query(args).strip()
    if not cypher:
        print("error: empty query", file=sys.stderr)
        return 2

    body = json.dumps({"statements": [{"statement": cypher}]}).encode()
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    url = f"{endpoint.rstrip('/')}/db/{args.database}/tx/commit"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"http {e.code}: {e.read().decode(errors='replace')}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"network error: {e.reason}", file=sys.stderr)
        return 1

    if payload.get("errors"):
        print(json.dumps(payload["errors"], indent=2), file=sys.stderr)
        return 1

    result = payload["results"][0]
    rows = [dict(zip(result["columns"], r["row"])) for r in result["data"]]
    json.dump(rows, sys.stdout, indent=2, default=str)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
