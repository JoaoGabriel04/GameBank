import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // directUrl: conexão SEM pooler (Neon pooler não suporta advisory locks)
    // Em produção (Render), defina DIRECT_URL com a URL não-pooled
    ...(process.env.DIRECT_URL ? { directUrl: env('DIRECT_URL') } : {}),
  },
})
