// Pay for a premium company brief from Node. Verified against x402 v2, @x402/fetch 2.19.0.
//
//   npm i viem @x402/fetch @x402/evm
//   PRIVATE_KEY=0x... node node.mjs AAPL
//
// Your wallet needs USDC on Base and NO ETH: the payment is an EIP-3009
// `transferWithAuthorization`, so the facilitator submits the transaction and pays the gas.
//
// API: https://api.x-402.online · repo: https://github.com/laurenthalbrun/x402-agent-gateway
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const API = process.env.API ?? "https://api.x-402.online";
const ticker = process.argv[2] ?? "AAPL";

// ── free first: the quote tells you the price before you commit ──────────────
const devis = await fetch(`${API}/v1/solve/preview`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ task: `due diligence on ${ticker} from SEC filings` }),
}).then((r) => r.json());
console.log("quote:", devis.quote?.capability, devis.quote?.price_usd, "USDC");
console.log("premium alternative:", devis.quote?.premium_alternative?.route, devis.quote?.premium_alternative?.price_usd);

if (!process.env.PRIVATE_KEY) {
  console.log("\nno PRIVATE_KEY set, stopping before payment. The quote above is free.");
  process.exit(0);
}

const account = privateKeyToAccount(process.env.PRIVATE_KEY);

// ── a spending cap, because the library does not have one ────────────────────
//
// No form of wrapFetchWithPayment accepts a maximum. If you need one, enforce it in the
// fetch you pass in, by reading the challenge before the wrapper signs anything.
// A cap you believe you have and do not is worse than no cap.
const PLAFOND_USDC = 0.05;
const fetchPlafonne = async (url, opts) => {
  const r = await fetch(url, opts);
  if (r.status !== 402) return r;
  const entete = r.headers.get("payment-required");
  if (entete) {
    const defi = JSON.parse(Buffer.from(entete, "base64").toString("utf8"));
    const montant = Number(defi.accepts?.[0]?.amount ?? 0) / 1e6; // atomic → USDC
    if (montant > PLAFOND_USDC) throw new Error(`refus: ${montant} USDC dépasse le plafond de ${PLAFOND_USDC}`);
  }
  return r;
};

const payFetch = wrapFetchWithPaymentFromConfig(fetchPlafonne, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const r = await payFetch(`${API}/v1/us/brief`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ticker }),
});
if (!r.ok) { console.error("HTTP", r.status, await r.text()); process.exit(1); }

const d = await r.json();
console.log("\n", d.brief.summary);
for (const k of d.brief.key_points) console.log("  ·", k);
console.log("\nEPS", d.metrics.eps[0]?.value, "· operating cash flow", d.metrics.operating_cash_flow[0]?.value);
console.log("sources:", d.sources.length, "→", d.sources[0].url);
console.log("citations resolve:", d.verification.passe, `(${d.verification.numbered_refs_resolved}/${d.verification.numbered_refs})`);

// Settlement is ASYNCHRONOUS. Reading your balance right here can still show the old
// number; that is not a failed payment.
