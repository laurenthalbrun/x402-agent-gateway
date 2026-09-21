# Calling this API from an A2A agent

The Agent Card is at `https://api.x-402.online/.well-known/agent-card.json`, protocol
version 0.3.0, with 65 skills.

Repo: https://github.com/laurenthalbrun/x402-agent-gateway

## Read the card

```bash
curl -s https://api.x-402.online/.well-known/agent-card.json
```

## One caveat, stated up front

A2A JSON-RPC `message/send` is **not served**. The card says so in `a2aJsonRpc.served`, so a
client does not have to discover it by getting a 404.

What is served is HTTP+JSON, and every skill carries the exact call in its `invocation`
block. That is what to use.

```json
{
  "id": "us_brief",
  "description": "…",
  "invocation": { "type": "http", "method": "POST", "url": "https://api.x-402.online/v1/us/brief" },
  "input": { "ticker": "AAPL" },
  "pricing": { "amount": "$0.040004", "currency": "USDC", "protocol": "x402", "networks": ["eip155:8453"] }
}
```

## Pick the skill and call it

```bash
# find the company skills and their price
curl -s https://api.x-402.online/.well-known/agent-card.json \
 | python3 -c "
import json,sys
for s in json.load(sys.stdin)['skills']:
    if s['id'] in ('us_brief','solve'):
        print(s['id'], s['pricing']['amount'], s['invocation']['method'], s['invocation']['url'])"

# call it, unpaid, to get the challenge
curl -i -s -X POST https://api.x-402.online/v1/us/brief \
  -H 'content-type: application/json' -d '{"ticker":"AAPL"}' | sed -n '1,10p'
```

Then sign the x402 challenge and retry with the payment header. See `node.mjs` in this
directory for a working payment.
