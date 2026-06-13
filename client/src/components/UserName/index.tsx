'use client';

import UserBadge from '@/components/UserBadge';
import { Chip } from '@/components/user/UserUI';
import { shimmerTitleStyle } from '@/lib/animations';
import LegendaryTitle from '@/components/LegendaryTitle';

interface UserNameProps {
  nome: string;
  badge?: string | null;
  badgeImageUrl?: string | null;
  title?: string | null;
  titleAnimated?: boolean;
  titleRaridade?: string | null;
  className?: string;
  badgeVariant?: 'micro' | 'small';
  showTitle?: boolean;
}

export default function UserName({
  nome,
  badge,
  badgeImageUrl,
  title,
  titleAnimated,
  titleRaridade,
  className = '',
  badgeVariant = 'micro',
  showTitle = true,
}: UserNameProps) {
  return (
    <div className='flex flex-col justify-center'>
      <div className={`flex items-center gap-1.5 ${className}`}>
        {(badge || badgeImageUrl) && (
          <UserBadge badge={badge} imageUrl={badgeImageUrl} variant={badgeVariant} />
        )}
        <span className="font-inconsolata font-medium text-zinc-100 truncate">
          {nome}
        </span>

      </div>
      {showTitle && title && !titleAnimated && (
        <Chip tone="emerald">{title}</Chip>
      )}
      {showTitle && title && titleAnimated && titleRaridade === "LENDARIO" && (
        <LegendaryTitle text={title} />
      )}
      {showTitle && title && titleAnimated && titleRaridade !== "LENDARIO" && (
        <span className="font-inconsolata text-xs px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10" style={shimmerTitleStyle}>
          {title}
        </span>
      )}
    </div>
  );
}
