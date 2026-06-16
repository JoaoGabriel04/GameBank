import api from './index'

export const bausApi = {
  listar:          ()                    => api.get("/baus"),
  abrir:           (tipo: string)        => api.post(`/baus/${tipo}/abrir`),
  abrirMultiplo:   (tipo: string, quantidade: number) => api.post(`/baus/${tipo}/abrir-multiplo`, { quantidade }),
  adquiridos:      ()                    => api.get("/baus/adquiridos"),
  abrirAdquirido:  (id: number)          => api.post(`/baus/adquiridos/${id}/abrir`),
}

export const getBausApi           = () => bausApi.listar().then(r => r.data)
export const abrirBauApi          = (tipo: string) => bausApi.abrir(tipo).then(r => r.data)
export const abrirBauMultiploApi  = (tipo: string, quantidade: number) => bausApi.abrirMultiplo(tipo, quantidade).then(r => r.data)
export const getBausAdquiridosApi = () => bausApi.adquiridos().then(r => r.data)
export const abrirBauAdquiridoApi = (id: number) => bausApi.abrirAdquirido(id).then(r => r.data)
