# US Company Intelligence for AI Agents

An agent is asked to check a US public company. It needs the filings, the figures, and a
statement it can defend. Today it either scrapes EDGAR and summarises the result itself, or
it stops and waits for a human to open an account somewhere.

This endpoint answers in one paid call, with no account and no API key.

API: `https://api.x-402.online` · Repository: https://github.com/laurenthalbrun/x402-agent-gateway

## Input

```json
{ "ticker": "AAPL" }
```

`POST https://api.x-402.online/v1/us/brief`. A CIK works too. Optional `since` and `until`
in `YYYY-MM-DD` narrow the filing window.

## Output

Five blocks. Everything below is from a real response for `AAPL`, shortened.

**A sourced synthesis.** Every claim carries the origin it came from.

```json
"brief": {
  "summary": "Apple Inc. (CIK 0000320193, Nasdaq: AAPL) is a California-incorporated Electronic Computers company…",
  "key_points": [
    "Reported net income was 112.010 billion for the period ending 2025-09-27 [financials].",
    "The eight numbered sources are Section 16 ownership filings (Forms 3, 4) and one Form 8-K/A, dated 2026-08-20 to 2026-09-17 [S1-S8].",
    "EPS was 7.46 for the period ending 2025-09-27, with operating cash flow of 111.482 billion [metrics]."
  ],
  "open_questions": ["…what the filings do not settle…"]
}
```

**Financial metrics read from XBRL**, not from the prose.

```json
"metrics": {
  "eps": [{ "end": "2025-09-27", "value": 7.46, "fy": 2025 }],
  "operating_income": [{ "end": "2025-09-27", "value": 133050000000, "fy": 2025 }],
  "operating_cash_flow": [{ "end": "2025-09-27", "value": 111482000000, "fy": 2025 }]
}
```

A metric the company does not file is listed in `metrics_unavailable` with the reason. JPMorgan
does not report `OperatingIncomeLoss`, so for `JPM` that field comes back declared empty rather
than quietly missing.

**Numbered source objects.** Each `n` resolves to a real EDGAR document.

```json
"sources": [
  { "n": 1, "form": "4", "date": "2026-09-17", "accession": "0001140361-26-037020",
    "title": "4", "url": "https://www.sec.gov/Archives/edgar/data/320193/000114036126037020/xslF345X06/form4.xml" }
]
```

**A filing window.** Apple's index holds 1001 filings. Ask for a period and you get that
period, not the last eight.

```json
"window": { "since": "2026-06-01", "until": null, "filings_in_window": 14, "filings_available_total": 1001 }
```

**A verification block.** It reports whether every citation in the text resolves to a real
source, so you do not have to trust the synthesis to use it.

```json
"verification": { "numbered_refs": 8, "numbered_refs_resolved": 8, "orphan_refs": [],
                  "key_points_cited": 6, "key_points_total": 6, "citation_rate": 1, "passe": true }
```

Plus `identity`, six annual financial series, the filings themselves, and the token usage of
the call.

## Price

`0.040004` USDC per call. Every route on this API has its own amount down to the last
micro-dollar, so a settlement is attributable on-chain by the amount alone.

## The flow

**DISCOVER.** Free, no wallet.

```bash
curl -s https://api.x-402.online/v1/capabilities
curl -s https://api.x-402.online/v1/us/brief/enrichments
```

**QUOTE.** Free. Tells you the capability, the source, the expected latency, the output
schema and the price before anything is paid.

```bash
curl -s -X POST https://api.x-402.online/v1/solve/preview \
  -H 'content-type: application/json' \
  -d '{"task":"due diligence on AAPL from SEC filings"}'
```

**402.** Call the endpoint without paying and you get the challenge, with the exact amount.

```bash
curl -i -X POST https://api.x-402.online/v1/us/brief \
  -H 'content-type: application/json' -d '{"ticker":"AAPL"}'
# HTTP/1.1 402 · header Payment-Required · accepts[0].amount = "40004" (atomic units)
```

**PAY.** x402 `exact` scheme, USDC on Base. Your wallet needs USDC and no ETH: the payment
is an EIP-3009 authorization, so the facilitator submits the transaction and pays the gas.

**RESULT.** The same request, with the payment header, returns the brief.

See [examples/](examples/) for runnable Node, Python, curl, MCP and A2A calls.

## Cheaper, if facts are all you need

`POST /v1/solve` with the capability `company_core_us` costs `0.012002` and returns the
identity, the six annual series and the recent filings. No synthesis, no metrics, no source
objects, no window. It is also about five times faster, because no model sits in that path.

The comparison is in [examples/primitive-vs-premium.md](examples/primitive-vs-premium.md).

## What this is not

Not investment advice. The endpoint reports what SEC EDGAR contains and cites it. It never
recommends buying or selling anything, and what the filings do not answer goes into
`open_questions` rather than being filled with a guess.
