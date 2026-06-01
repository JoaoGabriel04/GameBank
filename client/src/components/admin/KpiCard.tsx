"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { KPI } from "@/lib/admin/types";

export default function KpiCard({ label, value, change, trend }: KPI) {
  const isPositive = trend === "up";
  const trendColor = isPositive ? "text-green-500" : trend === "down" ? "text-red-500" : "text-zinc-500";
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="admin-card p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-mono uppercase text-zinc-500 mb-1">{label}</p>
          <p className="text-3xl font-jaro font-bold text-zinc-100">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${trendColor} bg-opacity-10 ${isPositive ? "border border-green-500" : "border border-red-500"}`}>
          <TrendIcon className={`w-4 h-4 ${isPositive ? "text-green-500" : "text-red-500"}`} />
          <span className="text-sm font-mono font-semibold">{change > 0 ? "+" : ""}{change}%</span>
        </div>
      </div>

      {/* Sparkline placeholder */}
      <div className="h-8 rounded-lg bg-zinc-800/50 opacity-50"></div>
    </div>
  );
}
