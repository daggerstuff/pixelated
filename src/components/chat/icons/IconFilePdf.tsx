interface IconProps {
  className?: string
}

export default function IconFilePdf({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 10.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
        fill="currentColor"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 14h-4v-4h4v4z"
        fill="currentColor"
      />
    </svg>
  )
}
