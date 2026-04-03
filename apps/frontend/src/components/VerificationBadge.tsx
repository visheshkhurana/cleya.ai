'use client';

interface VerificationBadgeProps {
  score?: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export default function VerificationBadge({ score = 0, size = 'sm', showLabel = true }: VerificationBadgeProps) {
  const normalizedScore = score > 1 ? score : score * 100;

  let tier: { label: string; color: string; bgColor: string; borderColor: string };
  if (normalizedScore >= 75) {
    tier = { label: 'Trusted', color: '#10B981', bgColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.2)' };
  } else if (normalizedScore >= 50) {
    tier = { label: 'Verified', color: '#3B82F6', bgColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.2)' };
  } else if (normalizedScore >= 25) {
    tier = { label: 'Basic', color: '#3B82F6', bgColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.2)' };
  } else {
    return null;
  }

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${textSize} font-semibold`}
      style={{ background: tier.bgColor, border: `1px solid ${tier.borderColor}`, color: tier.color }}
      title={`Verification: ${tier.label} (${Math.round(normalizedScore)}%)`}
    >
      <svg className={iconSize} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      {showLabel && tier.label}
    </span>
  );
}
