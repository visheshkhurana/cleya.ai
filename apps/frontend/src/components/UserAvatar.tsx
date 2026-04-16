'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';
import { isOptimizedAvatarDomain } from '@/lib/avatarOptimization';

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  shape?: 'circle' | 'rounded';
  fallbackIcon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const sizeMap = {
  xs: { container: 'w-5 h-5', text: 'text-[8px]', icon: 'text-xs', px: 20 },
  sm: { container: 'w-7 h-7', text: 'text-[10px]', icon: 'text-sm', px: 28 },
  md: { container: 'w-8 h-8', text: 'text-xs', icon: 'text-base', px: 32 },
  lg: { container: 'w-10 h-10', text: 'text-sm', icon: 'text-lg', px: 40 },
  xl: { container: 'w-12 h-12', text: 'text-base', icon: 'text-xl', px: 48 },
  '2xl': { container: 'w-14 h-14', text: 'text-lg', icon: 'text-2xl', px: 56 },
  '3xl': { container: 'w-16 h-16', text: 'text-xl', icon: 'text-3xl', px: 64 },
};

const shapeClass = {
  circle: 'rounded-full',
  rounded: 'rounded-2xl',
};

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export default function UserAvatar({ name, avatarUrl, size = 'md', shape = 'circle', fallbackIcon, className = '', style }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { container, text, icon, px } = sizeMap[size];
  const radius = shapeClass[shape];

  if (avatarUrl && !imgError) {
    const optimized = isOptimizedAvatarDomain(avatarUrl);
    return (
      <Image
        src={avatarUrl}
        alt={name || 'User avatar'}
        width={px}
        height={px}
        unoptimized={!optimized}
        className={`${container} ${radius} object-cover flex-shrink-0 ${className}`}
        style={style}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (fallbackIcon) {
    return (
      <div
        className={`${container} ${radius} flex items-center justify-center ${icon} flex-shrink-0 ${className}`}
        style={style}
      >
        {fallbackIcon}
      </div>
    );
  }

  return (
    <div
      className={`${container} ${radius} flex items-center justify-center ${text} font-bold flex-shrink-0 bg-gradient-to-br from-brand-violet to-brand-teal text-white ${className}`}
      style={style}
    >
      {getInitials(name)}
    </div>
  );
}
