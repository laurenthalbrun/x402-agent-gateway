#!/usr/bin/env python3
"""Free discovery and quote, then the 402 challenge, from Python with no dependencies.

    python3 python.py AAPL

Payment itself needs an x402-capable client; this script stops at the challenge and prints
the exact amount to pay. See node.mjs for a paying example.

API: https://api.x-402.online · repo: https://github.com/laurenthalbrun/x402-agent-gateway
"""
import base64, json, sys, urllib.request, urllib.error

API = "https://api.x-402.online"
ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"


def post(path, body):
    req = urllib.request.Request(
        API + path, data=json.dumps(body).encode(),
        headers={"content-type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, dict(r.headers), json.loads(r.read())
    except urllib.error.HTTPError as e:
        corps = e.read()
        try:
            corps = json.loads(corps)
        except Exception:
            corps = corps.decode("utf8", "replace")
        return e.code, dict(e.headers), corps


# 1 · the free quote. It answers what you get, from which source, in how long, at what price.
statut, _, devis = post("/v1/solve/preview", {"task": f"due diligence on {ticker} from SEC filings"})
q = (devis or {}).get("quote", {})
print(f"quote      {q.get('capability')}  {q.get('price_usd')} USDC  tier {q.get('tier')}")
print(f"source     {q.get('source')}")
print(f"latency    {q.get('latency_ms_estimated')} ms")
prem = q.get("premium_alternative") or {}
if prem:
    print(f"premium    {prem.get('route')}  {prem.get('price_usd')} USDC")
    print(f"           adds: {prem.get('adds')}")

# 2 · the premium route, unpaid: the challenge carries the exact amount.
statut, entetes, corps = post("/v1/us/brief", {"ticker": ticker})
print(f"\n/v1/us/brief unpaid -> HTTP {statut}")
brut = entetes.get("Payment-Required") or entetes.get("payment-required")
if brut:
    defi = json.loads(base64.b64decode(brut))
    a = defi["accepts"][0]
    # amount is in ATOMIC units: "40004" is 0.040004 USDC. Reading it as dollars is a
    # factor of one million.
    print(f"  scheme   {a['scheme']} on {a['network']}")
    print(f"  amount   {a['amount']} atomic = {int(a['amount']) / 1e6} USDC")
    print(f"  payTo    {a['payTo']}")
    print(f"  asset    {a['asset']}")
else:
    print("  no challenge header; body:", json.dumps(corps)[:200])
