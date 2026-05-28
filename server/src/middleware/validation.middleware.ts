import type { Request, Response, NextFunction } from "express";

export function validate(schema: { safeParse: (data: unknown) => { success: boolean; error?: any; data?: any } }, source: "body" | "params" | "query" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: "Dados inválidos",
        details: result.error?.flatten?.()?.fieldErrors ?? result.error,
      });
    }
    (req as any)[source] = result.data;
    next();
  };
}
