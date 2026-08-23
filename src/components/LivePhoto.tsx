import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { analyzePhoto, PhotoAnalysis } from '../services/vision';

interface LivePhotoProps {
  src: string;
  alt: string;
  className?: string;
  showBadge?: boolean;
}

/**
 * Renders a photo that gently "comes alive" (subtle Ken-Burns breathing motion)
 * ONLY when a face or body silhouette is clearly recognisable.
 * Unclear / hidden-face photos are rendered completely static.
 */
const LivePhotoInner: React.FC<LivePhotoProps> = ({ src, alt, className = '', showBadge = true }) => {
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setAnalysis(null);
    setLoaded(false);
    analyzePhoto(src).then((result) => {
      if (active) setAnalysis(result);
    });
    return () => {
      active = false;
    };
  }, [src]);

  const motionMode = analysis?.motion ?? 'static';
  const isAlive = motionMode !== 'static';
  const originX = `${((analysis?.focusX ?? 0.5) * 100).toFixed(0)}%`;
  const originY = `${((analysis?.focusY ?? 0.45) * 100).toFixed(0)}%`;

  // Portraits breathe closer and slower; full-body shots drift a bit wider
  const animation =
    motionMode === 'portrait'
      ? { scale: [1, 1.075, 1.045, 1], x: [0, -6, 4, 0], y: [0, 4, -3, 0] }
      : { scale: [1, 1.05, 1.03, 1], x: [0, 8, -5, 0], y: [0, -6, 3, 0] };

  const duration = motionMode === 'portrait' ? 11 : 14;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{ transformOrigin: `${originX} ${originY}`, willChange: isAlive ? 'transform' : 'auto' }}
        animate={isAlive && loaded ? animation : undefined}
        transition={
          isAlive
            ? { duration, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' }
            : undefined
        }
        className="w-full h-full object-cover select-none pointer-events-none"
        draggable={false}
      />

      {/* Soft light sweep — reinforces the "living photo" feel */}
      {isAlive && loaded && (
        <motion.div
          aria-hidden
          initial={{ x: '-120%' }}
          animate={{ x: ['-120%', '130%'] }}
          transition={{ duration: 6.5, repeat: Infinity, repeatDelay: 4.5, ease: 'easeInOut' }}
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/8 to-transparent pointer-events-none"
        />
      )}

      {/* LIVE badge only for animated photos */}
      {isAlive && loaded && showBadge && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-emerald-500/50 px-2 py-1 rounded-lg pointer-events-none">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[9px] font-black tracking-wider text-emerald-400 uppercase">Live</span>
          <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
        </div>
      )}
    </div>
  );
};

/** Memoised: re-analysing a photo on every parent render is expensive */
export const LivePhoto = React.memo(
  LivePhotoInner,
  (prev, next) => prev.src === next.src && prev.className === next.className
);
