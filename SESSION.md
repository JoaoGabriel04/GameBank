sgp-server-dev     | [Socket.IO] Redis adapter configurado
sgp-server-dev     | Servidor rodando na porta 7000!
sgp-client-dev     | [browser] Select is changing from uncontrolled to controlled. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.
sgp-client-dev     |  GET /game/3 200 in 88ms (next.js: 29ms, application-code: 59ms)
sgp-client-dev     |  GET /game/3 200 in 101ms (next.js: 38ms, application-code: 63ms)
sgp-client-dev     | [browser] Select is changing from uncontrolled to controlled. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.
sgp-client-dev     | [browser] [API] Error 400: { message: 'Esta propriedade está em negociação!' }
sgp-client-dev     |     at <unknown> (src/services/api/index.ts:62:15)
sgp-client-dev     |     at async buyHouse (src/stores/gameStore.ts:305:7)
sgp-client-dev     |     at async handleConfirm (src/components/PropertyDetailModal/index.tsx:74:7)
sgp-client-dev     |   60 |       })
sgp-client-dev     |   61 |     } else {
sgp-client-dev     | > 62 |       console.error('[API] Error ' + error.response.status + ':', error.response?.data || ...
sgp-client-dev     |      |               ^
sgp-client-dev     |   63 |     }
sgp-client-dev     |   64 |     return Promise.reject(error)
sgp-client-dev     |   65 |   } (src/services/api/index.ts:62:15)
sgp-client-dev     | [browser] [API] Error 400: { message: 'Esta propriedade está em negociação!' }
sgp-client-dev     |     at <unknown> (src/services/api/index.ts:62:15)
sgp-client-dev     |     at async buyHouse (src/stores/gameStore.ts:305:7)
sgp-client-dev     |     at async handleConfirm (src/components/PropertyDetailModal/index.tsx:74:7)
sgp-client-dev     |   60 |       })
sgp-client-dev     |   61 |     } else {
sgp-client-dev     | > 62 |       console.error('[API] Error ' + error.response.status + ':', error.response?.data || ...
sgp-client-dev     |      |               ^
sgp-client-dev     |   63 |     }
sgp-client-dev     |   64 |     return Promise.reject(error)
sgp-client-dev     |   65 |   } (src/services/api/index.ts:62:15)