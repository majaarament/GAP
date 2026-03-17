import * as React from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Button({ className, variant, size, children, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Button };
