# Universal Agent Gateway — SDK

Un endpoint pour toutes les capacités. L'agent envoie une tâche, le gateway choisit la
capacité, classe les providers par marge nette attendue et fiabilité observée, exécute,
replie si un provider tombe, et livre.

Le devis est gratuit et n'exécute rien. Commence par là.

## Node

```bash
npm install x402-agent-gateway
```

```js
import { Gateway } from "x402-agent-gateway";

const g = new Gateway();

// Gratuit : le plan et le prix, avant tout paiement.
const { quote } = await g.preview("résume les actualités sur les ETF ethereum");
console.log(quote.capability, quote.price_usd, quote.cheaper_direct);

// Payant : passe un fetch qui sait régler x402.
const r = await g.solve("résume les actualités sur les ETF ethereum");
console.log(r.result, r.routing.provider);
```

Sans fetch payeur, `solve` lève `PaymentRequired`, qui **porte le défi x402** : montant,
réseau et adresse. Tu payes avec ton propre outillage, le SDK ne t'impose pas le sien.

## Python

```bash
pip install x402-agent-gateway
```

```python
from x402_gateway import Gateway, PaymentRequired

g = Gateway()
print(g.preview("résume les actualités sur les ETF ethereum")["quote"])

try:
    print(g.solve("lis https://example.com")["result"])
except PaymentRequired as e:
    print(e.accepts)   # le défi x402, pour payer comme tu veux
```

Aucune dépendance : `urllib` de la bibliothèque standard suffit.

## CLI

```bash
npx x402-agent-gateway capabilities
npx x402-agent-gateway preview "résume les actualités sur ethereum"
npx x402-agent-gateway solve   "lis https://example.com"
```

## Ce que le devis te dit, et que personne d'autre ne te dira

Le gateway a un prix unique, donc il coûte plus cher qu'une route directe quand la capacité
demandée est bon marché. Le devis te l'annonce, avec le montant économisé :

```
moins cher en direct : /v1/search à 0.003 $ (0.009002 $ économisés)
```

Le gateway vaut sa prime quand tu as besoin de plusieurs capacités, pas d'une seule. Autant
que tu le saches avant de payer plutôt qu'après.

## Capacités servies

`web_search`, `news_search`, `news_brief`, `llm_generate`, `web_extract`, `web_render`,
`company_lookup_fr`. `GET /v1/capabilities` rend les schémas d'entrée et de sortie, et
n'annonce que ce qui est réellement servable dans l'environnement interrogé.

## Paiement

x402, schéma `exact`, USDC sur Base et Solana. Le montant identifie la route, donc chaque
règlement est vérifiable sur la chaîne.
