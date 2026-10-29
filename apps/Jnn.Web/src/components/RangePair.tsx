import React from 'react';

export interface RangePairProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (val: [number, number]) => void;
  disabled?: boolean;
  className?: string;
  ariaLabelMin?: string;
  ariaLabelMax?: string;
}

export function RangePair({
  min,
  max,
  step = 0.1,
  value,
  onChange,
  disabled = false,
  className = '',
  ariaLabelMin = 'Minimum',
  ariaLabelMax = 'Maximum',
}: RangePairProps) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max) === safeMin ? safeMin + 1 : Math.max(min, max);
  const v0 = Math.min(Math.max(value[0], safeMin), safeMax);
  const v1 = Math.max(Math.min(value[1], safeMax), safeMin);

  const range = safeMax - safeMin;
  const leftPercent = Math.max(0, Math.min(100, ((v0 - safeMin) / range) * 100));
  const widthPercent = Math.max(0, Math.min(100 - leftPercent, ((v1 - v0) / range) * 100));

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = Number(e.target.value);
    const clamped = Math.min(nextVal, v1 - (step || 0.1));
    onChange([Math.round(clamped * 100) / 100, v1]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = Number(e.target.value);
    const clamped = Math.max(nextVal, v0 + (step || 0.1));
    onChange([v0, Math.round(clamped * 100) / 100]);
  };

  return (
    <div className={`relative h-6 flex items-center select-none ${className}`}>
      {/* Background track */}
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-line" />
      {/* Active range highlight */}
      <div
        className="absolute h-1.5 rounded-full bg-accent"
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
      />
      {/* Range inputs stacked */}
      <input
        type="range"
        min={safeMin}
        max={safeMax}
        step={step}
        value={v0}
        disabled={disabled}
        aria-label={ariaLabelMin}
        onChange={handleMinChange}
        className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent m-0 cursor-pointer
          [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent
          [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125
          [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-surface [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:shadow-sm"
      />
      <input
        type="range"
        min={safeMin}
        max={safeMax}
        step={step}
        value={v1}
        disabled={disabled}
        aria-label={ariaLabelMax}
        onChange={handleMaxChange}
        className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent m-0 cursor-pointer
          [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent
          [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125
          [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-surface [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:shadow-sm"
      />
    </div>
  );
}
