'use client';

type Props = {
  count: number;
  size?: number;
  textClassName?: string;
  className?: string;
};

export default function TrophyCount({ count, size = 16, textClassName = "font-jaro text-zinc-100", className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={textClassName}>{count.toLocaleString("pt-BR")}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/TROFEU.png"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain shrink-0"
      />
    </span>
  );
}
