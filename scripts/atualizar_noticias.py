"""Coleta as notícias de Sorocaba para a tela inicial e grava noticias.json.

Fontes: g1 Sorocaba e Jundiaí (RSS) e Google Notícias (busca "Sorocaba", que traz Cruzeiro do Sul e outros).
Fica só o que é das últimas 48 horas, sem repetir manchete. Usa apenas a biblioteca padrão do Python.
"""
import gzip
import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

FONTES = [
    ("g1", "https://g1.globo.com/rss/g1/sp/sorocaba-jundiai/"),
    ("google", "https://news.google.com/rss/search?q=Sorocaba+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419"),
]
LIMITE = 20


def baixar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Dia a Dia RAC)", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=30) as r:
        dados = r.read()
        if r.headers.get("Content-Encoding") == "gzip" or dados[:2] == b"\x1f\x8b":
            dados = gzip.decompress(dados)
    return dados


def chave(titulo):
    return re.sub(r"[^a-z0-9]+", " ", titulo.lower()).strip()


def main():
    agora = datetime.now(timezone.utc)
    vistos, saida = set(), []
    for nome, url in FONTES:
        try:
            raiz = ElementTree.fromstring(baixar(url))
        except Exception as e:  # uma fonte fora do ar não derruba a outra
            print("falhou", nome, e)
            continue
        for item in raiz.iter("item"):
            titulo = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            try:
                data = parsedate_to_datetime(item.findtext("pubDate") or "")
            except Exception:
                continue
            if data.tzinfo is None:
                data = data.replace(tzinfo=timezone.utc)
            if not titulo or not link or agora - data > timedelta(hours=48):
                continue
            fonte = "g1"
            if nome == "google":
                # o Google põe o veículo no fim do título: "Manchete - Jornal Cruzeiro do Sul"
                m = re.match(r"^(.*)\s+-\s+([^-]+)$", titulo)
                if m:
                    titulo, fonte = m.group(1).strip(), m.group(2).strip()
                else:
                    fonte = (item.findtext("source") or "Google Notícias").strip()
                # o g1 já vem direto da fonte dele
                if fonte.lower() == "g1":
                    continue
            if nome == "g1" and "sorocaba" not in (titulo + (item.findtext("description") or "")).lower():
                continue
            k = chave(titulo)
            if k in vistos:
                continue
            vistos.add(k)
            saida.append({"t": titulo, "u": link, "f": fonte, "d": data.astimezone(timezone.utc).isoformat()})
    saida.sort(key=lambda x: x["d"], reverse=True)
    # sem notícia nova o arquivo fica igual, para o robô não gravar uma versão nova à toa
    try:
        with open("noticias.json", encoding="utf-8") as f:
            if json.load(f).get("noticias") == saida[:LIMITE]:
                print("sem notícias novas")
                return
    except (OSError, ValueError):
        pass
    with open("noticias.json", "w", encoding="utf-8") as f:
        json.dump({"coletado": agora.isoformat(), "noticias": saida[:LIMITE]}, f, ensure_ascii=False, indent=1)
    print(len(saida[:LIMITE]), "notícias")


if __name__ == "__main__":
    main()
