import type { z } from 'zod';
import type { CreatePlayerSchema, EditPlayerSchema, PlayerColorEnum } from '../schemas/player.schema';
import type { CreateSessionSchema, JoinSessionSchema, CreateTeamSchema, StartSessionSchema } from '../schemas/session.schema';
import type { BuyPropSchema, HouseOperationSchema, TrocaPropSchema } from '../schemas/propriedade.schema';
import type { DepositoSaqueSchema, TransferenciaSchema, AluguelSchema, AluguelAcaoSchema, ReceberDeTodosSchema } from '../schemas/banco.schema';
import type { RegisterSchema, LoginSchema } from '../schemas/auth.schema';

export type PlayerColor = z.infer<typeof PlayerColorEnum>;
export type CreatePlayerInput = z.infer<typeof CreatePlayerSchema>;
export type EditPlayerInput = z.infer<typeof EditPlayerSchema>;
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type JoinSessionInput = z.infer<typeof JoinSessionSchema>;
export type StartSessionInput = z.infer<typeof StartSessionSchema>;
export type BuyPropInput = z.infer<typeof BuyPropSchema>;
export type HouseOperationInput = z.infer<typeof HouseOperationSchema>;
export type TrocaPropInput = z.infer<typeof TrocaPropSchema>;
export type DepositoSaqueInput = z.infer<typeof DepositoSaqueSchema>;
export type TransferenciaInput = z.infer<typeof TransferenciaSchema>;
export type AluguelInput = z.infer<typeof AluguelSchema>;
export type AluguelAcaoInput = z.infer<typeof AluguelAcaoSchema>;
export type ReceberDeTodosInput = z.infer<typeof ReceberDeTodosSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export type SessionStatus = 'Esperando' | 'Em Andamento' | 'Finalizada';
