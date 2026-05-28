'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { PlayerColor, PLAYER_COLORS } from '@/types/game';

interface ColorDropdownProps {
  value: PlayerColor | null;
  onChange: (color: PlayerColor) => void;
  availableColors: PlayerColor[];
  placeholder?: string;
}

export default function ColorDropdown({ 
  value, 
  onChange, 
  availableColors, 
  placeholder = "Selecione uma cor" 
}: ColorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedColor = value ? PLAYER_COLORS.find(c => c.value === value) : null;
  const filteredColors = PLAYER_COLORS.filter(color => availableColors.includes(color.value));

  const handleSelect = (color: PlayerColor) => {
    onChange(color);
    setIsOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-left shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-inconsolata"
      >
        <div className="flex items-center">
          {selectedColor ? (
            <>
              <div className={`w-4 h-4 rotate-45 border-2 border-zinc-600 ${selectedColor.bg} mr-2`} />
              <span className="text-zinc-100">{selectedColor.label}</span>
            </>
          ) : (
            <span className="text-zinc-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-zinc-900 shadow-lg border border-zinc-700">
          <div className="max-h-60 overflow-auto py-1">
            {filteredColors.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => handleSelect(color.value)}
                className="w-full flex items-center px-3 py-2 text-left hover:bg-zinc-800 transition-colors font-inconsolata cursor-pointer"
              >
                <div className={`w-4 h-4 rotate-45 border-2 border-zinc-600 ${color.bg} mr-2`} />
                <span className="text-zinc-100">{color.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}