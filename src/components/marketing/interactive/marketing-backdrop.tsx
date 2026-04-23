interface MarketingBackdropProps {
  variant?: "hero" | "section" | "muted";
  className?: string;
}

export function MarketingBackdrop({
  variant = "section",
  className = "",
}: MarketingBackdropProps) {
  const intensity =
    variant === "hero" ? 0.32 : variant === "muted" ? 0.12 : 0.22;

  return (
    <div
      aria-hidden
      className={`absolute inset-0 -z-10 pointer-events-none ${className}`}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[640px] rounded-full blur-3xl"
        style={{
          opacity: intensity,
          background:
            "radial-gradient(closest-side, rgba(139,92,246,0.55), transparent)",
        }}
      />
      <div
        className="absolute top-40 left-1/3 w-[600px] h-[400px] rounded-full blur-3xl"
        style={{
          opacity: intensity * 0.7,
          background:
            "radial-gradient(closest-side, rgba(139,92,246,0.4), transparent)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}
