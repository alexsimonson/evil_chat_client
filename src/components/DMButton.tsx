type DMButtonProps = {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  title?: string;
  style?: React.CSSProperties;
};

export function DMButton({ onClick, label = "DM", title = "Direct message", style }: DMButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: 11,
        padding: "2px 6px",
        minHeight: "24px",
        ...style,
      }}
    >
      {label}
    </button>
  );
}
