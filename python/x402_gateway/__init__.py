"""SDK Python du Universal Agent Gateway.

Meme contrat que le SDK Node, et les memes choix.

`capabilities()` et `preview()` sont GRATUITS et ne demandent aucun portefeuille. Un
developpeur doit pouvoir installer, appeler, voir le plan et le prix, puis decider. Un SDK
qui exige une cle avant de montrer quoi que ce soit se fait desinstaller.

Aucune dependance obligatoire : `urllib` de la bibliotheque standard suffit. On accepte une
fonction `transport` pour brancher un client qui sait payer x402, sans imposer le notre.
"""

from __future__ import annotations

import json as _json
import urllib.error
import urllib.request
from typing import Any, Callable, Mapping

__all__ = ["Gateway", "GatewayError", "PaymentRequired"]

DEFAUT = "https://api.x-402.online"


class GatewayError(Exception):
    def __init__(self, message: str, status: int | None = None, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


class PaymentRequired(GatewayError):
    """402. Porte le defi tel quel : montant, reseau et adresse sont dedans, donc un agent
    peut payer avec son propre outillage."""

    def __init__(self, challenge: Any):
        super().__init__("payment required", 402, challenge)
        self.challenge = challenge
        self.accepts = (challenge or {}).get("accepts", []) if isinstance(challenge, dict) else []


def _transport_par_defaut(url: str, method: str, headers: Mapping[str, str],
                          body: bytes | None, timeout: float) -> tuple[int, str]:
    req = urllib.request.Request(url, data=body, headers=dict(headers), method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        # Un 402 n'est pas une panne : c'est la reponse attendue quand on n'a pas paye.
        return e.code, e.read().decode("utf-8")


class Gateway:
    def __init__(self, base_url: str | None = None, api_key: str | None = None,
                 timeout: float = 60.0,
                 transport: Callable[..., tuple[int, str]] | None = None):
        self.base_url = (base_url or DEFAUT).rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.transport = transport or _transport_par_defaut

    def _appel(self, chemin: str, method: str = "POST", body: Any = None) -> Any:
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        brut = None if body is None else _json.dumps(body).encode("utf-8")
        status, texte = self.transport(f"{self.base_url}{chemin}", method, headers, brut, self.timeout)
        try:
            j = _json.loads(texte)
        except ValueError:
            j = None
        if status == 402:
            raise PaymentRequired(j)
        if status >= 400:
            msg = (j or {}).get("error") or (j or {}).get("erreur") or f"HTTP {status}"
            raise GatewayError(msg, status, j if j is not None else texte[:400])
        return j

    def capabilities(self) -> Any:
        """Le registre : ce que le gateway sait faire. Gratuit."""
        return self._appel("/v1/capabilities", "GET")

    def preview(self, demande: str | Mapping[str, Any]) -> Any:
        """Le devis : capacite, entree normalisee, prix, et si une route directe est moins
        chere. Gratuit, n'execute rien, ne consomme aucun amont."""
        return self._appel("/v1/solve/preview", "POST", _normaliser(demande))

    def solve(self, demande: str | Mapping[str, Any]) -> Any:
        """L'execution. Sans transport payeur, leve PaymentRequired avec le defi x402."""
        return self._appel("/v1/solve", "POST", _normaliser(demande))

    # --- Appels directs, pour qui sait deja ce qu'il veut --------------------
    # Le gateway devine la capacite a partir d'une tache en mots simples, ce qui est
    # pratique quand on ne sait pas. Quand on sait, deviner est du travail inutile et,
    # a prix unique, le gateway coute plus cher que la route directe.

    def us_company(self, ticker_ou_cik: str) -> Any:
        """Identite d'une societe cotee americaine, depuis SEC EDGAR. 0,02001 $."""
        if not ticker_ou_cik:
            raise GatewayError("us_company attend un ticker ou un CIK")
        return self._appel("/v1/us/company", "POST", {"ticker": str(ticker_ou_cik)})

    def us_brief(self, ticker_ou_cik: str) -> Any:
        """Briefing source sur une societe cotee americaine : synthese dont chaque
        affirmation cite son origine, plus l'identite, les comptes annuels et les depots
        recents en clair. 0,040004 $, contre 0,090024 $ pour les trois routes separement."""
        if not ticker_ou_cik:
            raise GatewayError("us_brief attend un ticker ou un CIK")
        return self._appel("/v1/us/brief", "POST", {"ticker": str(ticker_ou_cik)})


def _normaliser(d: str | Mapping[str, Any]) -> dict:
    if isinstance(d, str):
        return {"task": d}
    if isinstance(d, Mapping):
        return dict(d)
    raise GatewayError("demande invalide : une chaine, ou {'task': ...}, ou {'capability', 'input'}")
