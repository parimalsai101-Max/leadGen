import json, sys
from ddgs import DDGS

query = sys.argv[1] if len(sys.argv) > 1 else ""
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20

if not query:
    print(json.dumps([]))
    sys.exit(0)

try:
    results = DDGS().text(query, max_results=limit)
    print(json.dumps([
        {"url": r["href"], "title": r["title"], "description": r.get("body", "")}
        for r in (results or [])
    ]))
except Exception as e:
    print(json.dumps({"error": str(e)}))
