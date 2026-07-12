// Catálogo de eventos econômicos (Mecânica 2, ver MECANICA_EVENTOS_ECONOMICOS.md).
// Puro — sem dependência de Prisma — para poder ser importado tanto por
// turno.service.ts quanto por propriedade.service.ts sem risco de import
// circular entre os dois módulos.

export type EventoEfeito = {
  /** Multiplicador aplicado ao aluguel cobrado nesta rodada. */
  aluguelMult?: number;
  /** Multiplicador aplicado ao IPTU na passagem pelo Início. */
  iptuMult?: number;
  /** Multiplicador aplicado à manutenção na passagem pelo Início. */
  manutencaoMult?: number;
  /** Multiplicador aplicado à renda passiva na passagem pelo Início. */
  rendaPassivaMult?: number;
  /** Multiplicador aplicado ao custo de construir casas. */
  custoConstrucaoMult?: number;
  /** Multiplicador aplicado ao rendimento das ações (grupo Preto). */
  acoesMult?: number;
  /** Crédito imediato a todos os jogadores ao iniciar a rodada. */
  creditoImediato?: number;
  /** Multiplicador aplicado aos juros de empréstimo. */
  jurosMult?: number;
};

export type EventoDef = {
  codigo: string;
  nome: string;
  descricao: string; // o que acontece
  dica: string; // como reagir (mostrar no aviso)
  icone: string; // emoji
  cor: "verde" | "vermelho" | "amarelo" | "azul"; // tom do evento
  efeito: EventoEfeito;
};

export const EVENTOS: EventoDef[] = [
  {
    codigo: "CRISE_IMOBILIARIA",
    nome: "Crise Imobiliária",
    descricao: "Os aluguéis despencam. Ninguém quer alugar.",
    dica: "Aluguéis caem 50%. Se você vive de aluguel, aperte o cinto.",
    icone: "📉", cor: "vermelho",
    efeito: { aluguelMult: 0.5 },
  },
  {
    codigo: "BOOM_IMOBILIARIO",
    nome: "Boom Imobiliário",
    descricao: "O mercado está aquecido. Todos querem alugar.",
    dica: "Aluguéis sobem 50%. Bom momento para ter propriedades desenvolvidas.",
    icone: "📈", cor: "verde",
    efeito: { aluguelMult: 1.5 },
  },
  {
    codigo: "IPTU_EXTRAORDINARIO",
    nome: "IPTU Extraordinário",
    descricao: "A prefeitura dobrou o imposto sobre imóveis.",
    dica: "IPTU dobra nesta rodada. Hipotecar o que não usa pode salvar seu caixa.",
    icone: "🏛️", cor: "vermelho",
    efeito: { iptuMult: 2 },
  },
  {
    codigo: "ISENCAO_FISCAL",
    nome: "Isenção Fiscal",
    descricao: "O governo isentou o IPTU nesta rodada.",
    dica: "IPTU zerado. Momento ideal para segurar patrimônio.",
    icone: "🎁", cor: "verde",
    efeito: { iptuMult: 0 },
  },
  {
    codigo: "ESCASSEZ_MATERIAL",
    nome: "Escassez de Material",
    descricao: "Faltam materiais. Construir ficou caro.",
    dica: "Construção custa +50%. Se ia construir, talvez espere.",
    icone: "🚧", cor: "vermelho",
    efeito: { custoConstrucaoMult: 1.5 },
  },
  {
    codigo: "AQUECIMENTO_MERCADO",
    nome: "Aquecimento do Mercado",
    descricao: "Materiais em promoção. Construir ficou barato.",
    dica: "Construção custa -30%. Ótima hora para desenvolver.",
    icone: "🔨", cor: "verde",
    efeito: { custoConstrucaoMult: 0.7 },
  },
  {
    codigo: "INFLACAO",
    nome: "Inflação",
    descricao: "Os custos de manter imóveis dispararam.",
    dica: "Manutenção +50%. Muitas casas podem virar prejuízo.",
    icone: "💸", cor: "vermelho",
    efeito: { manutencaoMult: 1.5 },
  },
  {
    codigo: "RECESSAO",
    nome: "Recessão",
    descricao: "A economia parou. Nenhuma renda passiva nesta rodada.",
    dica: "Renda passiva zerada. Ter caixa é essencial.",
    icone: "🏚️", cor: "vermelho",
    efeito: { rendaPassivaMult: 0 },
  },
  {
    codigo: "DIVIDENDOS",
    nome: "Dividendos Extraordinários",
    descricao: "As empresas distribuíram lucros excepcionais.",
    dica: "Ações rendem o dobro. Quem investiu em ações se dá bem.",
    icone: "💹", cor: "verde",
    efeito: { acoesMult: 2 },
  },
  {
    codigo: "INJECAO_LIQUIDEZ",
    nome: "Injeção de Liquidez",
    descricao: "O banco central injetou dinheiro na economia.",
    dica: "Todos recebem R$ 1.000 imediatamente.",
    icone: "💰", cor: "verde",
    efeito: { creditoImediato: 1000 },
  },
  {
    codigo: "ALTA_JUROS",
    nome: "Alta de Juros",
    descricao: "O banco central subiu a taxa básica.",
    dica: "Juros de empréstimo dobram nesta rodada. Quite dívidas antes.",
    icone: "📊", cor: "vermelho",
    efeito: { jurosMult: 2 },
  },
  {
    codigo: "CORTE_JUROS",
    nome: "Corte de Juros",
    descricao: "O banco central reduziu a taxa básica.",
    dica: "Juros caem pela metade. Bom momento para pegar empréstimo.",
    icone: "📉", cor: "verde",
    efeito: { jurosMult: 0.5 },
  },
];

/** Quantas rodadas o evento ativo dura, uma vez sorteado. */
export const EVENTO_DURACAO_RODADAS = 2;

/** Ciclo completo: 1 rodada de aviso + EVENTO_DURACAO_RODADAS rodadas ativas. */
export const EVENTO_CICLO_RODADAS = EVENTO_DURACAO_RODADAS + 1;

export function getEvento(codigo: string | null | undefined): EventoDef | null {
  if (!codigo) return null;
  return EVENTOS.find(e => e.codigo === codigo) ?? null;
}

/** Sorteia um evento diferente do atual (evita repetir em sequência). */
export function sortearEvento(excluir?: string | null): EventoDef {
  const pool = EVENTOS.filter(e => e.codigo !== excluir);
  return pool[Math.floor(Math.random() * pool.length)];
}
