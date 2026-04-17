export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  width: string;
  meetsRequirements: boolean;
  requirements: {
    length: boolean;
    lower: boolean;
    upper: boolean;
    number: boolean;
    special: boolean;
  };
}

export function getPasswordStrength(pw: string): PasswordStrength {
  const requirements = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const meets = Object.values(requirements).filter(Boolean).length;
  const meetsRequirements = Object.values(requirements).every(Boolean);

  let score = meets;
  if (pw.length >= 12) score += 1;
  if (pw.length >= 16) score += 1;

  if (!pw) return { score: 0, label: '', color: '', width: '0%', meetsRequirements: false, requirements };
  if (score <= 2) return { score, label: 'Weak', color: '#ef4444', width: '20%', meetsRequirements, requirements };
  if (score === 3) return { score, label: 'Fair', color: '#f59e0b', width: '45%', meetsRequirements, requirements };
  if (score === 4) return { score, label: 'Good', color: '#9B95FF', width: '70%', meetsRequirements, requirements };
  return { score, label: 'Strong', color: '#10b981', width: '100%', meetsRequirements, requirements };
}
