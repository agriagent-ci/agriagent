#!/usr/bin/env python3
"""Serveur de démo AgriAgent : statique (dist/ Vite) + proxy vers l'API FastAPI.

Pourquoi un proxy plutôt qu'un appel direct à http://IP:8000 depuis le navigateur :
la page est aussi servie en HTTPS via le tunnel Cloudflare, et un appel vers une URL
http:// depuis une page https:// est bloqué (contenu mixte). En passant par /chat et
/api/* sur la même origine, ça marche en HTTP comme en HTTPS, sans CORS.

- sert /home/hermes/agriagent-frontend/dist
- /chat, /chat/stream, /api/* -> relais vers http://127.0.0.1:8000, en flux (SSE)
- toute autre route inconnue -> index.html (navigation côté client)
- aucun privilège requis (port > 1024)
"""
import http.client
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = "/home/hermes/agriagent-frontend/dist"
PORT = 8080
HOST = "0.0.0.0"

API_HOTE = "127.0.0.1"
API_PORT = 8000
API_DELAI = 300  # secondes : le modèle peut réfléchir un moment

ENTETES_A_IGNORER = {"host", "connection", "content-length", "transfer-encoding", "keep-alive"}


def est_api(chemin: str, methode: str = "POST") -> bool:
    """Le chat est en POST (/chat, /chat/stream) ; /api/* et /meteo/* sont réservés au backend.
    Un GET sur /chat ou /meteo doit servir l'application (lien direct à partager), pas l'API.

    /meteo/* manquait : le navigateur recevait index.html (repli SPA) au lieu du JSON des
    prévisions, et l'onglet Météo restait vide dans le frontend publié sur Lovable.
    """
    if chemin.startswith("/api"):
        return True
    if chemin == "/meteo" or chemin.startswith("/meteo/"):
        return True
    if methode == "POST":
        return chemin == "/chat" or chemin.startswith("/chat/")
    return False


class SPAHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ── statique ────────────────────────────────────────────────────────────
    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path) and not os.path.exists(
            os.path.join(path, "index.html")
        ):
            # route côté client (ex. /dashboard) -> index.html
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        # En-têtes de sécurité : Lovable ne permet pas de les régler, ce serveur si.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "geolocation=(self), camera=(self), microphone=()")
        self.send_header("Content-Security-Policy", (
            "default-src 'self'; script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' data: https://fonts.gstatic.com; "
            "img-src 'self' data: blob: https:; connect-src 'self' https:; "
            "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        ))
        if self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    # ── proxy ───────────────────────────────────────────────────────────────
    def _relayer(self, methode: str):
        longueur = int(self.headers.get("Content-Length") or 0)
        corps = self.rfile.read(longueur) if longueur else None

        entetes = {
            cle: valeur
            for cle, valeur in self.headers.items()
            if cle.lower() not in ENTETES_A_IGNORER
        }
        entetes["Content-Length"] = str(len(corps or b""))

        try:
            connexion = http.client.HTTPConnection(API_HOTE, API_PORT, timeout=API_DELAI)
            connexion.request(methode, self.path, body=corps, headers=entetes)
            reponse = connexion.getresponse()
        except Exception as e:  # API arrêtée ou injoignable
            message = f"API AgriAgent injoignable ({e}).".encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)
            return

        self.send_response(reponse.status)
        for cle, valeur in reponse.getheaders():
            if cle.lower() in ENTETES_A_IGNORER:
                continue
            self.send_header(cle, valeur)
        # Réponse sans Content-Length : on relaie au fil de l'eau, la fin de la
        # connexion signalant la fin du corps (indispensable pour le streaming SSE).
        self.send_header("Connection", "close")
        self.end_headers()

        try:
            while True:
                morceau = reponse.read(2048)
                if not morceau:
                    break
                self.wfile.write(morceau)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass  # le navigateur a fermé l'onglet
        finally:
            connexion.close()
            self.close_connection = True

    def do_POST(self):
        if est_api(self.path, "POST"):
            return self._relayer("POST")
        self.send_error(405, "Méthode non autorisée")

    def do_GET(self):
        if est_api(self.path, "GET"):
            return self._relayer("GET")
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_OPTIONS(self):
        if est_api(self.path):
            return self._relayer("OPTIONS")
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    if not os.path.isdir(ROOT):
        sys.exit(f"dist introuvable: {ROOT} (lance d'abord npm run build)")
    handler = partial(SPAHandler, directory=ROOT)
    httpd = ThreadingHTTPServer((HOST, PORT), handler)
    print(
        f"static server up on http://{HOST}:{PORT} (root={ROOT}, /chat et /api -> "
        f"{API_HOTE}:{API_PORT})",
        flush=True,
    )
    httpd.serve_forever()
