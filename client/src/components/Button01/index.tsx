import { BUTTON_COLORS, ButtonColors } from "@/types/ui";

type ButtonProps = {
  handle?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: string;
  size: "sm" | "md" | "lg" | "xl" | "full";
  color: ButtonColors;
  ref?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
};

export default function Button1({ handle, type, color, className, size, ref, children, disabled }: ButtonProps) {

  let sizeBtn = "";

  if (size === "sm") {
    sizeBtn = "px-4";
  } else if (size === "md") {
    sizeBtn = "px-6";
  } else if (size === "lg") {
    sizeBtn = "px-8";
  } else if (size === "xl") {
    sizeBtn = "px-10";
  } else if (size === "full") {
    sizeBtn = "w-full"
  }

  const colorBtn = BUTTON_COLORS.find(c => c.value === color) || BUTTON_COLORS[0];

  const glowStyle = {
    boxShadow: `0 0 8px ${colorBtn.glow}40, 0 0 16px ${colorBtn.glow}20, inset 0 0 8px ${colorBtn.glow}10`,
  };

  const hoverGlowStyle = {
    boxShadow: `0 0 12px ${colorBtn.glow}60, 0 0 24px ${colorBtn.glow}40, inset 0 0 12px ${colorBtn.glow}20`,
  };

  return (
    <div ref={ref} className={`inline-block ${className}`}>
      <button
        {...(handle && { onClick: handle as React.MouseEventHandler<HTMLButtonElement> })}
        type={type === "submit" ? "submit" : "button"}
        disabled={disabled}
        className={`
          relative font-jaro font-bold text-sm lg:text-base py-2 uppercase tracking-wider
          ${sizeBtn}
          ${colorBtn.bg}
          ${colorBtn.border}
          border-2
          text-zinc-100
          transition-all duration-150
          group
          cursor-pointer
          active:translate-y-0.5
          active:brightness-90
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={glowStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = hoverGlowStyle.boxShadow;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = glowStyle.boxShadow;
        }}
      >
        <span className={`relative z-10 ${colorBtn.text} drop-shadow-[0_0_8px_currentColor] group-hover:drop-shadow-[0_0_12px_currentColor] transition-all duration-200`}>
          {children}
        </span>
      </button>
    </div>
  );
}

Button1.defaultProps = {
  className: '',
  type: 'button',
};