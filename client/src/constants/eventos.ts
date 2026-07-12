// Espelho de server/src/constants/eventos.ts — mantenha em sync. Usado
// para exibição (banner, modal, badge) e para refletir os multiplicadores
// nos valores mostrados na UI (aluguel, custo de construção). O sorteio
// e a aplicação real acontecem sempre no servidor.

export type EventoEfeito = {
  aluguelMult?: number;
  iptuMult?: number;
  manutencaoMult?: number;
  rendaPassivaMult?: number;
  custoConstrucaoMult?: number;
  acoesMult?: number;
  creditoImediato?: number;
};

export type EventoDef = {
  codigo: string;
  nome: string;
  descricao: string;
  dica: string;
  icone: string;
  cor: "verde" | "vermelho" | "amarelo" | "azul";
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
];

export function getEvento(codigo: string | null | undefined): EventoDef | null {
  if (!codigo) return null;
  return EVENTOS.find(e => e.codigo === codigo) ?? null;
}
