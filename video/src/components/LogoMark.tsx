import React from "react";
import { COLORS } from "../constants";

export const LogoMark: React.FC<{ size?: number }> = ({ size = 96 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="4"
        width="88"
        height="88"
        rx="22"
        fill={COLORS.bgSoft}
        stroke={COLORS.accent}
        strokeWidth="2"
      />
      <path
        d="M28 60 L44 36 L56 50 L70 30"
        stroke={COLORS.accent}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="70" cy="30" r="5" fill={COLORS.accentSoft} />
    </svg>
  );
};
