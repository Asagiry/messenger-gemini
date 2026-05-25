import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  text: string;
  opacity: number;
  opacityDir: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

interface ParticleBackgroundProps {
  useEmojis?: boolean;
}

const EMOJI_POOL = ['✨', '💬', '💜', '🦄', '⭐', '🎈', '💖', '👋', '🔮', '🛸'];
const GLOW_COLORS = ['rgba(99, 102, 241, 0.08)', 'rgba(168, 85, 247, 0.08)', 'rgba(217, 70, 239, 0.06)'];

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ useEmojis = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const particleCount = Math.min(30, Math.floor((canvas.width * canvas.height) / 45000));
      
      for (let i = 0; i < particleCount; i++) {
        const isEmoji = useEmojis && Math.random() > 0.4;
        const text = isEmoji ? EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)] : '•';
        const color = GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)];
        
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: isEmoji ? Math.random() * 16 + 14 : Math.random() * 40 + 20, // larger size for glow dots
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: (Math.random() - 0.5) * 0.4,
          text,
          opacity: Math.random() * 0.5 + 0.1,
          opacityDir: Math.random() > 0.5 ? 0.005 : -0.005,
          color,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.01
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Move particle
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        // Wrap around boundaries
        if (p.x < -p.size * 2) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.y < -p.size * 2) p.y = canvas.height + p.size;
        if (p.y > canvas.height + p.size) p.y = -p.size;

        // Pulse opacity
        p.opacity += p.opacityDir;
        if (p.opacity > 0.7) {
          p.opacity = 0.7;
          p.opacityDir = -0.003;
        } else if (p.opacity < 0.1) {
          p.opacity = 0.1;
          p.opacityDir = 0.003;
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;

        if (p.text !== '•') {
          // Render Emoji
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.font = `${p.size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.text, 0, 0);
        } else {
          // Render glowing sphere background glow
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          gradient.addColorStop(0, p.color);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [useEmojis]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
