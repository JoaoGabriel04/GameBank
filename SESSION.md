sgp-client-dev     |  GET /sessions 200 in 74ms (next.js: 10ms, application-code: 64ms)
sgp-client-dev     |  GET /game/6 200 in 60ms (next.js: 25ms, application-code: 35ms)
sgp-db-dev         | 2026-05-30 01:41:01.778 UTC [291] ERROR:  update or delete on table "session_players" violates foreign key constraint "messages_playerId_fkey" on table "messages"
sgp-db-dev         | 2026-05-30 01:41:01.778 UTC [291] DETAIL:  Key (id)=(10) is still referenced from table "messages".
sgp-db-dev         | 2026-05-30 01:41:01.778 UTC [291] STATEMENT:  DELETE FROM "public"."session_players" WHERE ("public"."session_players"."id" = $1 AND 1=1) RETURNING "public"."session_players"."id", "public"."session_players"."sessionId", "public"."session_players"."userId", "public"."session_players"."nome", "public"."session_players"."cor", "public"."session_players"."saldo", "public"."session_players"."teamId", "public"."session_players"."carta_prisao"
sgp-server-dev     | PrismaClientKnownRequestError:
sgp-server-dev     | Invalid `tx.sessionPlayer.delete()` invocation in
sgp-server-dev     | /app/src/modules/session/session.service.ts:330:32
sgp-server-dev     |
sgp-server-dev     |   327   data: { saldo: 0 },
sgp-server-dev     |   328 });
sgp-server-dev     |   329
sgp-server-dev     | → 330 await tx.sessionPlayer.delete(
sgp-server-dev     | Foreign key constraint violated on the constraint: `messages_playerId_fkey`
sgp-server-dev     |     at zr.handleRequestError (/app/generated/prisma/runtime/client.js:69:8286)
sgp-server-dev     |     at zr.handleAndLogRequestError (/app/generated/prisma/runtime/client.js:69:7581)
sgp-server-dev     |     at zr.request (/app/generated/prisma/runtime/client.js:69:7288)
sgp-server-dev     |     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
sgp-server-dev     |     at async a (/app/generated/prisma/runtime/client.js:79:6862)
sgp-server-dev     |     at async <anonymous> (/app/src/modules/session/session.service.ts:330:9)
sgp-server-dev     |     at async Proxy._transactionWithCallback (/app/generated/prisma/runtime/client.js:79:4800)
sgp-server-dev     |     at async SessionService.quitSession (/app/src/modules/session/session.service.ts:315:7)
sgp-server-dev     |     at async quit_session (/app/src/modules/session/session.controller.ts:143:7) {
sgp-server-dev     |   code: 'P2003',
sgp-server-dev     |   meta: {
sgp-server-dev     |     modelName: 'SessionPlayer',
sgp-server-dev     |     driverAdapterError: DriverAdapterError: ForeignKeyConstraintViolation
sgp-server-dev     |         at PgTransaction.onError (file:///app/node_modules/@prisma/adapter-pg/dist/index.mjs:642:11)
sgp-server-dev     |         at PgTransaction.performIO (file:///app/node_modules/@prisma/adapter-pg/dist/index.mjs:637:12)
sgp-server-dev     |         at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
sgp-server-dev     |         at async PgTransaction.queryRaw (file:///app/node_modules/@prisma/adapter-pg/dist/index.mjs:568:30)
sgp-server-dev     |         at async e.interpretNode (/app/generated/prisma/runtime/client.js:15:44621)
sgp-server-dev     |         at async e.interpretNode (/app/generated/prisma/runtime/client.js:15:45065)
sgp-server-dev     |         at async e.interpretNode (/app/generated/prisma/runtime/client.js:15:43744)
sgp-server-dev     |         at async e.interpretNode (/app/generated/prisma/runtime/client.js:15:46285)
sgp-server-dev     |         at async e.run (/app/generated/prisma/runtime/client.js:15:43335)
sgp-server-dev     |         at async e.execute (/app/generated/prisma/runtime/client.js:61:815) {
sgp-server-dev     |       cause: [Object]
sgp-server-dev     |     }
sgp-server-dev     |   },
sgp-server-dev     |   clientVersion: '7.8.0'
sgp-server-dev     | }
sgp-client-dev     | [browser] [API] Error 500: { error: 'Erro ao sair da sala.' }
sgp-client-dev     |     at <unknown> (src/services/api/index.ts:62:15)
sgp-client-dev     |     at async confirmQuitInProgress (src/app/game/[sessionId]/page.tsx:152:7)
sgp-client-dev     |   60 |       })
sgp-client-dev     |   61 |     } else {
sgp-client-dev     | > 62 |       console.error('[API] Error ' + error.response.status + ':', error.response?.data || ...
sgp-client-dev     |      |               ^
sgp-client-dev     |   63 |     }
sgp-client-dev     |   64 |     return Promise.reject(error)
sgp-client-dev     |   65 |   } (src/services/api/index.ts:62:15)