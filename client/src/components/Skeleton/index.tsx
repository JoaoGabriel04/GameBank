import type { CSSProperties, ReactNode } from "react";

// Esqueletos de carregamento: blocos no formato do conteúdo que vai chegar,
// com um brilho que atravessa (globals.css, .gb-skeleton). No nível
// "reduzido" o brilho vira um pulso de opacidade; no "desligado", parado.

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`gb-skeleton ${className}`} style={style} />;
}

/** Envolve um esqueleto: leitores de tela ouvem só o rótulo. */
export function SkeletonCarregando({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Grade de cards do mesmo tamanho. */
export function SkeletonGrade({
  qtd,
  altura,
  colunas,
  className = "grid gap-2.5",
  arredondado = "rounded-2xl",
}: {
  qtd: number;
  altura: number;
  colunas?: string;
  className?: string;
  arredondado?: string;
}) {
  return (
    <div className={className} style={colunas ? { gridTemplateColumns: colunas } : undefined}>
      {Array.from({ length: qtd }, (_, i) => (
        <Skeleton key={i} className={arredondado} style={{ height: altura }} />
      ))}
    </div>
  );
}

/** Linha de lista com avatar redondo, duas linhas de texto e um valor à direita. */
export function SkeletonLinha() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-0">
      <Skeleton className="w-7 h-4 rounded" />
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="h-2.5 w-16 rounded" />
      </div>
      <Skeleton className="h-4 w-12 rounded" />
    </div>
  );
}
