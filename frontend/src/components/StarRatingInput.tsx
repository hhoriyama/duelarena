import { useState } from 'react';

interface Props {
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
}

/**
 * 1〜5の星評価入力コンポーネント
 */
export function StarRatingInput({ value, onChange, disabled = false }: Props) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center justify-center gap-1" role="radiogroup" aria-label="星評価">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => !disabled && setHover(0)}
            onClick={() => !disabled && onChange(n)}
            aria-label={`${n}つ星`}
            aria-checked={value === n}
            role="radio"
            className={
              'text-3xl transition-transform hover:scale-110 disabled:cursor-not-allowed ' +
              (filled ? 'text-yellow-400' : 'text-arena-border')
            }
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export default StarRatingInput;
