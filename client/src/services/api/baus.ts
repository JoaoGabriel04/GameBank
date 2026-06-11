import api from './index'

export const bausApi = {
  listar:    ()           => api.get("/baus"),
  abrir:     (tipo: string) => api.post(`/baus/${tipo}/abrir`),
  historico: ()           => api.get("/baus/historico"),
}

export const getBausApi      = () => bausApi.listar().then(r => r.data)
export const abrirBauApi     = (tipo: string) => bausApi.abrir(tipo).then(r => r.data)
export const getBauHistorico = () => bausApi.historico().then(r => r.data)
