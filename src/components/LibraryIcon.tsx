"use client";

import { HugeiconsIcon } from "@hugeicons/react";

type LibraryIconProps = {
  icon: any;
  size?: number;
  className?: string;
  isActive?: boolean;
};

export function LibraryIcon({
  icon,
  size = 24,
  className,
}: LibraryIconProps) {
  return (
    <div className={className}>
      <HugeiconsIcon icon={icon} size={size} />
    </div>
  );
}
