'use client'

import { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlay, faPause, faVolumeHigh, faVolumeLow, faVolumeMute } from "@fortawesome/free-solid-svg-icons"

type Props = {
  isPlaying: boolean
  onToggle: () => void
  volume: number
  onVolumeChange: (volume: number) => void
}

export default function MusicPlayer({ isPlaying, onToggle, volume, onVolumeChange }: Props) {
  const [showControls, setShowControls] = useState(false)

  const getVolumeIcon = () => {
    if (volume === 0) return faVolumeMute
    if (volume < 0.5) return faVolumeLow
    return faVolumeHigh
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {showControls && (
        <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-4 flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon 
              icon={getVolumeIcon()} 
              className="text-zinc-400 w-4"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
          <p className="text-xs text-zinc-500 text-center font-inconsolata">Air of Change</p>
        </div>
      )}

      <button
        onClick={onToggle}
        onMouseEnter={() => setShowControls(true)}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
          isPlaying 
            ? "bg-green-500/20 border-2 border-green-500 animate-pulse" 
            : "bg-zinc-800/80 border-2 border-zinc-600 hover:border-zinc-400"
        }`}
      >
        <FontAwesomeIcon 
          icon={isPlaying ? faPause : faPlay} 
          className={`text-xl ${isPlaying ? "text-green-400" : "text-zinc-300"}`}
        />
      </button>
    </div>
  )
}