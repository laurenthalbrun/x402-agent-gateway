# Read a page your scraper cannot reach

Your crawler gets a 403, a CAPTCHA, or an empty shell where the content should be. The site
blocks datacenter IPs, or the content only exists after JavaScript runs.

This endpoint fetches the page through a **French residential IP driving a real Chromium**,
then returns the main content as clean markdown. One call, one payment, no account.

API: `https://api.x-402.online` · Repository: https://github.com/laurenthalbrun/x402-agent-gateway

## Input

```json
{ "url": "https://example.com" }
```

`POST https://api.x-402.online/v1/extract`. Also works as `GET /v1/extract?url=...`.

## Output

```json
{
  "url": "https://x402.org",
  "title": "x402",
  "markdown": "…the main content, navigation and advertising stripped…",
  "lang": "en"
}
```

Four fields. No model runs in this path, so there is nothing to hallucinate and no
generation variance: the same page returns the same extraction.

Measured on 2026-09-21, three real calls: **3.8 s, 4.1 s, 6.0 s**, returning 167, 10 734 and
11 973 characters of markdown.

## Price

`0.005` USDC per call. Every route on this API has its own amount down to the last
micro-dollar, so a settlement is attributable on-chain by the amount alone.

## The flow

```bash
# free: what the route takes and returns, with its price
curl -s https://api.x-402.online/v1/capabilities | grep -A6 web_extract

# unpaid: the 402 challenge carries the exact amount
curl -i -X POST https://api.x-402.online/v1/extract \
  -H 'content-type: application/json' -d '{"url":"https://example.com"}'
# HTTP/1.1 402 · Payment-Required · accepts[0].amount = "5000" (atomic units = 0.005 USDC)
```

Pay it and retry with the payment header. Your wallet needs USDC and **no ETH**: the payment
is an EIP-3009 authorization, so the facilitator submits the transaction and pays the gas.
See [examples/node.mjs](examples/node.mjs) for a working payment, including a spending cap
that the x402 library does not provide.

## When you need the HTML instead

`POST /v1/render` at `0.005003` returns the complete HTML after JavaScript execution, same
egress, same browser. Use it when you need the DOM rather than readable text.

`GET /v1/extract-structured` at `0.015` takes a URL plus the fields you want and returns
exactly those fields as JSON, using a model on top of the same extraction.

## What this is not

Not a proxy you can point anywhere: it returns the readable content of one URL, not raw
socket access. Not an archive: each call fetches live. Not a bypass for authentication or
paywalls, and it respects what the page actually serves to a normal browser.
