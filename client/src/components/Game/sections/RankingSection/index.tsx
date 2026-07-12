"use client";
import { useState } from "react";
import Ranking from "@/components/Ranking";
import Historico from "@/components/Historico";

export default function RankingSection() {
  const [subAba, setSubAba] = useState<"ranking" | "historico">("ranking");

  return (
    <div>
      <div className="flex border-b border-zinc-800 mb-4">
        <button
          onClick={() => setSubAba("ranking")}
          className={`flex-1 py-2 text-center text-sm font-inconsolata transition-colors cursor-pointer ${
            subAba === "ranking"
              ? "border-b-2 border-green-500 text-green-400 font-semibold"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Ranking
        </button>
        <button
          onClick={() => setSubAba("historico")}
          className={`flex-1 py-2 text-center text-sm font-inconsolata transition-colors cursor-pointer ${
            subAba === "historico"
              ? "border-b-2 border-green-500 text-green-400 font-semibold"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Histórico
        </button>
      </div>

      {subAba === "ranking" ? <Ranking /> : <Historico />}
    </div>
  );
}
