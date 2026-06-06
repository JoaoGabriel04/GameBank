export default function DiamondIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ color: "#22d3ee" }}
    >
      <path d="M2 8l10 14L22 8 18 2H6L2 8z" />
      <path d="M2 8h20" />
      <path d="M12 22V8" />
      <path d="M10 8l2-6 2 6" />
      <path d="M6 8l2 2 4 4" />
      <path d="M18 8l-2 2-4 4" />
    </svg>
  );
}
