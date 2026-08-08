import React from 'react';

/**
 * Layered ambient backdrop: soft white-night glow, a slow Neva shimmer,
 * a Saint Petersburg skyline silhouette and a faint tactical grid.
 * Purely decorative — pointer-events disabled, sits behind all content.
 */
export const AmbientBackdrop: React.FC = () => {
  return (
    <div className="sb-backdrop" aria-hidden>
      <div className="sb-backdrop-glow" />
      <div className="sb-backdrop-grid" />
      <div className="sb-backdrop-river" />

      {/* Saint Petersburg skyline: Admiralty spire, Peter & Paul Fortress,
          Kazan dome and the raised Palace Bridge */}
      <svg
        className="sb-backdrop-skyline"
        viewBox="0 0 430 150"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
      >
        <defs>
          <linearGradient id="sb-skyline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f2a2a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#020617" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* embankment base */}
        <path d="M0 150V128h430v22H0Z" fill="url(#sb-skyline-fill)" />

        {/* Kazan Cathedral colonnade + dome (left) */}
        <path
          d="M18 128v-22h6v-4h6v4h6v-4h6v4h6v-4h6v4h6v22Z"
          fill="url(#sb-skyline-fill)"
        />
        <path d="M33 106c0-8 6-13 10-13s10 5 10 13" fill="url(#sb-skyline-fill)" />
        <path d="M42 93l1-7 1 7" stroke="#34d399" strokeOpacity="0.5" strokeWidth="1" />

        {/* Peter & Paul Fortress spire (center-left) */}
        <path d="M120 128V96h18v32Z" fill="url(#sb-skyline-fill)" />
        <path d="M128 96l1-34 1 34" stroke="#34d399" strokeOpacity="0.65" strokeWidth="1.4" />
        <circle cx="129" cy="60" r="1.6" fill="#fbbf24" fillOpacity="0.8" />

        {/* Admiralty spire (center) — the tallest */}
        <path d="M205 128V100h26v28Z" fill="url(#sb-skyline-fill)" />
        <path d="M217 100l1.5-46 1.5 46" stroke="#34d399" strokeOpacity="0.8" strokeWidth="1.6" />
        <path d="M218.5 50l1-8 1 8" stroke="#fbbf24" strokeOpacity="0.9" strokeWidth="1.2" />

        {/* Roofs and a small dome (right) */}
        <path d="M262 128v-18l14-8 14 8v18Z" fill="url(#sb-skyline-fill)" />
        <path d="M300 128v-24h8v-6h4v6h8v24Z" fill="url(#sb-skyline-fill)" />
        <path d="M308 98c0-6 5-9 6-9s6 3 6 9" fill="url(#sb-skyline-fill)" />

        {/* Raised Palace Bridge wings (far right) */}
        <path d="M352 128l20-26 3 2-18 26Z" fill="url(#sb-skyline-fill)" />
        <path d="M412 128l-20-26-3 2 18 26Z" fill="url(#sb-skyline-fill)" />

        {/* window lights */}
        <g fill="#34d399" fillOpacity="0.35">
          <rect x="26" y="112" width="2" height="3" />
          <rect x="44" y="116" width="2" height="3" />
          <rect x="124" y="104" width="2" height="3" />
          <rect x="212" y="108" width="2" height="3" />
          <rect x="226" y="114" width="2" height="3" />
          <rect x="306" y="110" width="2" height="3" />
          <rect x="370" y="112" width="2" height="3" />
        </g>
      </svg>
    </div>
  );
};

export default AmbientBackdrop;
