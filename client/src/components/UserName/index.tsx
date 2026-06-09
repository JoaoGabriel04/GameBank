'use client';

import UserBadge from '@/components/UserBadge';
import { Chip } from '@/components/user/UserUI';
import { shimmerTitleStyle } from '@/lib/animations';

interface UserNameProps {
  nome: string;
  badge?: string | null;
  badgeImageUrl?: string | null;
  title?: string | null;
  titleAnimated?: boolean;
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
  className = '',
  badgeVariant = 'micro',
  showTitle = true,
}: UserNameProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {(badge || badgeImageUrl) && (
        <UserBadge badge={badge} imageUrl={badgeImageUrl} variant={badgeVariant} />
      )}
      <span className="font-inconsolata font-medium text-zinc-100 truncate">
        {nome}
      </span>
      {showTitle && title && !titleAnimated && (
        <Chip tone="emerald">{title}</Chip>
      )}
      {showTitle && title && titleAnimated && (
        <span className="font-inconsolata text-xs px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10" style={shimmerTitleStyle}>
          {title}
        </span>
      )}
    </div>
  );
}
