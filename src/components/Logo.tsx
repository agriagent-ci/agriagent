interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 40, className = "" }: LogoProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white shadow-md ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981"/>
            <stop offset="100%" stopColor="#047857"/>
          </linearGradient>
          <linearGradient id="dotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b"/>
            <stop offset="100%" stopColor="#d97706"/>
          </linearGradient>
        </defs>

        <path
          d="M32 8 C 48 8, 56 20, 56 32 C 56 44, 48 56, 32 56 C 16 56, 8 44, 8 32 C 8 20, 16 8, 32 8 Z"
          fill="url(#leafGradient)"
          opacity="0.95"
        />

        <path d="M32 56 L 32 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
        <path d="M32 32 L 22 26" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
        <path d="M32 32 L 42 26" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
        <path d="M32 42 L 24 38" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
        <path d="M32 42 L 40 38" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>

        <circle cx="32" cy="20" r="5" fill="url(#dotGradient)"/>
        <circle cx="32" cy="20" r="2" fill="white" opacity="0.8"/>
      </svg>
    </div>
  );
}

interface LogoWithTextProps {
  size?: number;
  className?: string;
}

export function LogoWithText({ size = 36, className = "" }: LogoWithTextProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={size} />
      <span className="text-lg font-bold tracking-tight text-stone-900">
        Agri<span className="text-emerald-600">Agent</span>
      </span>
    </div>
  );
}
