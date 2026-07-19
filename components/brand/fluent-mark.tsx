export function FluentMark({ size = 24 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "var(--color-primary)",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          width: size * 0.375,
          height: size * 0.375,
          borderRadius: "50%",
          background: "var(--color-accent-soft)",
          left: size * 0.16,
          top: size * 0.16,
        }}
      />
      <span
        style={{
          position: "absolute",
          width: size * 0.29,
          height: size * 0.29,
          borderRadius: "50%",
          background: "var(--color-surface)",
          left: size * 0.42,
          top: size * 0.2,
        }}
      />
      <span
        style={{
          position: "absolute",
          width: size * 0.21,
          height: size * 0.21,
          borderRadius: "50%",
          background: "var(--color-accent)",
          left: size * 0.5,
          top: size * 0.5,
        }}
      />
    </div>
  );
}
