"""Atualiza vagas.json com vagas de Análise de Dados e BI do portal Mentora Dados.

Regras do Rayner:
- áreas "Análise de Dados / BI" e "Inteligência de Negócios", sem vagas de RPA/automação;
- remotas de qualquer lugar; presenciais ou híbridas só na cidade de São Paulo ou em Sorocaba;
- publicadas há menos de 2 meses.

Roda todo dia pelo GitHub Actions (.github/workflows/vagas.yml). Só usa a biblioteca padrão do Python.
O portal entrega as vagas da mais nova para a mais antiga, então a leitura para quando chega às de 2 meses.
"""
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request

AJAX = "https://mentoradados.com/wp-admin/admin-ajax.php"
PORTAL = "https://mentoradados.com/portal-de-vagas-v2/"
AREAS = {"Análise de Dados / BI", "Inteligência de Negócios"}
NAO_BI = re.compile(r"RPA|Power Automate|Power Platform|Automa[çc][ãa]o|PowerPoint|Dynamics|UiPath|Hiperautoma", re.I)
CAPITAL = re.compile(r"S[ãa]o Paulo|Sorocaba|Vila Ol[ií]mpia|Santo Amaro|Pinheiros|Faria Lima|Paulista", re.I)
OUTRAS_SP = re.compile(r"S[ãa]o Bernardo|S[ãa]o Jos[eé]|S[ãa]o Caetano|S[ãa]o Carlos", re.I)
MAX_DIAS = 60
UA = "Mozilla/5.0 (DiaADiaRAC; atualizacao diaria de vagas pessoais)"
TZ = dt.timezone(dt.timedelta(hours=-3))


def pagina(n):
    corpo = urllib.parse.urlencode({"action": "mentora_get_vagas", "paged": n, "search": ""}).encode()
    req = urllib.request.Request(AJAX, data=corpo, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read().decode("utf-8"))
    if not d.get("success"):
        raise RuntimeError("o portal respondeu sem sucesso: %r" % str(d)[:200])
    return d["data"]


def dias_atras(ddmm, hoje):
    """'23/10' -> dias desde a publicação (o portal não manda o ano)."""
    m = re.match(r"(\d{1,2})/(\d{1,2})", ddmm or "")
    if not m:
        return 999
    d, mes = int(m.group(1)), int(m.group(2))
    try:
        quando = dt.date(hoje.year, mes, d)
    except ValueError:
        return 999
    if quando > hoje:
        quando = dt.date(hoje.year - 1, mes, d)
    return (hoje - quando).days


def local_da_descricao(conteudo):
    texto = html.unescape(re.sub(r"<[^>]+>", "\n", conteudo or ""))
    m = re.search(r"Local(?:idade)?:\s*([^\n]+)", texto)
    return m.group(1).strip()[:90] if m else ""


def aceita(v, onde):
    if not AREAS.intersection(v.get("area") or []):
        return False
    if NAO_BI.search(v.get("titulo", "")):
        return False
    if v.get("modelo") == "Remoto":
        return True
    if OUTRAS_SP.search(onde) and not re.search(r"S[ãa]o Paulo", onde):
        return False
    return bool(CAPITAL.search(onde))


def link_aplicar(v):
    ap = (v.get("link_aplicacao") or "").strip()
    m = re.match(r"^https?://([^/@]+@[^/]+)/?$", ap)
    if m:
        return "mailto:" + m.group(1)
    if not ap or re.match(r"^https?://\(", ap):
        return v.get("permalink") or PORTAL
    return ap


def main():
    hoje = dt.datetime.now(TZ).date()
    vagas, vistos, n = [], set(), 1
    while True:
        d = pagina(n)
        lista = d.get("vagas") or []
        idades = []
        for v in lista:
            dias = dias_atras(v.get("data"), hoje)
            idades.append(dias)
            if dias >= MAX_DIAS:
                continue
            onde = local_da_descricao(v.get("conteudo"))
            if not aceita(v, onde or v.get("cidade", "")):
                continue
            chave = (v.get("titulo", "").lower(), (v.get("empresa") or "").lower())
            if chave in vistos:
                continue
            vistos.add(chave)
            nivel = (v.get("nivel") or [""])[0]
            vagas.append({
                "id": str(v.get("id")),
                "t": v.get("titulo", "").strip(),
                "e": (v.get("empresa") or "").strip(),
                "m": v.get("modelo", ""),
                "cidade": "" if v.get("modelo") == "Remoto" else (onde or v.get("cidade", "")),
                "nv": nivel,
                "s": (v.get("salario") or "").strip(),
                "a": v.get("data_relativa", ""),
                "d": dias,
                "ap": link_aplicar(v),
                "or": v.get("link_original") or "",
                "pl": v.get("permalink") or "",
            })
        total_pag = d.get("total_paginas") or n
        # a lista vem da mais nova para a mais antiga: para quando a página inteira já passou de 2 meses
        if not lista or n >= total_pag or (idades and min(idades) >= MAX_DIAS):
            break
        n += 1
        time.sleep(1.5)  # gentileza com o servidor do portal

    if not vagas:
        print("nenhuma vaga encontrada; mantendo o vagas.json anterior", file=sys.stderr)
        return 1
    vagas.sort(key=lambda v: v["d"])
    saida = {
        "fonte": PORTAL,
        "coletado": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "filtro": "Análise de Dados / BI e Inteligência de Negócios. Remoto de qualquer lugar; "
                  "presencial ou híbrido só em São Paulo ou Sorocaba. Publicadas há menos de 2 meses.",
        "paginas_lidas": n,
        "vagas": vagas,
    }
    with open("vagas.json", "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=0)
    print("%d vagas salvas (%d páginas lidas)" % (len(vagas), n))
    return 0


if __name__ == "__main__":
    sys.exit(main())
