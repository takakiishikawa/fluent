/** Fluent ロゴマーク: 角丸タイル内に3つの円が横並び（5px/7px/5px, gap 3px）。 */
export function FluentMark({
  size = 30,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: "var(--color-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: size * 0.1,
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        style={{
          width: size / 6,
          height: size / 6,
          borderRadius: "50%",
          background: "var(--color-accent-soft)",
        }}
      />
      <span
        style={{
          width: size * 0.233,
          height: size * 0.233,
          borderRadius: "50%",
          background: "var(--color-surface)",
        }}
      />
      <span
        style={{
          width: size / 6,
          height: size / 6,
          borderRadius: "50%",
          background: "var(--color-accent)",
        }}
      />
    </div>
  );
}

/** go-design-system の AppSwitcher/AppIcon 用（className="size-4" 等のサイズ指定を受ける） */
export function FluentAppIcon({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: "30%",
        background: "var(--color-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8%",
      }}
    >
      <span
        style={{
          width: "26%",
          height: "26%",
          borderRadius: "50%",
          background: "var(--color-accent-soft)",
        }}
      />
      <span
        style={{
          width: "36%",
          height: "36%",
          borderRadius: "50%",
          background: "var(--color-surface)",
        }}
      />
      <span
        style={{
          width: "26%",
          height: "26%",
          borderRadius: "50%",
          background: "var(--color-accent)",
        }}
      />
    </div>
  );
}
