declare module "canvas-confetti" {
  interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: ("square" | "circle")[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  type ConfettiFn = (options?: ConfettiOptions) => Promise<unknown>;

  const confetti: ConfettiFn & {
    create: (origin: { x: number; y: number }, opts?: ConfettiOptions) => ConfettiFn;
    reset: () => void;
  };

  export default confetti;
}
