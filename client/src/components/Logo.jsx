// SprintProof logo.
// Three bars (the board's columns / each member's contribution) whose tops follow a checkmark (the proof).
export default function Logo() {
  return (
    <span className="logo">
      <svg className="logo-mark" viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">
        <defs>
          <linearGradient id="sp-logo-bg" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#a3304a" />
            <stop offset="1" stopColor="#5a1222" />
          </linearGradient>
          <radialGradient id="sp-logo-shine" cx="0.25" cy="0.1" r="0.9">
            <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sp-logo-check" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#f6b443" />
            <stop offset="1" stopColor="#ffd98a" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#sp-logo-bg)" />
        <rect width="64" height="64" rx="18" fill="url(#sp-logo-shine)" />
        <path d="M11 31.25L21 38.75V48Q21 51 18 51H14Q11 51 11 48Z" fill="#fff" fillOpacity="0.32" />
        <path d="M27 43.25L30 45.5L37 37.23V48Q37 51 34 51H30Q27 51 27 48Z" fill="#fff" fillOpacity="0.55" />
        <path d="M43 30.14L53 18.32V48Q53 51 50 51H46Q43 51 43 48Z" fill="#fff" fillOpacity="0.9" />
        <path
          d="M14 27L30 39L52 13"
          fill="none"
          stroke="url(#sp-logo-check)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="logo-text">
        Sprint<span className="logo-accent">Proof</span>
      </span>
    </span>
  )
}
