"use client";

import React from "react";

/* ─── Helper: build SVG path from data ─── */
function buildPath(
  data: number[],
  w: number,
  h: number,
  pad: number = 4
): string[] {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1 || 1);

  return data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
}

/* ─── AreaChart ─── */
export function AreaChart({
  data,
  w = 600,
  h = 180,
  tone = "cyan",
  grid = true,
}: {
  data: number[];
  w?: number;
  h?: number;
  tone?: "cyan" | "emerald" | "amber" | "violet";
  grid?: boolean;
}) {
  const colors = {
    cyan: "#22d3ee",
    emerald: "#34d399",
    amber: "#fbbf24",
    violet: "#a78bfa",
  }[tone];

  const pts = buildPath(data, w, h, 8);
  const line = "M" + pts.join(" L");
  const area = `${line} L${w - 8},${h - 8} L8,${h - 8} Z`;
  const id = "g" + tone + Math.round(Math.random() * 1e5);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height: h }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors} stopOpacity="0.35" />
          <stop offset="100%" stopColor={colors} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid &&
        [0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1="8"
            x2={w - 8}
            y1={8 + (h - 16) * g}
            y2={8 + (h - 16) * g}
            stroke="#27272a"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={colors}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {pts.length > 0 && (() => {
        const [x, y] = pts[pts.length - 1].split(",");
        return (
          <circle
            cx={x}
            cy={y}
            r="3.5"
            fill={colors}
            stroke="#09090b"
            strokeWidth="2"
          />
        );
      })()}
    </svg>
  );
}

/* ─── MultiLine ─── */
export function MultiLine({
  series,
  w = 600,
  h = 180,
}: {
  series: Array<{ data: number[]; color: string }>;
  w?: number;
  h?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height: h }}
      preserveAspectRatio="none"
    >
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1="8"
          x2={w - 8}
          y1={8 + (h - 16) * g}
          y2={8 + (h - 16) * g}
          stroke="#27272a"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      ))}
      {series.map((s, i) => {
        const pts = buildPath(s.data, w, h, 8);
        return (
          <path
            key={i}
            d={"M" + pts.join(" L")}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

/* ─── BarChart ─── */
export function BarChart({
  data,
  w = 600,
  h = 180,
  tone = "cyan",
}: {
  data: number[];
  w?: number;
  h?: number;
  tone?: "cyan" | "emerald" | "amber" | "violet";
}) {
  const color = {
    cyan: "#22d3ee",
    emerald: "#34d399",
    amber: "#fbbf24",
    violet: "#a78bfa",
  }[tone];

  const max = Math.max(...data) || 1;
  const bw = (w - 16) / data.length;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height: h }}
      preserveAspectRatio="none"
    >
      {data.map((v, i) => {
        const bh = (h - 16) * (v / max);
        return (
          <rect
            key={i}
            x={8 + i * bw + bw * 0.18}
            y={h - 8 - bh}
            width={bw * 0.64}
            height={bh}
            rx="2"
            fill={i === data.length - 1 ? color : color + "88"}
          />
        );
      })}
    </svg>
  );
}

/* ─── Sparkline ─── */
export function Sparkline({
  data,
  w = 120,
  h = 36,
  tone = "cyan",
}: {
  data: number[];
  w?: number;
  h?: number;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet";
}) {
  const color = {
    cyan: "#22d3ee",
    emerald: "#34d399",
    amber: "#fbbf24",
    rose: "#fb7185",
    violet: "#a78bfa",
  }[tone];

  const pts = buildPath(data, w, h, 3);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none">
      <path
        d={"M" + pts.join(" L")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Donut ─── */
export function Donut({
  segments,
  size = 140,
  thickness = 18,
}: {
  segments: Array<{ value: number; color: string; label?: string }>;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#27272a"
        strokeWidth={thickness}
      />
      {segments.map((s, i) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}
