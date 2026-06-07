export type ApiErrShape = {
  response?: {
    data?: { message?: string; error?: string };
    status?: number;
  };
};

export function toApiErr(err: unknown): ApiErrShape {
  return err as ApiErrShape;
}

export function apiErrMsg(err: unknown, fallback = "Erro desconhecido"): string {
  const e = toApiErr(err);
  return e?.response?.data?.message ?? e?.response?.data?.error ?? fallback;
}
