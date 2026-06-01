// Types para Admin Console

export interface KPI {
  id: string;
  label: string;
  value: number;
  change: number;
  trend: "up" | "down" | "neutral";
  icon?: string;
}

export interface LiveSession {
  id: number;
  nome: string;
  modo: "individual" | "duplas";
  status: "Esperando" | "Em Andamento" | "Finalizada";
  jogadores: {
    id: number;
    nome: string;
    saldo: number;
    cor: string;
    avatarUrl?: string;
  }[];
  saldoTotal: number;
  duracao: number; // seconds
  ownerId?: number;
  dataInicio: number;
}

export interface AdminUser {
  id: number;
  nome: string;
  email: string;
  level: number;
  xp: number;
  coins: number;
  isAdmin: boolean;
  isBanned: boolean;
  avatarUrl?: string;
  totalGames: number;
  totalWins: number;
}

export interface ShopItem {
  id: number;
  name: string;
  description: string;
  type: "title" | "badge";
  price: number;
  icon: string;
  value: string;
  createdAt: string;
  sales?: number;
}

export interface GameCard {
  id: number;
  texto: string;
  tipo: "ganhar_dinheiro" | "perder_dinheiro" | "receber_jogadores" | "pagar_jogadores" | "carta_prisao" | "prisao";
  valor: number;
  baralho: "sorte" | "reves";
}

export interface Mission {
  id: number;
  name: string;
  description: string;
  metric: string;
  target: number;
  xpReward: number;
  coinReward: number;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  actorId: number;
  action: string;
  targetType: string;
  targetId?: number;
  details?: Record<string, any>;
}

export interface DashboardData {
  kpis: KPI[];
  chartData: {
    growth: Array<{ date: string; users: number; revenue: number }>;
    distribution: Array<{ name: string; value: number }>;
  };
  sessions: LiveSession[];
  activity: Array<{
    id: number;
    action: string;
    actor: string;
    timestamp: string;
  }>;
}

export interface EconomyConfig {
  initialBalance: number;
  xpMultiplier: number;
  coinMultiplier: number;
  houseCostMultiplier: number;
  flags?: {
    economyAffectedBySessionLength?: boolean;
    restrictTrading?: boolean;
  };
}
