# Primitive or premium, and how to choose

Two routes read the same SEC EDGAR core. They diverge after that. Both numbers below were
measured on 2026-09-21 against the live API, on AAPL.

|  | primitive | premium |
|---|---|---|
| call | `POST /v1/solve` with `company_core_us` | `POST /v1/us/brief` |
| price | `0.012002` USDC | `0.040004` USDC |
| upstream cost | 0 (no model in the path) | 0.000715 measured (1600 in, 791 out tokens) |
| latency | 697 ms | 3436 ms |
| response size | 2415 bytes | 9178 bytes |
| identity | 8 fields | the same 8 fields |
| annual financial series | 6 | the same 6 |
| filings returned | 8 most recent | window over all 1001 |
| sourced synthesis | no | yes, every claim tagged |
| EPS, operating income, operating cash flow | no | yes, read from XBRL |
| numbered source objects | no | 8, each resolving to an EDGAR URL |
| citation verification | no | yes, reports orphan references |

## When the primitive is the right call

You already know what to do with raw figures, you are summarising in your own context
anyway, and you want the answer in under a second. It is five times faster precisely because
no model runs in that path, which also means no generation variance between two identical
calls.

```bash
curl -i -s -X POST https://api.x-402.online/v1/solve \
  -H 'content-type: application/json' \
  -d '{"capability":"company_core_us","input":{"ticker":"AAPL"}}'
```

The primitive states what it is not. Its response carries `tier`, `contains`,
`does_not_contain` and `premium_route`, so an agent receiving facts without a synthesis does
not mistake it for a degraded answer.

## When the premium is worth 0.028002 more

You need a statement you can defend. The premium adds three XBRL metrics the primitive does
not compute, eight source objects that each resolve to a real EDGAR document, a `since`/`until`
window over the company's full filing index instead of the last eight, and a verification
block that reports whether every citation in the text resolves.

```bash
curl -i -s -X POST https://api.x-402.online/v1/us/brief \
  -H 'content-type: application/json' -d '{"ticker":"AAPL","since":"2026-06-01"}'
```

## What the premium does not pretend

A metric the company does not file comes back in `metrics_unavailable` with the reason.
JPMorgan does not report `OperatingIncomeLoss`, so for `JPM` that field is declared empty
instead of quietly disappearing.

Two enrichments were measured and rejected rather than shipped: parsed Form 4 insider
activity, because AAPL alone has 591 Form 4 filings and each needs its own HTTP call, and
stock price, because SEC EDGAR publishes no market data at all. The full measurement sheet,
including what each rejected feature would have cost, is free:

```bash
curl -s https://api.x-402.online/v1/us/brief/enrichments
```
