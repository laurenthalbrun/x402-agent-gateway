#!/usr/bin/env bash
# Free discovery, free quote, then the 402 challenge. Nothing here costs anything.
# API: https://api.x-402.online · repo: https://github.com/laurenthalbrun/x402-agent-gateway
set -euo pipefail
API=${API:-https://api.x-402.online}

echo "== what can be bought, and the input/output schema of each (free) =="
curl -s "$API/v1/capabilities" | head -c 600; echo

echo
echo "== which enrichments the premium brief adds, and what each one cost to build (free) =="
curl -s "$API/v1/us/brief/enrichments" | head -c 600; echo

echo
echo "== the quote: capability, source, latency, schema, price, before paying (free) =="
curl -s -X POST "$API/v1/solve/preview" \
  -H 'content-type: application/json' \
  -d '{"task":"due diligence on AAPL from SEC filings"}' | head -c 900; echo

echo
echo "== the premium brief, unpaid: returns the 402 challenge =="
# accepts[0].amount is in ATOMIC units. 40004 means 0.040004 USDC, not 40004 dollars.
curl -i -s -X POST "$API/v1/us/brief" \
  -H 'content-type: application/json' -d '{"ticker":"AAPL"}' | sed -n '1,12p'

echo
echo "== the same, with a filing window =="
curl -i -s -X POST "$API/v1/us/brief" \
  -H 'content-type: application/json' \
  -d '{"ticker":"AAPL","since":"2026-06-01"}' | sed -n '1,3p'

echo
echo "== the cheaper primitive: facts only, no synthesis =="
curl -i -s -X POST "$API/v1/solve" \
  -H 'content-type: application/json' \
  -d '{"capability":"company_core_us","input":{"ticker":"AAPL"}}' | sed -n '1,3p'

echo
echo "To actually pay, see node.mjs or python.py in this directory."
