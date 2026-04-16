'use client';

import { useState } from 'react';
import Image from 'next/image';

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  xs: { container: 'w-5 h-5', text: 'text-[8px]', px: 20 },
  sm: { container: 'w-7 h-7', text: 'text-[10px]', px: 28 },
  md: { container: 'w-8 h-8', text: 'text-xs', px: 32 },
  lg: { container: 'w-10 h-10', text: 'text-sm', px: 40 },
  xl: { container: 'w-12 h-12', text: 'text-base', px: 48 },
};

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export default function UserAvatar({ name, avatarUrl, size = 'md', className = '' }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { container, text, px } = sizeMap[size];

  if (avatarUrl && !imgError) {
    return (
      <Image
        src={avatarUrl}
        alt={name || 'User avatar'}
        width={px}
        height={px}
        className={`${container} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        unoptimized
      />
    );
  }

  return (
    <div
      className={`${container} rounded-full flex items-center justify-center ${text} font-bold flex-shrink-0 bg-gradient-to-br from-brand-violet to-brand-teal text-white ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
