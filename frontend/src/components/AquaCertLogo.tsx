interface Props {
  size?: number;
  className?: string;
}

export default function AquaCertLogo({ size = 48, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer glow ring */}
      <circle cx="24" cy="24" r="22" stroke="#00e0ff" strokeWidth="1" strokeOpacity="0.2" />

      {/* Water drop shape */}
      <path
        d="M24 6C24 6 12 18 12 26C12 32.627 17.373 38 24 38C30.627 38 36 32.627 36 26C36 18 24 6 24 6Z"
        fill="url(#waterGradient)"
        opacity="0.9"
      />

      {/* Inner highlight on drop */}
      <path
        d="M20 20C18.5 22.5 18 24.5 18 26C18 28 18.8 29.8 20 31"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />

      {/* Certificate checkmark shield overlay */}
      <path
        d="M24 19L26.5 22L31 17"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 23.5C17 23.5 17.5 31.5 24 34.5C30.5 31.5 31 23.5 31 23.5L24 21L17 23.5Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="white"
        fillOpacity="0.08"
      />

      <defs>
        <linearGradient id="waterGradient" x1="24" y1="6" x2="24" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#33e8ff" />
          <stop offset="100%" stopColor="#0086cc" />
        </linearGradient>
      </defs>
    </svg>
  );
}
