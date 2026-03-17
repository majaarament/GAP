import * as React from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Slider({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }) {
  const current = Array.isArray(value) ? value[0] : value ?? min;

  function handleChange(e) {
    if (onValueChange) onValueChange([Number(e.target.value)]);
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={current}
      onChange={handleChange}
      className={cn("w-full cursor-pointer accent-primary", className)}
      {...props}
    />
  );
}

export { Slider };
