# x402 Agent Gateway

An agent needs a fact, a page read, or a short piece of work done. Every API it finds wants
an account, a confirmed email, a dashboard visit and a card on file. An agent can do none of
that on its own, so it stops and waits for a human.

This gateway removes the account. The agent calls an endpoint, gets HTTP 402 with the exact
amount, pays in USDC, and receives the result. No signup, no API key, no subscription, no
minimum.

Live API: `https://api.x-402.online`

## Look before you pay

Two endpoints are free and need no wallet at all.

```bash
curl -s https://api.x-402.online/v1/capabilities

curl -s -X POST https://api.x-402.online/v1/solve/preview \
  -H 'content-type: application/json' \
  -d '{"task":"due diligence on AAPL from SEC filings"}'
```

The quote answers what you receive, where the data comes from, the expected latency, the
output schema and the price, before a single cent moves. Real output, shortened:

```json
{
  "capability": "company_brief_us",
  "why_this_capability": "a US public-filing marker (SEC, EDGAR, a form number, a CIK or a ticker)",
  "normalized_input": { "query": "AAPL" },
  "price_usd": 0.012002,
  "source": "SEC EDGAR (official filings), then a deepseek synthesis",
  "latency_ms_estimated": 9000,
  "will_execute": true,
  "direct_route_comparison": {
    "direct_route": "/v1/us/brief",
    "direct_price_usd": 0.040004,
    "gateway_price_usd": 0.012002,
    "cheaper": "gateway",
    "note": "the same capability costs less through this gateway than through its own direct route."
  }
}
```

Read the last block. The gateway tells you when its own direct route costs more than going
through it. A buyer who discovers an overcharge on the first call does not come back, so we
would rather say it up front and lose the margin.

## What a paid call actually returns

`POST /v1/us/brief` at $0.040004 gives a briefing on a US public company, built from SEC
EDGAR. Here is a real response for `AAPL`, trimmed to fit:

```json
{
  "query": "AAPL",
  "brief": {
    "summary": "Apple Inc. (CIK 0000320193, Nasdaq: AAPL) is a California-incorporated Electronic Computers company. Data shows net income of $112.01B for FY ending 2025-09-27, total assets $359.241B, total liabilities $285.508B, and stockholders' equity $73.733B.",
    "key_points": [
      "Net income for the period ending 2025-09-27 was $112,010,000,000 [financials].",
      "Total assets as of 2025-09-27 were $359,241,000,000 [financials].",
      "The most recent EDGAR deposit shown is a Form 4 dated 2026-09-17 [filings]."
    ],
    "open_questions": [
      "Revenue data provided is only for FY2018 periods; no revenue figures for later periods are available in the data.",
      "The data does not include a website, business description, or segment detail for Apple Inc."
    ]
  },
  "identity": { "cik": "0000320193", "name": "Apple Inc.", "exchanges": ["Nasdaq"], "sic": "Electronic Computers" },
  "financials": { "net_income": [{ "end": "2025-09-27", "value": 112010000000, "fy": 2025 }] },
  "filings": [{ "form": "4", "date": "2026-09-17", "accession": "0001140361-26-037020" }]
}
```

The block worth reading is `open_questions`. Recent revenue is missing from Apple's annual
XBRL facts, so the answer states that instead of inventing a number. Every claim in
`key_points` carries its origin, and the underlying `identity`, `financials` and `filings`
come back alongside so you can check the summary against them rather than trust it.

Buying the three underlying routes separately costs $0.090024: `/v1/us/company` at
$0.020010, `/v1/us/financials` at $0.050003 and `/v1/us/filings` at $0.020011.

## Price

Each route has its own amount, down to the last micro-dollar. That is deliberate: the amount
alone identifies the route on-chain, so settlements are attributable without any extra
metadata.

