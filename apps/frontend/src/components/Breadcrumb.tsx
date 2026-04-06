'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <nav className="flex items-center gap-1.5 text-xs text-white/30" aria-label="Breadcrumb">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-white/40 hover:text-white/70 transition mr-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {t('common.back')}
      </button>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-white/15">/</span>}
          {item.href ? (
            <button
              onClick={() => router.push(item.href!)}
              className="hover:text-white/60 transition"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-white/50">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
