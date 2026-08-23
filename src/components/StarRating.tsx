import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { triggerHapticImpact } from '../services/native';

interface StarRatingProps {
  value: number;
  onChange?: (stars: 1 | 2 | 3 | 4 | 5) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value, onChange, size = 'md', readOnly = false
}) => {
  const [hover, setHover] = useState(0);

  const px = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-6 h-6';
  const gap = size === 'lg' ? 'gap-2' : size === 'sm' ? 'gap-0.5' : 'gap-1';
  const shown = hover || value;

  return (
    <div className={`flex items-center ${gap}`}>
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = s <= shown;
        const Wrapper = readOnly ? 'span' : motion.button;
        return (
          <Wrapper
            key={s}
            {...(readOnly
              ? {}
              : {
                  type: 'button' as const,
                  whileTap: { scale: 0.8 },
                  onMouseEnter: () => setHover(s),
                  onMouseLeave: () => setHover(0),
                  onClick: () => {
                    triggerHapticImpact('light');
                    onChange?.(s as 1 | 2 | 3 | 4 | 5);
                  },
                  'aria-label': `Оценка ${s}`
                })}
            className={readOnly ? 'inline-flex' : 'inline-flex cursor-pointer'}
          >
            <Star
              className={`${px} transition-colors ${
                filled
                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                  : 'text-slate-600'
              }`}
            />
          </Wrapper>
        );
      })}
    </div>
  );
};