| route | price | what it does |
|---|---|---|
| `POST /v1/us/brief` | $0.040004 | SEC briefing on a US public company |
| `POST /v1/agent/task` | $0.012800 | an objective and a budget, several capabilities, one payment |
| `POST /v1/solve` | $0.012002 | one endpoint for any capability below |
| `POST /v1/understand` | $0.010002 | a page and a question, a verified answer |
| `POST /v1/llm/pro` | $0.006 | text generation, full output budget |
| `POST /v1/render` | $0.005003 | full HTML after JavaScript execution |
| `POST /v1/extract` | $0.005 | a page as clean markdown, real browser, French residential IP |
| `GET /v1/search/news` | $0.003001 | fresh headlines |
| `GET /v1/search` | $0.003 | ranked web results |
| `POST /v1/llm` | $0.002 | text generation, bounded output |

`GET /v1/capabilities` lists what is servable right now, with input and output schemas.

## Payment

x402, `exact` scheme, USDC on Base (`eip155:8453`) and Solana. Working Node example:

```js
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);

const payFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const r = await payFetch("https://api.x-402.online/v1/us/brief", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ticker: "AAPL" }),
});

const brief = await r.json();
console.log(brief.brief.summary);
```

Two things worth knowing, both measured rather than assumed.

Your wallet needs USDC and **no ETH**. Payment uses EIP-3009 `transferWithAuthorization`:
you sign, the facilitator submits the transaction and pays the gas. Settlement is
asynchronous, so reading your balance immediately after a successful call can still show the
old number.

No form of `wrapFetchWithPayment` accepts a spending cap. If you need one, enforce it in the
fetch you pass in, by parsing the `Payment-Required` header and refusing above your limit. A
cap you believe you have and do not is worse than no cap.

Without a payment-capable fetch you get the challenge itself:

```bash
curl -i -X POST https://api.x-402.online/v1/us/brief \
  -H 'content-type: application/json' -d '{"ticker":"AAPL"}'
# HTTP/1.1 402, header Payment-Required, base64 JSON
# accepts[0].amount is in atomic units: "40004" means 0.040004 USDC
```

That last line catches people out. Amounts in the runtime challenge are atomic units, while
`x-payment-info.price.amount` in the OpenAPI document is decimal dollars. Confusing the two
is a factor of one million.

## MCP

`/mcp` speaks JSON-RPC 2.0 and exposes every route as a tool.

```bash
curl -s -X POST https://api.x-402.online/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Also published to the MCP registry as `online.x-402/mcp`.

## Discovery, for machines

| surface | what it carries |
|---|---|
| `/openapi.json` | the full OpenAPI description, 65 paths |
| `/llms.txt` | a plain-text summary for language models |
| `/.well-known/x402` | x402 payment metadata for every route |
| `/.well-known/agent-card.json` | an A2A Agent Card, protocol 0.3.0 |
| `/mcp` | an MCP server, 65 tools |
| `/v1/capabilities` | the capability registry, free |

One caveat on the Agent Card, since a wrong card wastes an agent's time. A2A JSON-RPC
`message/send` is **not** served. The card says so in `a2aJsonRpc.served`, and each
`skills[].invocation` carries the method and the exact URL to call over HTTP+JSON instead.

## SDK

Optional. The API is plain HTTP and the SDK is a convenience, not a dependency.

```bash
npm install x402-agent-gateway      # Node 20+
pip install x402-agent-gateway      # Python 3.10+, no dependencies
```

```js
import { Gateway } from "x402-agent-gateway";
const g = new Gateway({ fetch: payFetch });
const r = await g.usBrief("AAPL");
```

```python
from x402_gateway import Gateway
r = Gateway().us_brief("AAPL")
print(r["brief"]["summary"])
```

Both live in this repository under `node/` and `python/`. Called without a payment-capable
fetch, `usBrief` raises `PaymentRequired` carrying the x402 challenge, so you can pay it with
whatever tooling you already have.

## What this is not

Not investment advice. `/v1/us/brief` reports what SEC EDGAR contains and cites it. It never
recommends buying or selling anything, and it puts what the filings do not answer in
`open_questions` rather than filling the gap with a guess.

MIT licensed.
