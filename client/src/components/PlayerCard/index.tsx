'use client';

import UserBanner from '@/components/UserBanner';
import UserAvatar from '@/components/UserAvatar';
import UserBadge from '@/components/UserBadge';
import { Chip } from '@/components/user/UserUI';
import { shimmerTitleStyle } from '@/lib/animations';
import { formatCurrency } from '@/utils/format';
import type { Player } from '@/types/game';

export interface PlayerCardProps {
  player: Player;
  /** Valor exibido sobre o banner. Padrão: player.saldo */
  patrimonio?: number;
  selected?: boolean;
  onClick?: () => void;
  /** Destaque verde + label "VOCÊ" */
  isMe?: boolean;
  /** Posição no ranking — exibe medalha ou #N no banner */
  rankPosition?: number;
  /** Número de propriedades (ranking, transferência) */
  propCount?: number;
  /** Mostra badge "Desistiu" */
  desistiu?: boolean;
  className?: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function PlayerCard({
  player,
  patrimonio,
  selected,
  onClick,
  isMe,
  rankPosition,
  propCount,
  desistiu,
  className = '',
}: PlayerCardProps) {
  const displayValue = patrimonio ?? player.saldo;
  const Tag = onClick ? 'button' : 'div';

  const borderClass = selected
    ? 'border-green-500'
    : isMe
    ? 'border-green-500/60'
    : 'border-zinc-800';

  const hoverClass = onClick && !selected ? 'hover:border-zinc-600' : '';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const } : {})}
      onClick={onClick}
      className={`overflow-hidden rounded-xl border bg-zinc-950 text-left ${borderClass} ${hoverClass} ${onClick ? 'cursor-pointer transition-colors' : ''} ${className}`}
    >
      {/* ── Faixa do banner ── */}
      <div className="relative" style={{ height: 56 }}>
        <UserBanner
          banner={player.banner}
          animated={player.bannerAnimated}
          className="absolute inset-0 w-full h-full"
        />

        {rankPosition != null && (
          <div
            className="absolute top-2 left-2.5"
            style={{
              background: 'rgba(0,0,0,0.55)',
              borderRadius: 6,
              padding: '2px 7px',
              backdropFilter: 'blur(4px)',
            }}
          >
            {rankPosition <= 3 ? (
              <span className="text-sm leading-none">{MEDALS[rankPosition - 1]}</span>
            ) : (
              <span className="font-inconsolata text-[11px] text-zinc-300">#{rankPosition}</span>
            )}
          </div>
        )}

        <div
          className="absolute"
          style={{
            top: 8,
            right: 10,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 6,
            padding: '3px 8px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span className="font-inconsolata" style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>
            R$ {formatCurrency(displayValue)}
          </span>
        </div>
      </div>

      {/* ── Área de informações ── */}
      <div className="relative" style={{ padding: '26px 14px 12px' }}>
        {/* Avatar sobreposto ao banner */}
        <div className="absolute" style={{ top: -20, left: 14 }}>
          <div style={{ borderRadius: '50%', border: '2.5px solid #09090b', display: 'inline-flex' }}>
            <UserAvatar
              avatarUrl={player.avatarUrl}
              avatarUpdatedAt={player.avatarUpdatedAt}
              nome={player.nome}
              size="md"
              ring={!!(selected || isMe)}
            />
          </div>
        </div>

        {/* Nome + Badge + Título + VOCÊ + Desistiu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="font-inconsolata font-medium text-zinc-100 truncate" style={{ fontSize: 14 }}>
            {player.nome}
          </span>
          {player.badge && (
            <UserBadge badge={player.badge} imageUrl={player.badgeImageUrl} variant="small" />
          )}
          {player.title && !player.titleAnimated && (
            <Chip tone="emerald">{player.title}</Chip>
          )}
          {player.title && player.titleAnimated && (
            <span style={shimmerTitleStyle} className="font-inconsolata text-xs px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10">
              {player.title}
            </span>
          )}
          {isMe && (
            <span className="font-inconsolata text-[10px] text-green-500 bg-green-500/20 px-1.5 py-0.5 rounded">
              VOCÊ
            </span>
          )}
          {desistiu && (
            <span className="font-inconsolata text-[10px] text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded">
              Desistiu
            </span>
          )}
        </div>

        {/* Nível */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <span className="font-inconsolata" style={{ fontSize: 11, color: '#a1a1aa' }}>
            Nível {player.level ?? '?'}
          </span>
          {propCount != null && (
            <>
              <span style={{ fontSize: 11, color: '#52525b' }}>·</span>
              <span className="font-inconsolata" style={{ fontSize: 11, color: '#a1a1aa' }}>
                {propCount} prop{propCount !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        {selected && (
          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">✓</span>
          </div>
        )}
      </div>
    </Tag>
  );
}
