import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';

interface AnimatedIconProps {
  icon: any;
  size?: number;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
}

export function AnimatedIcon({
  icon,
  size = 24,
  className = '',
  hover = true,
  style,
}: AnimatedIconProps) {
  const hoverVariants = hover ? {
    scale: 1.1,
    rotate: 5,
    transition: { duration: 0.2 }
  } : {};

  const tapVariants = {
    scale: 0.95,
    transition: { duration: 0.1 }
  };

  return (
    <motion.div
      className={className}
      whileHover={hoverVariants}
      whileTap={tapVariants}
      style={style}
    >
      <HugeiconsIcon icon={icon} size={size} />
    </motion.div>
  );
}
