// Tests du SDK, contre un faux gateway local. Pas de reseau, pas de paiement, donc le
// comportement sur 402 et sur panne se teste pour de vrai plutot que de s'esperer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Gateway, PaymentRequired, GatewayError } from "../src/index.js";

let reponse = { code: 200, corps: { ok: true } };
let vus = [];

const faux = createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    vus.push({ url: req.url, method: req.method, body: b ? JSON.parse(b) : null, cle: req.headers["x-api-key"] || null });
    res.statusCode = reponse.code;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(reponse.corps));
  });
});
const port = await new Promise((r) => faux.listen(0, "127.0.0.1", () => r(faux.address().port)));
const g = new Gateway({ baseUrl: `http://127.0.0.1:${port}` });
const avant = () => { vus = []; };

test("une chaine simple devient { task }", async () => {
  avant();
  reponse = { code: 200, corps: { quote: { capability: "web_search" } } };
  await g.preview("cherche le prix du btc");
  assert.equal(vus[0].url, "/v1/solve/preview");
  assert.deepEqual(vus[0].body, { task: "cherche le prix du btc" });
});

test("un objet passe tel quel", async () => {
  avant();
  await g.solve({ capability: "llm_generate", input: { prompt: "p" } });
  assert.deepEqual(vus[0].body, { capability: "llm_generate", input: { prompt: "p" } });
  assert.equal(vus[0].url, "/v1/solve");
});

test("capabilities est un GET sans corps", async () => {
  avant();
  reponse = { code: 200, corps: { capabilities: [] } };
  await g.capabilities();
  assert.equal(vus[0].method, "GET");
  assert.equal(vus[0].body, null);
});

test("un 402 leve PaymentRequired en PORTANT le defi", async () => {
  avant();
  const defi = { x402Version: 2, accepts: [{ network: "eip155:8453", amount: "12002", payTo: "0xabc" }] };
  reponse = { code: 402, corps: defi };
  await assert.rejects(
    () => g.solve("une tache"),
    (e) => {
      assert.ok(e instanceof PaymentRequired);
      assert.equal(e.status, 402);
      assert.equal(e.accepts.length, 1);
      assert.equal(e.accepts[0].amount, "12002");
      return true;
    },
  );
});

test("une erreur du gateway porte son message et son corps", async () => {
  avant();
  reponse = { code: 400, corps: { erreur: "entree_incomplete", manquants: ["url"] } };
  await assert.rejects(
    () => g.solve({ capability: "web_extract", input: {} }),
    (e) => {
      assert.ok(e instanceof GatewayError);
      assert.equal(e.message, "entree_incomplete");
      assert.deepEqual(e.body.manquants, ["url"]);
      return true;
    },
  );
});

test("une reponse illisible ne fait pas planter le SDK", async () => {
  avant();
  const brut = createServer((_q, s) => { s.statusCode = 500; s.end("<html>panne</html>"); });
  const p = await new Promise((r) => brut.listen(0, "127.0.0.1", () => r(brut.address().port)));
  const g2 = new Gateway({ baseUrl: `http://127.0.0.1:${p}` });
  await assert.rejects(() => g2.solve("x"), (e) => {
    assert.ok(e instanceof GatewayError);
    assert.equal(e.status, 500);
    assert.match(String(e.body), /panne/);
    return true;
  });
  brut.close();
});

test("la cle interne part dans l en-tete quand elle est fournie", async () => {
  avant();
  reponse = { code: 200, corps: {} };
  await new Gateway({ baseUrl: `http://127.0.0.1:${port}`, apiKey: "k" }).solve("x");
  assert.equal(vus[0].cle, "k");
});

test("une demande invalide est refusee avant tout appel reseau", async () => {
  avant();
  await assert.rejects(() => g.solve(42), (e) => e instanceof GatewayError);
  assert.deepEqual(vus, []);
});

test.after(() => faux.close());
