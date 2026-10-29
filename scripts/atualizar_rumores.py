"""Coleta os rumores da MLB (MLB Trade Rumors) para a página de Esportes e grava rumores.json.

Dois feeds: o geral da liga e o dos Dodgers. Fica o que é dos últimos 21 dias, sem repetir. Usa apenas a biblioteca padrão.
Falha de propósito (sai com erro) se os dois feeds vierem vazios ou quebrados: o GitHub avisa por e-mail.
"""
import gzip
import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

FEEDS = {
    "liga": "https://www.mlbtraderumors.com/feed",
    "dodgers": "https://www.mlbtraderumors.com/los-angeles-dodgers/feed",
}
DIAS = 21


def baixar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Dia a Dia RAC)", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=30) as r:
        dados = r.read()
        if r.headers.get("Content-Encoding") == "gzip" or dados[:2] == b"\x1f\x8b":
            dados = gzip.decompress(dados)
    return dados


def limpo(t, n=280):
    t = html.unescape(re.sub(r"<[^>]+>", " ", t or ""))
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s*The post .* appeared first on MLB Trade Rumors\.?$", "", t)
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def main():
    agora = datetime.now(timezone.utc)
    saida, falhas = {}, []
    for nome, url in FEEDS.items():
        itens = []
        try:
            raiz = ElementTree.fromstring(baixar(url))
        except Exception as e:  # um feed fora do ar não derruba o outro
            print("falhou", nome, e)
            falhas.append(nome)
            saida[nome] = []
            continue
        for item in raiz.iter("item"):
            titulo = html.unescape((item.findtext("title") or "").strip())
            link = (item.findtext("link") or "").strip()
            try:
                data = parsedate_to_datetime(item.findtext("pubDate") or "")
            except Exception:
                continue
            if data.tzinfo is None:
                data = data.replace(tzinfo=timezone.utc)
            if not titulo or not link or agora - data > timedelta(days=DIAS):
                continue
            tags = [html.unescape(c.text.strip()) for c in item.findall("category") if c.text]
            itens.append({"t": titulo, "link": link, "data": data.astimezone(timezone.utc).isoformat(), "resumo": limpo(item.findtext("description")), "tags": tags[:6]})
        saida[nome] = itens[:40]
        print(nome, len(itens))
    if not saida.get("liga") and not saida.get("dodgers"):
        print("Nenhum rumor coletado (feeds vazios ou quebrados).")
        sys.exit(1)
    with open("rumores.json", "w", encoding="utf-8") as f:
        json.dump({"coletado": agora.isoformat(), "fonte": "MLB Trade Rumors", "falhas": falhas, **saida}, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
