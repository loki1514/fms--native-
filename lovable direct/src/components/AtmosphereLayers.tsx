export function AtmosphereLayers() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Aurora glow */}
      <div className="aurora absolute inset-0 drift" />

      {/* Soft moon glow top-right */}
      <div
        className="absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.85 0.05 240 / 18%) 0%, transparent 70%)",
        }}
      />

      {/* Cloud band */}
      <div
        className="absolute top-1/3 left-0 h-40 w-[140%] -translate-x-10 blur-2xl opacity-30 drift"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.6 0.04 250 / 40%), transparent)",
        }}
      />

      {/* Bottom horizon glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-64"
        style={{
          background:
            "radial-gradient(80% 100% at 50% 100%, oklch(0.4 0.1 250 / 35%), transparent)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 50%, oklch(0 0 0 / 40%) 100%)",
        }}
      />
    </div>
  );
}
