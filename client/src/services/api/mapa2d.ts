import api from './index'

export type TipoConstrucaoMapa2D =
  | 'casa' | 'sobrado' | 'comercio' | 'apartamento'
  | 'centro_comercial' | 'hotel' | 'corporativo';

export interface TerrenoMapa2D {
  id: number;
  codigo: string;
  regiaoNome: string;
  categoria: 'comum' | 'mediana' | 'rica';
  multiplicador: number;
  precoBase: number;
}

export interface ConstrucaoMapa2D {
  id: number;
  tipo: TipoConstrucaoMapa2D;
  nivel: number;
  aluguelPedido: number;
  ocupado: boolean;
}

export interface SessionTerrenoMapa2D {
  id: number;
  terrenoId: number;
  donoId: number | null;
  precoPago: number | null;
  terreno: TerrenoMapa2D;
  construcao: ConstrucaoMapa2D | null;
}

export interface JogadorMapa2D {
  id: number;
  nome: string;
  cor: string;
  saldo: number;
  desistiu: boolean;
  userId: number | null;
}

export interface EstadoMapa2D {
  mesAtual: number;
  fecharMesEm: string | null;
  terrenos: SessionTerrenoMapa2D[];
  jogadores: JogadorMapa2D[];
  voceEId: number;
}

export const getEstadoMapa2DApi = (sessionId: number) =>
  api.get(`/mapa2d/${sessionId}/estado`).then(res => res.data as EstadoMapa2D);

export const comprarTerrenoMapa2DApi = (sessionId: number, terrenoId: number) =>
  api.post(`/mapa2d/${sessionId}/terreno/${terrenoId}/comprar`).then(res => res.data);

export const construirMapa2DApi = (sessionId: number, sessionTerrenoId: number, tipo: TipoConstrucaoMapa2D) =>
  api.post(`/mapa2d/${sessionId}/terreno/${sessionTerrenoId}/construir`, { tipo }).then(res => res.data);

export const precificarMapa2DApi = (sessionId: number, construcaoId: number, aluguelPedido: number) =>
  api.post(`/mapa2d/${sessionId}/construcao/${construcaoId}/precificar`, { aluguelPedido }).then(res => res.data);
