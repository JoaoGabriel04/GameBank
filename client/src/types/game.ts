// ========================
// Tipos base do jogo
// ========================

export interface Propriedade {
  id: number;
  nome: string;
  grupo_cor: CorPropriedade;
  tipo: 'normal' | 'ação';
  custo_compra: number;
  aluguel_base: number;
  aluguel_1c: number;
  aluguel_2c: number;
  aluguel_3c: number;
  aluguel_4c: number;
  aluguel_hotel: number;
  custo_casa: number;
  hipoteca: number;
}

// ========================
// Estado da sessão
// ========================

export interface SessionPropriedade {
  id: number;
  sessionId: number;
  possesId: number;
  playerId: number | null;
  casas: number;
  hipotecada: boolean;
  negociando?: boolean;
  posses?: {
    id: number;
    id_prop: number;
    casas: number;
    hipotecada: boolean;
    propriedade?: Propriedade;
  };
}

// ========================
// Jogador na sessão
// ========================

export interface Team {
  id: number;
  nome: string;
  cor: string;
  sessionId: number;
  saldo?: number;
}

export interface Player {
  id: number;
  userId?: number | null;
  nome: string;
  cor: PlayerColor;
  saldo: number;
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | null;
  banner?: string | null;
  spriteId?: string | null;
  badge?: string | null;
  badgeImageUrl?: string | null;
  posses: SessionPropriedade[];
  teamId?: number;
  team?: Team;
  carta_prisao?: boolean;
  desistiu?: boolean;
  patrimonyAtDesistir?: number | null;
}

export interface SorteRevesCard {
  id: number;
  texto: string;
  tipo: "ganhar_dinheiro" | "perder_dinheiro" | "receber_jogadores" | "pagar_jogadores" | "carta_prisao" | "prisao";
  valor: number;
}

// ========================
// Transações
// ========================

export interface Transacao {
  id: number;
  data: Date;
  tipo: string;
  detalhes: string;
  sessionId?: string;
}

// ========================
// Sessão do jogo
// ========================

export interface GameSession {
  id: number;
  nome?: string;
  modo?: 'individual' | 'duplas';
  status?: 'Esperando' | 'Em Andamento' | 'Finalizada';
  protegida?: boolean;
  maxJogadores?: number;
  saldoInicial?: number;
  ownerId?: number | null;
  jogadores: Player[];
  times?: Team[];
  sessionPosses: SessionPropriedade[];
  historico: Transacao[];
  debts?: Debt[];
  dataInicio: number;
}

// ========================
// Cores dos jogadores
// ========================

export type PlayerColor = 
  | 'red' 
  | 'blue' 
  | 'green' 
  | 'yellow' 
  | 'purple' 
  | 'black'
  | 'orange'
  | 'pink'
  | 'emerald'
  | 'zinc'

export const PLAYER_COLORS: { value: PlayerColor; label: string; bg: string; border: string; text: string }[] = [
  { value: 'red', label: 'Vermelho', bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
  { value: 'blue', label: 'Azul', bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
  { value: 'green', label: 'Verde', bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
  { value: 'yellow', label: 'Amarelo', bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-500' },
  { value: 'purple', label: 'Roxo', bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
  { value: 'black', label: 'Preto', bg: 'bg-black', border: 'border-black', text: 'text-black' },
  { value: 'orange', label: 'Laranja', bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500' },
  { value: 'pink', label: 'Rosa', bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-500' },
  { value: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-500' },
  { value: 'zinc', label: 'Espectador', bg: 'bg-zinc-500', border: 'border-zinc-500', text: 'text-zinc-400' },
];

// ========================
// Cores das propriedades
// ========================

export type CorPropriedade =
  | 'Verde-Claro'
  | 'Verde-Escuro'
  | 'Vermelho'
  | 'Azul'
  | 'Amarelo'
  | 'Laranja'
  | 'Rosa'
  | 'Roxo'
  | 'Preto'

export const PROPERTY_COLORS: { value: CorPropriedade; text: string; label: string; bg: string, border: string; total: number }[] = [
  { value: 'Verde-Claro', text: 'text-lime-500', label: 'Verde-Claro', bg: 'bg-lime-500', border: 'border-lime-500', total: 3 },
  { value: 'Vermelho', text: 'text-red-600', label: 'Vermelho', bg: 'bg-red-600', border: 'border-red-600', total: 3},
  { value: 'Azul', text: 'text-blue-600', label: 'Azul', bg: 'bg-blue-600', border: 'border-blue-600', total: 3},
  { value: 'Rosa', text: 'text-pink-600', label: 'Rosa', bg: 'bg-pink-600', border: 'border-pink-600', total: 2},
  { value: 'Roxo', text: "text-purple-700", label: 'Roxo', bg: 'bg-purple-700', border: 'border-purple-700', total: 2},
  { value: 'Verde-Escuro', text: 'text-green-700', label: 'Verde-Escuro', bg: 'bg-green-700', border: 'border-green-700', total: 3},
  { value: 'Laranja', text: 'text-orange-600', label: 'Laranja', bg: 'bg-orange-600', border: 'border-orange-600', total: 3},
  { value: 'Amarelo', text: 'text-amber-300', label: 'Amarelo', bg: 'bg-amber-300', border: 'border-amber-300', total: 3},
  { value: 'Preto', text: 'text-zinc-50', label: 'Preto', bg: 'bg-zinc-50', border: 'border-zinc-50', total: 6},
];

// ========================
// Configurações do jogo
// ========================

export const INITIAL_BALANCE = 25000;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;

export interface RankedPlayer {
  position: number
  player: { id: number; nome: string; cor?: string; userId?: number | null; desistiu?: boolean; avatarUrl?: string | null; avatarUpdatedAt?: string | null; banner?: string | null; spriteId?: string | null; badge?: string | null; badgeImageUrl?: string | null }
  patrimony: number
  xpEarned: number
  coinsEarned: number
  penaltyReason?: string | null
  breakdown?: string[]
}

// ========================
// Chat
// ========================

export interface ChatMessage {
  id: number;
  playerId: number;
  playerNome: string;
  texto: string;
  createdAt: string;
}

// ========================
// Notificações
// ========================

export interface NegotiationItem {
  id: number;
  negotiationId: number;
  sessionPossesId: number | null;
  fromSide: boolean;
  valor: number | null;
}

export interface Negotiation {
  id: number;
  sessionId: number;
  fromPlayerId: number;
  toPlayerId: number;
  status: "pendente" | "aceita" | "recusada" | "expirada";
  createdAt: string;
  expiresAt: string | null;
  respondedAt: string | null;
  items: NegotiationItem[];
  fromPlayer?: Player;
  toPlayer?: Player;
}

export interface GameNotification {
  id: number;
  sessionId: number;
  tipo: string;
  fromPlayerId: number;
  toPlayerId: number;
  sessionPossesId: number;
  status: string;
  createdAt: string;
  respondedAt?: string;
  fromPlayer?: Player;
  toPlayer?: Player;
}

// ========================
// Dívidas
// ========================

export interface Debt {
  id: number;
  sessionId: number;
  playerId: number;
  valor: number;
  descricao: string;
  pago: boolean;
  createdAt: string;
  paidAt: string | null;
  player?: { id: number; nome: string };
}
