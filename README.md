# x402 Agent Gateway

Pay-per-call APIs for autonomous agents, settled in USDC over [x402](https://x402.org).
No account, no API key, no subscription. An agent discovers the endpoint, gets a `402`
with the exact amount, pays, and gets the result.

Live API: `https://api.x-402.online`

## Start here: the free quote

Nothing below costs anything until you choose to pay. Two endpoints are free and require
no wallet at all.

```bash
npx x402-agent-gateway capabilities                    # what can be solved
npx x402-agent-gateway preview "summarise ethereum etf news"   # the plan and the price
```

The quote tells you which capability was chosen, why, what it costs, **and when a direct
route would be cheaper than the gateway**. The gateway has a single price, so it overcharges
for cheap capabilities. You should know that before you pay, not after.

## The flagship product

**`POST /v1/us/brief` — $0.040004**

A decision-grade briefing on a US public company, from SEC EDGAR, in one call:

- a summary where **every claim cites its origin**: `[identity]`, `[financials]`, `[filings]`
- key points and the open questions the data does not settle
- **the underlying facts alongside**: identity, three years of annual figures, recent filings

Buying the three underlying routes separately costs **$0.090024**. This replaces them with a
synthesised answer for **56% less**, and you can still verify every claim because the raw
facts come back with it.

```js
import { Gateway } from "x402-agent-gateway";

const g = new Gateway({ fetch: myX402Fetch });   // any x402-capable fetch
const r = await g.usBrief("AAPL");

r.brief.summary        // "Apple Inc. (CIK 0000320193) is a Nasdaq-listed … [identity]"
r.brief.key_points     // each one cites its source
r.financials.revenue   // the raw figures, to check the summary against
r.filings              // the recent SEC filings
```

```python
from x402_gateway import Gateway
g = Gateway()
r = g.us_brief("AAPL")
print(r["brief"]["summary"], r["financials"]["revenue"])
```

Without a payment-capable fetch, `usBrief` raises `PaymentRequired` **carrying the x402
challenge** — amount, network and address. Pay it with whatever tooling you already use.
This SDK does not impose its own.

## Capabilities behind one endpoint

`POST /v1/solve` — $0.012002. Send a task in plain words, or name a capability and its
input. The gateway resolves which capability is needed, ranks providers by expected net
margin and observed success rate, executes, falls back to the next provider on failure, and
returns the result with the routing it used.

| capability | what it does |
|---|---|
| `company_brief_us` | the SEC briefing above |
| `web_search` | ranked web results |
| `news_search` | fresh headlines |
| `news_brief` | headlines plus a sourced summary |
| `llm_generate` | text generation, two providers, one engine |
| `web_extract` | a page as clean markdown, French residential IP, real browser |
| `web_render` | full HTML after JavaScript execution |

`GET /v1/capabilities` returns the input and output schemas, and lists only what is actually
servable right now.

## Discovery, for machines

| surface | what it carries |
|---|---|
| `/openapi.json` | the full OpenAPI description |
| `/llms.txt` | a plain-text summary for language models |
| `/.well-known/x402` | the x402 payment metadata |
| `/.well-known/agent-card.json` | the A2A Agent Card, protocol 0.3.0 |
| `/mcp` | an MCP server, 63 tools, `tools/list` over JSON-RPC |
| `/v1/capabilities` | the gateway's capability registry |

## Payment

x402, `exact` scheme, USDC on Base (`eip155:8453`) and Solana. Each route has a **unique**
amount, so every settlement is attributable on-chain by the amount alone. `/v1/us/brief`
is `40004` micro-USDC, `/v1/solve` is `12002`.

## Install

```bash
npm install x402-agent-gateway      # Node 20+
pip install x402-agent-gateway      # Python 3.10+, no dependencies
```

Both are in this repository under `node/` and `python/`. If the published packages are not
up yet, point the client at the API directly — the SDK is a thin, optional convenience:

```bash
curl -s -X POST https://api.x-402.online/v1/us/brief \
  -H 'content-type: application/json' -d '{"ticker":"AAPL"}'
# → 402 with the exact amount to pay
```

## What this is not

Not investment advice. `/v1/us/brief` reports what SEC EDGAR contains and cites it; it never
recommends buying or selling anything, and it says in `open_questions` what the filings do
not answer rather than filling the gap with a guess.

MIT licensed.
