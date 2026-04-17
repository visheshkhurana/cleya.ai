'use client';
import { getPasswordStrength } from '@/lib/passwordStrength';

export default function PasswordStrengthMeter({ password, showRequirements = true }: { password: string; showRequirements?: boolean }) {
  if (!password) return null;
  const s = getPasswordStrength(password);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: s.width, background: s.color, transition: 'width 200ms ease, background 200ms ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</span>
        {!s.meetsRequirements && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Needs all requirements</span>
        )}
      </div>
      {showRequirements && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
          {([
            ['length', '8+ characters'],
            ['lower', 'Lowercase'],
            ['upper', 'Uppercase'],
            ['number', 'Number'],
            ['special', 'Special char'],
          ] as const).map(([k, label]) => (
            <li key={k} style={{ fontSize: 10.5, color: s.requirements[k] ? '#10b981' : 'rgba(255,255,255,0.4)' }}>
              {s.requirements[k] ? '✓' : '○'} {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
