import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

interface DrawSvgLoaderProps {
  size?: number;
  className?: string;
}

export default function DrawSvgLoader({ size = 40, className = "" }: DrawSvgLoaderProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (!pathRef.current) return;

      const path = pathRef.current;
      const totalLength = path.getTotalLength();
      
      // Use the actual totalLength for maximum precision
      // Initial state: 0 length segment at the start
      gsap.set(path, {
        strokeDasharray: `0 ${totalLength}`,
        strokeDashoffset: 0,
        opacity: 0
      });

      const tl = gsap.timeline({
        repeat: -1,
        defaults: { duration: 3, ease: 'power1.inOut' }
      });

      // 1. Reveal and Draw In (matches .from(0% 0%))
      tl.set(path, { opacity: 1 })
      .to(path, {
        strokeDasharray: `${totalLength} ${totalLength}`,
      })
      
      // 2. Draw Out (matches .to(100% 100%))
      // Head stays at end, tail moves to end
      .to(path, {
        strokeDasharray: `0 ${totalLength}`,
        strokeDashoffset: -totalLength,
      })
      
      // 3. Reset instantly
      .set(path, { 
        opacity: 0,
        strokeDashoffset: 0 
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`draw-svg-loader ${className}`} 
      style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg 
        viewBox="-1 -1 103 103" 
        fill="none" 
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="loader-grad-loop-v11" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(255, 135, 9)"></stop>
            <stop offset="1" stopColor="rgb(247, 189, 248)"></stop>
          </linearGradient>
        </defs>
        <path 
          ref={pathRef}
          stroke="url(#loader-grad-loop-v11)" 
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M50.5 50.5h50v50s-19.2 1.3-37.2-16.7S56 35.4 35.5 15.5C18.5-1 .5.5.5.5v50h50s25.6-.6 38-18 12-32 12-32h-50v100H.5S.2 80.7 11.8 68.2 40 49.7 50.5 50.5Z" 
        />
      </svg>
    </div>
  );
}
