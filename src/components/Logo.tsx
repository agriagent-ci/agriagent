interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Logo officiel AgriAgent (médaillon vert, jeune pousse au soleil).
 * L'image est dans `public/logo-agriagent.png` : fond transparent hors du cercle,
 * donc elle s'affiche proprement aussi bien sur une carte blanche que sur fond sombre.
 */
export function Logo({ size = 40, className = "" }: LogoProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white shadow-md overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo-agriagent.png"
        alt="AgriAgent"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        draggable={false}
        decoding="async"
      />
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
