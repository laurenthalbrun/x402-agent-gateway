#!/usr/bin/env node
// CLI du gateway. Trois verbes, et le devis est celui qu'on tape en premier parce qu'il
// est gratuit : on voit le plan et le prix avant de sortir un portefeuille.

import { Gateway, PaymentRequired, GatewayError } from "../src/index.js";

const args = process.argv.slice(2);
const verbe = args[0];
const reste = args.slice(1);

function opt(nom, defaut) {
  const i = reste.indexOf(`--${nom}`);
  if (i === -1) return defaut;
  const v = reste[i + 1];
  reste.splice(i, 2);
  return v;
}

const base = opt("url", process.env.GATEWAY_URL);
const cle = opt("key", process.env.GATEWAY_API_KEY);
const json = reste.includes("--json") && reste.splice(reste.indexOf("--json"), 1);
const g = new Gateway({ baseUrl: base, apiKey: cle });

const AIDE = `agent-gateway — une intégration pour toutes les capacités

  agent-gateway capabilities              ce que le gateway sait faire (gratuit)
  agent-gateway preview "<tâche>"         le plan et le prix, sans exécuter (gratuit)
  agent-gateway solve   "<tâche>"         exécute et livre (x402)

Options
  --capability <nom>   impose la capacité au lieu de la deviner
  --input '<json>'     l'entrée, quand on impose la capacité
  --url <base>         défaut https://api.x-402.online  (ou GATEWAY_URL)
  --key <clé>          clé interne, pour un accès sans x402  (ou GATEWAY_API_KEY)
  --json               sortie brute, pour un script`;

function demande() {
  const cap = opt("capability", null);
  if (cap) {
    const brut = opt("input", "{}");
    let input;
    try { input = JSON.parse(brut); }
    catch { sortir(`--input n'est pas du JSON valide : ${brut}`); }
    return { capability: cap, input };
  }
  const tache = reste.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!tache) sortir("il faut une tâche, ou --capability avec --input");
  return { task: tache };
}

function sortir(msg, code = 1) {
  console.error(`erreur : ${msg}`);
  process.exit(code);
}

try {
  if (!verbe || verbe === "help" || verbe === "--help" || verbe === "-h") {
    console.log(AIDE);
    process.exit(0);
  }

  if (verbe === "capabilities") {
    const r = await g.capabilities();
    if (json) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
    console.log(`prix par solve : ${r.price_per_solve_usd} $ · paiement ${r.payment.protocol} ${r.payment.asset}\n`);
    for (const c of r.capabilities) {
      console.log(`  ${c.capability.padEnd(20)} ${String(c.providers).padStart(2)} provider(s) · ~${c.latency_ms_estimee} ms`);
      console.log(`  ${" ".repeat(20)} ${c.description}`);
    }
    process.exit(0);
  }

  if (verbe === "preview") {
    const r = await g.preview(demande());
    if (json) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
    const q = r.quote;
    console.log(`capacité   ${q.capability}`);
    console.log(`pourquoi   ${q.why_this_capability}`);
    console.log(`entrée     ${JSON.stringify(q.normalized_input)}`);
    console.log(`prix       ${q.price_usd} $  (${q.payment.amount_micro} micro-USDC)`);
    console.log(`providers  ${q.providers_in_order.join(" puis ")}`);
    console.log(`exécutera  ${q.will_execute}${q.refused_because ? ` — ${q.refused_because}` : ""}`);
    if (q.cheaper_direct) {
      console.log(`\nmoins cher en direct : ${q.cheaper_direct.route} à ${q.cheaper_direct.price_usd} $ (${q.cheaper_direct.you_save_usd} $ économisés)`);
      console.log(`  ${q.cheaper_direct.note}`);
    }
    process.exit(0);
  }

  if (verbe === "solve") {
    const r = await g.solve(demande());
    if (json) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
    console.log(`capacité ${r.capability} · ${r.routing.provider} · ${r.routing.latency_ms} ms`);
    if (r.routing.attempts.length > 1) {
      console.log(`tentatives : ${r.routing.attempts.map((a) => `${a.provider}${a.ok ? " ok" : " échec"}`).join(" | ")}`);
    }
    console.log("");
    console.log(JSON.stringify(r.result, null, 2));
    process.exit(0);
  }

  sortir(`verbe inconnu « ${verbe} »\n\n${AIDE}`);
} catch (e) {
  if (e instanceof PaymentRequired) {
    console.error("paiement requis. Le défi x402 :");
    for (const a of e.accepts) console.error(`  ${a.network} · ${a.amount} (micro-USDC) · vers ${a.payTo}`);
    console.error("\nUtilise « preview » pour voir le plan sans payer, ou passe un fetch payeur au SDK.");
    process.exit(2);
  }
  if (e instanceof GatewayError) {
    console.error(`erreur : ${e.message}`);
    if (e.body) console.error(JSON.stringify(e.body, null, 2));
    process.exit(1);
  }
  throw e;
}
