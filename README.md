# x402 Agent Gateway

**Pay-per-call APIs for AI agents, settled in USDC. No account, no API key.**

Two things agents buy here most:

| route | price | what you send | what you get back |
|---|---|---|---|
| `POST /v1/extract` | `0.005` | `{"url":"…"}` | the page as clean markdown, fetched through a French residential IP with a real Chromium, so sites that block datacenter IPs still answer |
| `POST /v1/us/brief` | `0.040004` | `{"ticker":"AAPL"}` | a sourced SEC EDGAR briefing with XBRL metrics, resolvable filing sources and a citation check |

Walkthroughs: **[EXTRACT.md](EXTRACT.md)** for web content, **[USE_CASE.md](USE_CASE.md)** for
company intelligence. Runnable calls in **[examples/](examples/)**.

---

**US company intelligence, in detail.**

| | |
|---|---|
| **what** | A decision-grade briefing on a US public company, built from SEC EDGAR |
| **why** | An agent can open a URL. It cannot open an account, confirm an email and add a card |
| **input** | `POST /v1/us/brief` with `{"ticker":"AAPL"}`, or a CIK, plus optional `since`/`until` |
| **output** | Sourced synthesis with per-claim origins, EPS and operating income and operating cash flow from XBRL, eight numbered source objects each resolving to an EDGAR URL, a filing window, and a verification block |
| **price** | `0.040004` USDC. Facts only, without the synthesis: `0.012002` |

Full walkthrough with a real response: **[USE_CASE.md](USE_CASE.md)**.
Runnable calls: **[examples/](examples/)** for curl, Node, Python, MCP and A2A.
Primitive against premium, measured: **[examples/primitive-vs-premium.md](examples/primitive-vs-premium.md)**.

---


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

## Find a capability without knowing its name

The catalogue has 80 routes in five families. You do not have to read them. Two free calls,
no wallet:

```bash
# the families, each with its job and its routes
curl -s https://api.x-402.online/v1/catalog

# your need in words, five best matches with price and whether each is buyable now
curl -s "https://api.x-402.online/v1/capabilities/search?query=find+current+prices+for+products+on+a+webpage"
```

| family | job |
|---|---|
| WEB INTELLIGENCE | turn any page into structured facts: prices, contacts, tables, declared data, changes |
| CONTENT ACCESS | read pages your crawler cannot, with or without a verdict on the retrieval |
| COMPANY INTELLIGENCE | know who a company is, what it filed, whether its domain and payments check out |
| VERIFICATION | check an email, a domain, an x402 endpoint or a wallet before acting on it |
| SEARCH | find pages and headlines, and read them in the same call |

Every route is described by the job it does, in an agent's words, on every surface: OpenAPI,
MCP, the A2A card, `llms.txt` and `/.well-known/x402`. A capability that is not available
yet comes back as `GAP`, never dressed up as an offer. Buyer counts shown are on-chain
measurements dated 2026-09-21, not forecasts.

## Fourteen routes added on 2026-09-21

Each one runs on an engine that already has paying buyers, has no model in its path, and
returns HTTP 402 with its own unique amount. Prices in USDC.

| route | price | what you get |
|---|---|---|
| `POST /v1/web/tables` | 0.005004 | every HTML table on a page as JSON rows, headers detected |
| `POST /v1/web/jsonld` | 0.005005 | the JSON-LD blocks and Open Graph tags a page declares |
| `POST /v1/web/contacts` | 0.006001 | emails, phones and social links visibly published on a page |
| `POST /v1/web/prices` | 0.006002 | every amount with its currency and context, plus the schema.org offer |
| `POST /v1/web/changed` | 0.005006 | has the page changed since the checksum you kept |
| `GET /v1/email/verify` | 0.003002 | syntax, MX, SPF, DMARC, disposable, role; no message sent |
| `GET /v1/domain/health` | 0.004001 | DNS records, certificate expiry, redirect chain, security headers |
| `GET /v1/x402/inspect` | 0.003003 | does an x402 endpoint still return a valid challenge, and what it says |
| `GET /v1/chain/address` | 0.004002 | USDC transfers of an address on Base, x402 settlements identified |
| `POST /v1/search/sources` | 0.012003 | search, then the main content of the top pages, in one call |
| `POST /v1/web/headings` | 0.004003 | the document outline: every heading with level and anchor |
| `POST /v1/web/forms` | 0.005007 | every form and its fields, read only, nothing submitted |
| `POST /v1/web/images` | 0.005008 | every image with resolved URL, alt text and dimensions |
| `POST /v1/web/navigation` | 0.004004 | header, footer and nav zones with their links |

The browser routes fetch through a French residential IP with a real Chromium. The DNS and
chain routes run from our infrastructure and say so. `email/verify` does not open an SMTP
session and states that mailbox existence is not checked.

## Routing engine, and a shadow experiment with Jev

Capability search is ranked by a deterministic engine: rarity-weighted terms, short
synonyms, two-word phrases, and a bonus for capabilities with measured buyers. It runs in
about one millisecond and needs no model. On a 119-case benchmark with hand-written ground
truth it puts the expected capability first 75 % of the time and in the top three 84 % of
the time, and holds the same accuracy when the candidate catalogue grows from 80 to 194.

In parallel, and off by default, the repository carries a shadow integration of
[Jev](https://typesafe.ai) as an alternative decision engine. With `JEV_SHADOW_MODE=true`
Jev is asked the same question beside the current engine and the two answers are compared
in metrics; it never decides and never blocks a request. The benchmark, the fixture and
the fallback tests are in the repository. No routing decision is taken by Jev today.

## What this is not

Not investment advice. `/v1/us/brief` reports what SEC EDGAR contains and cites it. It never
recommends buying or selling anything, and it puts what the filings do not answer in
`open_questions` rather than filling the gap with a guess.

MIT licensed.
