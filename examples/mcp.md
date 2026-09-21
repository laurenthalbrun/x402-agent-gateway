# Calling this API as an MCP server

`https://api.x-402.online/mcp` speaks JSON-RPC 2.0 and exposes every route as a tool, 65 of
them. It is also published in the MCP registry as `online.x-402/mcp`.

Repo: https://github.com/laurenthalbrun/x402-agent-gateway

## List the tools, free

```bash
curl -s -X POST https://api.x-402.online/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The company tools are `us_brief` (premium, `{ticker}`) and `solve` (primitive, `{task}`).

## Call the premium brief

```bash
curl -s -X POST https://api.x-402.online/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"us_brief","arguments":{"ticker":"AAPL"}}}'
```

Unpaid, this returns `isError: true` with the challenge carried in `_meta`:

```json
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "content": [{ "type": "text",
      "text": "Payment required: $0.040004 for us_brief. Sign the USDC x402 payment for the requirements in _meta[\"x402/paymentRequired\"], then retry this tools/call with the X-PAYMENT header on your POST /mcp." }],
    "isError": true,
    "_meta": { "x402/paymentRequired": { "x402Version": 2, "accepts": [{ "scheme": "exact", "network": "eip155:8453", "amount": "40004", "…": "…" }] } }
  }
}
```

Sign that challenge, then retry the same `tools/call` with an `X-PAYMENT` header on the
`POST /mcp` request. The payment sits on the HTTP request, not inside the JSON-RPC body.

## Client configuration

```json
{
  "mcpServers": {
    "x402-agent-gateway": {
      "type": "http",
      "url": "https://api.x-402.online/mcp"
    }
  }
}
```

## How this differs from the free SEC MCP servers

Several open-source SEC EDGAR MCP servers exist, and they are free. You run them yourself,
you hold the process, and you do the summarising in your own context.

This one is hosted and paid per call. Nothing to install, no account, no key, and the
synthesis, the XBRL metrics, the resolvable source objects and the citation check come back
in the response. Which trade you want depends on whether you would rather run a process or
pay `0.040004` for an answer.
