import api from './index'

export interface LimiteData {
  limite: number;
  garantia: { propId: number; nome: string; casas: number } | null;
  temEmprestimoAtivo: boolean;
  emprestimoAtivo: { valorDevido: number; valorOriginal: number } | null;
  jurosPct: number;
  projecao: { rodada: number; valor: number }[];
}

export const getLimiteApi = (sessionId: number) =>
  api.get(`/emprestimos/${sessionId}/limite`).then(res => res.data as LimiteData);

export const pegarEmprestimoApi = (sessionId: number, valor: number) =>
  api.post(`/emprestimos/${sessionId}/pegar`, { valor }).then(res => res.data);

export const quitarEmprestimoApi = (sessionId: number) =>
  api.post(`/emprestimos/${sessionId}/quitar`).then(res => res.data);
