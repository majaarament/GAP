import * as React from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
