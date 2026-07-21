// Eventos econômicos do GameBank 2D (tipoJogo=mapa2d), Fatia 2.
// Domínio separado de eventos.ts (Modo Tabuleiro) — sem efeito
// regional/setorial nesta fatia (GDD Seção 7), só mercado.

export type EventoMapa2DEfeito = {
  mercadoMult?: number;         // multiplica o aluguel recomendado
  inflacaoIncremento?: number;  // soma à inflação acumulada da partida
  custoConstrucaoMult?: number;
  jurosMult?: number;
};

export type EventoMapa2DDef = {
  codigo: string;
  nome: string;
  descricao: string;
  dica: string;
  cor: "verde" | "vermelho" | "amarelo" | "azul";
  efeito: EventoMapa2DEfeito;
};

export const EVENTOS_MAPA2D: EventoMapa2DDef[] = [
  { codigo: "BOOM_IMOBILIARIO", nome: "Boom Imobiliário",
    descricao: "O mercado está aquecido.", dica: "Aluguéis sobem 35%. Bom mês para construir.",
    cor: "verde", efeito: { mercadoMult: 1.35 } },
  { codigo: "RECESSAO", nome: "Recessão",
    descricao: "A economia esfriou.", dica: "Aluguéis caem 45%. Reprecifique antes de perder ocupação.",
    cor: "vermelho", efeito: { mercadoMult: 0.55 } },
  { codigo: "INFLACAO_ALTA", nome: "Inflação Alta",
    descricao: "Os preços sobem em geral.", dica: "Inflação acumulada aumenta — custos futuros sobem.",
    cor: "vermelho", efeito: { inflacaoIncremento: 0.08 } },
  { codigo: "ESCASSEZ_MATERIAL", nome: "Escassez de Material",
    descricao: "Construir ficou mais caro.", dica: "Custo de construção +40% neste mês.",
    cor: "vermelho", efeito: { custoConstrucaoMult: 1.4 } },
  { codigo: "AQUECIMENTO_CONSTRUCAO", nome: "Aquecimento da Construção Civil",
    descricao: "Materiais em promoção.", dica: "Custo de construção -25% neste mês.",
    cor: "verde", efeito: { custoConstrucaoMult: 0.75 } },
  { codigo: "ALTA_JUROS", nome: "Alta de Juros",
    descricao: "Crédito mais caro.", dica: "Juros de empréstimo dobram neste mês.",
    cor: "vermelho", efeito: { jurosMult: 2.0 } },
  { codigo: "CORTE_JUROS", nome: "Corte de Juros",
    descricao: "Crédito mais barato.", dica: "Juros de empréstimo caem à metade. Bom mês para alavancar.",
    cor: "verde", efeito: { jurosMult: 0.5 } },
];

export const EVENTO_MAPA2D_INTERVALO_MESES = 2;

export function getEventoMapa2D(codigo?: string | null) {
  return EVENTOS_MAPA2D.find(e => e.codigo === codigo) ?? null;
}

export function sortearEventoMapa2D(excluir?: string | null) {
  const pool = EVENTOS_MAPA2D.filter(e => e.codigo !== excluir);
  return pool[Math.floor(Math.random() * pool.length)];
}
