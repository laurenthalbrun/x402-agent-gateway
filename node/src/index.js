// SDK Node du Universal Agent Gateway.
//
// Objectif : première intégration en moins de cinq minutes. Donc trois fonctions, aucune
// dépendance obligatoire, et le paiement optionnel.
//
// Choix qui compte : `preview` et `capabilities` sont GRATUITS et ne demandent aucun
// portefeuille. Un développeur doit pouvoir installer, appeler, voir le plan et le prix,
// et décider ensuite. Un SDK qui exige une clé ou un portefeuille avant de montrer quoi
// que ce soit se fait désinstaller.

const DEFAUT = "https://api.x-402.online";

export class GatewayError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.body = body;
  }
}

/** Levée quand la route répond 402 et qu'aucun moyen de paiement n'a été fourni.
 *  Elle porte le défi tel quel : le montant, le réseau et l'adresse sont dedans, donc un
 *  agent peut payer avec son propre outillage sans que ce SDK impose le sien. */
export class PaymentRequired extends GatewayError {
  constructor(challenge) {
    super("payment required", { status: 402, body: challenge });
    this.name = "PaymentRequired";
    this.challenge = challenge;
    this.accepts = challenge && challenge.accepts ? challenge.accepts : [];
  }
}

export class Gateway {
  /**
   * @param {object} [opts]
   * @param {string} [opts.baseUrl]   par défaut https://api.x-402.online
   * @param {Function} [opts.fetch]   un fetch qui sait payer x402 (par ex. @x402/fetch).
   *                                  Sans lui, `solve` lève PaymentRequired avec le défi.
   * @param {string} [opts.apiKey]    clé interne, pour les appels qui ne passent pas par x402
   * @param {number} [opts.timeoutMs] 60 s par défaut ; certaines capacités prennent 12 s
   */
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl || DEFAUT).replace(/\/+$/, "");
    this.fetch = opts.fetch || globalThis.fetch;
    this.apiKey = opts.apiKey || null;
    this.timeoutMs = opts.timeoutMs || 60000;
  }

  async #appel(chemin, { method = "POST", body } = {}) {
    const headers = { "content-type": "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    const r = await this.fetch(`${this.baseUrl}${chemin}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const txt = await r.text();
    let j = null;
    try { j = JSON.parse(txt); } catch { /* laisse j a null */ }
    if (r.status === 402) throw new PaymentRequired(j);
    if (!r.ok) {
      throw new GatewayError(
        (j && (j.error || j.erreur)) || `HTTP ${r.status}`,
        { status: r.status, body: j ?? txt.slice(0, 400) },
      );
    }
    return j;
  }

  // Les trois méthodes sont `async` pour une raison précise, trouvée par un test : sans
  // ça, une demande malformée levait de façon SYNCHRONE pendant que tout le reste
  // rejetait une promesse. Un appelant qui fait `.catch()` n'attrape pas un throw
  // synchrone, et son programme s'arrête là où il croyait avoir géré l'erreur. Une API
  // qui échoue de deux façons différentes selon l'erreur est un piège.

  /** Le registre : ce que le gateway sait faire, avec les schémas et le prix. Gratuit. */
  async capabilities() {
    return this.#appel("/v1/capabilities", { method: "GET" });
  }

  /** Le devis : quelle capacité, quelle entrée normalisée, quel prix, et si une route
   *  directe est moins chère. Gratuit, n'exécute rien, ne consomme aucun amont. */
  async preview(demande) {
    return this.#appel("/v1/solve/preview", { body: normaliser(demande) });
  }

  /** L'exécution. Sans fetch payeur, lève PaymentRequired en portant le défi x402. */
  async solve(demande) {
    return this.#appel("/v1/solve", { body: normaliser(demande) });
  }

  // ===== Appels directs, pour qui sait déjà ce qu'il veut =====================
  //
  // Le gateway devine la capacité à partir d'une tâche en mots simples, ce qui est
  // pratique quand on ne sait pas. Quand on sait, deviner est du travail inutile et,
  // à prix unique, le gateway coûte plus cher que la route directe. Ces méthodes
  // appellent donc la route, et le SDK le dit plutôt que de pousser vers le gateway.

  /** Identité d'une société cotée américaine, depuis SEC EDGAR. 0,02001 $. */
  async usCompany(tickerOuCik) {
    if (!tickerOuCik) throw new GatewayError("usCompany attend un ticker ou un CIK");
    return this.#appel("/v1/us/company", { body: { ticker: String(tickerOuCik) } });
  }

  /** Briefing sourcé sur une société cotée américaine : synthèse dont chaque affirmation
   *  cite son origine, plus l'identité, les comptes annuels et les dépôts récents en clair
   *  pour vérification. 0,040004 $, contre 0,090024 $ si on achète les trois séparément. */
  async usBrief(tickerOuCik) {
    if (!tickerOuCik) throw new GatewayError("usBrief attend un ticker ou un CIK");
    return this.#appel("/v1/us/brief", { body: { ticker: String(tickerOuCik) } });
  }
}

/** Accepte `solve("une tâche")` aussi bien que `solve({ capability, input })`. */
function normaliser(d) {
  if (typeof d === "string") return { task: d };
  if (d && typeof d === "object") return d;
  throw new GatewayError("demande invalide : une chaîne ou { task } ou { capability, input }");
}

/** Raccourci sans instanciation, pour le cas le plus courant. */
export function gateway(opts) {
  return new Gateway(opts);
}

export default Gateway;
