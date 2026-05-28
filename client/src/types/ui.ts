export type ButtonColors = 
  | 'red' 
  | 'blue' 
  | 'green' 
  | 'yellow'
  | 'purple' 
  | 'orange'
  | 'pink'
  | 'emerald'
  | 'cyan'

export const BUTTON_COLORS: { 
  value: ButtonColors; 
  bg: string; 
  border: string;
  text: string;
  glow: string;
}[] = [
  { value: 'green', bg: 'bg-zinc-950', border: 'border-green-500', text: 'text-green-400', glow: '#22c55e' },
  { value: 'blue', bg: 'bg-zinc-950', border: 'border-blue-500', text: 'text-blue-400', glow: '#3b82f6' },
  { value: 'red', bg: 'bg-zinc-950', border: 'border-red-500', text: 'text-red-400', glow: '#ef4444' },
  { value: 'yellow', bg: 'bg-zinc-950', border: 'border-yellow-500', text: 'text-yellow-400', glow: '#eab308' },
  { value: 'purple', bg: 'bg-zinc-950', border: 'border-purple-500', text: 'text-purple-400', glow: '#a855f7' },
  { value: 'orange', bg: 'bg-zinc-950', border: 'border-orange-500', text: 'text-orange-400', glow: '#f97316' },
  { value: 'pink', bg: 'bg-zinc-950', border: 'border-pink-500', text: 'text-pink-400', glow: '#ec4899' },
  { value: 'emerald', bg: 'bg-zinc-950', border: 'border-emerald-500', text: 'text-emerald-400', glow: '#10b981' },
  { value: 'cyan', bg: 'bg-zinc-950', border: 'border-cyan-500', text: 'text-cyan-400', glow: '#06b6d4' },
]