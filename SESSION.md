#13 2.219 npm notice
#13 DONE 2.4s
#14 [build 6/6] RUN npx tsc
#14 7.016 src/modules/admin/admin.service.ts(285,34): error TS2339: Property 'level' does not exist on type '{ id: number; nome: string; email: string; isAdmin: boolean; banned: boolean; bannedAt: Date | null; banReason: string | null; }'.
#14 7.016 src/modules/missions/missions.service.ts(91,22): error TS2339: Property 'coins' does not exist on type '{ level: number; xp: number; }'.
#14 7.016 src/modules/profile/profile.controller.ts(43,9): error TS2353: Object literal may only specify known properties, and 'banner' does not exist in type '{ nome?: string | undefined; avatarPreset?: string | undefined; fileBuffer?: Buffer<ArrayBufferLike> | undefined; fileMime?: string | undefined; }'.
#14 ERROR: process "/bin/sh -c npx tsc" did not complete successfully: exit code: 2
------
 > [build 6/6] RUN npx tsc:
7.016 src/modules/admin/admin.service.ts(285,34): error TS2339: Property 'level' does not exist on type '{ id: number; nome: string; email: string; isAdmin: boolean; banned: boolean; bannedAt: Date | null; banReason: string | null; }'.
7.016 src/modules/missions/missions.service.ts(91,22): error TS2339: Property 'coins' does not exist on type '{ level: number; xp: number; }'.
7.016 src/modules/profile/profile.controller.ts(43,9): error TS2353: Object literal may only specify known properties, and 'banner' does not exist in type '{ nome?: string | undefined; avatarPreset?: string | undefined; fileBuffer?: Buffer<ArrayBufferLike> | undefined; fileMime?: string | undefined; }'.
------
Dockerfile:13
--------------------
  11 |     ENV DATABASE_URL=$DATABASE_URL
  12 |     RUN npx prisma generate
  13 | >>> RUN npx tsc
  14 |     
  15 |     FROM node:22-alpine AS runner
--------------------
error: failed to solve: process "/bin/sh -c npx tsc" did not complete successfully: exit code: 2