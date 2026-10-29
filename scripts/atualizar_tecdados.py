"""Coleta notícias de dados e tecnologia (para as "Conexões do dia") e grava tecdados.json.

Fonte: Google Notícias em português, uma busca por tema (Python, SQL, Power BI, IA, engenharia de dados…).
Fica só o que é dos últimos 7 dias, sem repetir manchete. Usa apenas a biblioteca padrão do Python.
"""
import json
import os
import re
import urllib.parse
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

from atualizar_noticias import baixar, chave

BUSCAS = [
    "ciência de dados", "análise de dados", "engenharia de dados", "inteligência artificial generativa",
    "machine learning", "Python dados", "SQL banco de dados", "Power BI", "business intelligence",
    "estatística dados", "computação em nuvem dados", "metodologias ágeis",
]
POR_BUSCA, LIMITE = 8, 80
ARQ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tecdados.json")


def main():
    agora = datetime.now(timezone.utc)
    vistos, saida = set(), []
    for busca in BUSCAS:
        url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(f'"{busca}" when:7d') + "&hl=pt-BR&gl=BR&ceid=BR:pt-419"
        try:
            raiz = ElementTree.fromstring(baixar(url))
        except Exception as e:  # uma busca fora do ar não derruba as outras
            print("falhou", busca, e)
            continue
        n = 0
        for item in raiz.iter("item"):
            titulo = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            try:
                data = parsedate_to_datetime(item.findtext("pubDate") or "")
            except Exception:
                continue
            if data.tzinfo is None:
                data = data.replace(tzinfo=timezone.utc)
            if not titulo or not link or agora - data > timedelta(days=7):
                continue
            m = re.match(r"^(.*)\s+-\s+([^-]+)$", titulo)
            titulo, fonte = (m.group(1).strip(), m.group(2).strip()) if m else (titulo, (item.findtext("source") or "Google Notícias").strip())
            k = chave(titulo)
            if k in vistos:
                continue
            vistos.add(k)
            saida.append({"t": titulo, "u": link, "f": fonte, "d": data.astimezone(timezone.utc).isoformat(), "b": busca})
            n += 1
            if n >= POR_BUSCA:
                break
    saida.sort(key=lambda x: x["d"], reverse=True)
    saida = saida[:LIMITE]
    try:
        with open(ARQ, encoding="utf-8") as f:
            if [x["u"] for x in json.load(f).get("noticias", [])] == [x["u"] for x in saida]:
                print("sem notícias novas")
                return
    except (OSError, ValueError):
        pass
    with open(ARQ, "w", encoding="utf-8") as f:
        json.dump({"coletado": agora.isoformat(), "noticias": saida}, f, ensure_ascii=False, indent=0)
    print(len(saida), "notícias")


if __name__ == "__main__":
    main()
