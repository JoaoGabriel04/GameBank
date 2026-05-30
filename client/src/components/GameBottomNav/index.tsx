"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faStore,
  faStar,
  faTrophy,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const tabIcons: Record<string, IconDefinition> = {
  "Início": faHouse,
  "Loja": faStore,
  "Especiais": faStar,
  "Ranking": faTrophy,
  "Histórico": faClock,
};

interface GameBottomNavProps {
  linksNav: string[];
  abaAtual: string;
  onSelect: (tab: string) => void;
}

export default function GameBottomNav({ linksNav, abaAtual, onSelect }: GameBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800">
      <ul className="w-full grid grid-cols-5">
        {linksNav.map((link) => (
          <li
            key={link}
            onClick={() => onSelect(link)}
            className={`flex flex-col items-center justify-center py-2.5 gap-0.5 cursor-pointer transition-colors select-none active:scale-95 ${
              abaAtual === link
                ? "text-green-400"
                : "text-zinc-500"
            }`}
          >
            <FontAwesomeIcon
              icon={tabIcons[link]}
              className={`text-xl ${abaAtual === link ? "drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" : ""}`}
            />
            <span className="text-[10px] font-inconsolata font-medium">{link}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
