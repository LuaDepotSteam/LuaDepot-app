import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function SplashLoader({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cw = (canvas.width = window.innerWidth);
    let ch = (canvas.height = window.innerHeight);
    let radius = Math.max(cw, ch);

    const particleCount = 80;
    const particles = Array.from({ length: particleCount }, (_, i) => {
      const img = new Image();
      img.src = `./intro/flair-${(2 + i % 22)}.png`;
      return {
        x: 0,
        y: 0,
        scale: 0,
        rotate: 0,
        img
      };
    });

    const draw = () => {
      particles.sort((a, b) => a.scale - b.scale);
      ctx.clearRect(0, 0, cw, ch);
      particles.forEach((p) => {
        if (!p.img.complete || p.img.naturalWidth === 0) return;
        
        ctx.save();
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate(p.rotate);
        
        const w = p.img.width * p.scale;
        const h = p.img.height * p.scale;
        
        ctx.drawImage(p.img, p.x - w/2, p.y - h/2, w, h);
        ctx.restore();
      });
    };

    // Entrance animation for the container itself
    gsap.fromTo(containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: "power2.out" }
    );

    // Everything starts together immediately
    const particleTl = gsap.timeline({ onUpdate: draw });
    particleTl.fromTo(particles, 
      {
        x: (i) => {
          const angle = (i / particleCount * Math.PI * 2) - Math.PI / 2;
          return Math.cos(angle * 10) * radius;
        },
        y: (i) => {
          const angle = (i / particleCount * Math.PI * 2) - Math.PI / 2;
          return Math.sin(angle * 10) * radius;
        },
        scale: 1.1,
        rotate: 0
      },
      {
        duration: 4,
        ease: "sine.inOut",
        x: 0,
        y: 0,
        scale: 0,
        rotate: -3,
        stagger: {
          each: 0.05,
          repeat: -1
        }
      }
    ).seek(100);

    // Keep splash visible, then unmount cleanly
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 1500);

    const handleResize = () => {
      cw = canvas.width = window.innerWidth;
      ch = canvas.height = window.innerHeight;
      radius = Math.max(cw, ch);
      particleTl.invalidate();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      particleTl.kill();
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgb(14, 16, 15)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: '12px',
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <img 
        src="./intro/flair-4.png" 
        alt="Logo"
        style={{
          position: 'absolute',
          width: '200px',
          height: 'auto',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}
