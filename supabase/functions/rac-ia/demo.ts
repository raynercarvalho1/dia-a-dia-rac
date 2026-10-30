// RAC Intelligence: respostas simuladas do modo DEMO. Não fazem nenhuma chamada externa, não gravam nada no banco,
// não contam no orçamento e são marcadas em três lugares (modo "DEMO", resultado._demo e valores obviamente falsos).
// No site, uma resposta DEMO só aparece numa prévia de leitura: nunca entra nas telas que salvam (docs/rac-intelligence.md).

import { ACOES } from "./acoes.ts";
import type { Resposta } from "./contrato.ts";

const FIXTURES: Record<string, (ctx: Record<string, unknown>) => Record<string, unknown>> = {
  "abastecimento.interpretar": (ctx) => ({
    veiculo: ctx.veiculo_sugerido === "carro" ? "carro" : "moto", data: null, km: 0, litros: 1, preco_litro: 1, total: 1,
    combustivel: "gasolina", posto: "POSTO DEMONSTRAÇÃO", alertas: [],
  }),
  "mercado.nota": () => ({
    mercado: "MERCADO DEMONSTRAÇÃO", cnpj: null, data: null, numero: null, serie: null, chave: null, pagamento: "DEMONSTRAÇÃO",
    total_pago: 3, desconto_nota: 0,
    itens: [
      { descricao: "ITEM DE DEMONSTRAÇÃO 1", qtd: 1, un: "un", unitario: 1, total: 1, desconto: 0 },
      { descricao: "ITEM DE DEMONSTRAÇÃO 2", qtd: 2, un: "un", unitario: 1, total: 2, desconto: 0 },
    ],
  }),
};

export const AVISO_DEMO = "DEMONSTRAÇÃO: resposta simulada, não veio do Claude. Não pode ser salva.";

export function respostaDemo(acao: string, contexto: Record<string, unknown>, motivo: string, avisos: string[]): Resposta {
  const a = ACOES[acao], f = FIXTURES[acao];
  if (!a || !f) throw new Error("ação sem demonstração: " + acao);
  /* passa pela mesma validação do modo REAL, para testar o contrato de verdade */
  const v = a.validar(f(contexto), contexto);
  if (!v.ok) throw new Error("demonstração inválida para " + acao + ": " + v.motivo);
  return {
    ok: true, versao: 1, id: null, modulo: a.modulo, acao: a.id, modo: "DEMO", estado: "demo",
    resultado: { ...v.resultado, _demo: true },
    mensagem: AVISO_DEMO + (motivo ? " " + motivo : ""),
    avisos,
    consumo: { modelo: "nenhum (demonstração)", uso_api: null, reservado_usd: null, estimado_rac_usd: null, cobranca_efetiva: null, observacao: "Modo DEMO: nenhuma chamada paga." },
  };
}

export function temDemo(acao: string): boolean { return Object.prototype.hasOwnProperty.call(FIXTURES, acao); }
