import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let angle = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        // Resting state
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#E2E8F0'; // slate-200
        ctx.fill();
        return;
      }

      // Active state: Pulsing circles based on volume
      // Base radius + volume expansion
      const baseRadius = 40;
      const expansion = Math.min(volume * 100, 80); 
      
      // Outer glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + expansion + (Math.sin(angle) * 5), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(113, 75, 103, 0.2)'; // Odoo purple transparent
      ctx.fill();

      // Middle ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + (expansion * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(1, 126, 132, 0.3)'; // Odoo teal transparent
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + (expansion * 0.2), 0, Math.PI * 2);
      ctx.fillStyle = '#714B67'; // Odoo purple solid
      ctx.fill();

      angle += 0.05;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [isActive, volume]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={300} 
      className="w-full h-full max-w-[300px] max-h-[300px]"
    />
  );
};

export default Visualizer;