export function World() {
  return (
    <div className="world-panel">
      <div className="world-top">
        <span>SHARED KNOWLEDGE. SHARED POSSIBILITY.</span>
        <span>01 / ∞</span>
      </div>
      <svg
        viewBox="0 0 460 350"
        role="img"
        aria-label="A connected globe representing open collaboration across communities"
      >
        <defs>
          <pattern
            id="grid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 22 0 L 0 0 0 22"
              fill="none"
              stroke="#d9e3da"
              strokeWidth=".5"
            />
          </pattern>
          <clipPath id="globe">
            <circle cx="232" cy="171" r="126" />
          </clipPath>
        </defs>
        <rect width="460" height="350" fill="url(#grid)" />
        <g fill="none" stroke="#aac4b6" strokeWidth="1">
          <circle cx="232" cy="171" r="126" />
          <ellipse cx="232" cy="171" rx="76" ry="126" />
          <ellipse cx="232" cy="171" rx="28" ry="126" />
          <ellipse cx="232" cy="171" rx="126" ry="46" />
          <ellipse cx="232" cy="171" rx="126" ry="89" />
          <path d="M106 171h252M232 45v252" />
        </g>
        <g
          clipPath="url(#globe)"
          fill="#c5d9cd"
          stroke="#f2f6ef"
          strokeWidth="2"
        >
          <path d="m119 91 32-20 35 9 9 22 29 5-7 23-23 3-8 18-21 2-2 29-17-9-5-30-19-15zM182 171l34 9 15 27-13 29-5 37-13 16-7-39-14-26-7-31zM247 95l24-13 16 15 25-10 47 24 12 41-28 8-19-12-12 14-22-13-7-24-24 7-19-15zM255 147l36 7 18 28-13 32-16 23-19-11-1-29-19-24zM322 239l28-9 23 21-20 13-24-6z" />
        </g>
        <g fill="none" stroke="#23775e" strokeWidth="1.4" strokeDasharray="3 5">
          <path d="M169 126Q240 31 296 125M169 126Q168 219 202 231M202 231Q264 186 278 177M278 177Q305 189 342 246M296 125Q318 147 278 177" />
        </g>
        {[
          [169, 126],
          [202, 231],
          [278, 177],
          [296, 125],
          [342, 246],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="9" fill="#eaf4eb" />
            <circle cx={x} cy={y} r="4" fill="#187254" />
          </g>
        ))}
        <g fill="#527267" fontSize="9" fontFamily="monospace">
          <text x="24" y="292">
            OPEN SOURCE
          </text>
          <text x="24" y="306">
            WITHOUT BORDERS
          </text>
          <text x="348" y="56">
            PUBLIC
          </text>
          <text x="348" y="70">
            BY DESIGN
          </text>
        </g>
        <path d="M20 30h15m-7-7v15M418 306h15m-7-7v15" stroke="#5a7d69" />
      </svg>
      <div className="world-bottom">
        <span className="open-mark">
          <span />
          Many disciplines. One shared purpose.
        </span>
        <span>↗</span>
      </div>
    </div>
  );
}
