'use client';

import { useEffect, useRef } from 'react';

interface PhoenixAshProps {
    className?: string;
    intensity?: number;
    speed?: number;
}

export function PhoenixAsh({ className = '', intensity = 0.5, speed = 1 }: PhoenixAshProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to match container
        const resizeCanvas = () => {
            const container = canvas.parentElement;
            if (!container) return;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Ash particle class
        class AshParticle {
            x: number;
            y: number;
            size: number;
            speedX: number;
            speedY: number;
            opacity: number;
            rotationSpeed: number;
            rotation: number;
            canvasWidth: number;
            canvasHeight: number;

            constructor(x: number, y: number, canvasWidth: number, canvasHeight: number) {
                this.x = x;
                this.y = y;
                this.canvasWidth = canvasWidth;
                this.canvasHeight = canvasHeight;
                this.size = Math.random() * 3 + 1;
                this.speedX = (Math.random() * 2 - 1) * speed;
                this.speedY = (-Math.random() * 2 - 1) * speed;
                this.opacity = (Math.random() * 0.5 + 0.2) * intensity;
                this.rotationSpeed = (Math.random() - 0.5) * 0.02;
                this.rotation = Math.random() * Math.PI * 2;
            }

            update(canvasWidth: number, canvasHeight: number) {
                this.canvasWidth = canvasWidth;
                this.canvasHeight = canvasHeight;
                this.x += this.speedX;
                this.y += this.speedY;
                this.rotation += this.rotationSpeed;

                // Reset particle when it goes off screen
                if (this.y < -10 || this.x < -10 || this.x > this.canvasWidth + 10) {
                    this.x = Math.random() * this.canvasWidth;
                    this.y = this.canvasHeight + 10;
                    this.opacity = (Math.random() * 0.5 + 0.2) * intensity;
                }
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.globalAlpha = this.opacity;
                
                // Use Ashen Guard color palette - red/orange gradient
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 1.5);
                gradient.addColorStop(0, '#E63946'); // Phoenix blood red
                gradient.addColorStop(0.5, '#F77F00'); // Phoenix orange
                gradient.addColorStop(1, 'rgba(255, 210, 63, 0.3)'); // Phoenix yellow (faded)
                ctx.fillStyle = gradient;
                
                // Draw ember/ash shape (8-pointed star)
                ctx.beginPath();
                ctx.moveTo(-this.size, -this.size);
                ctx.lineTo(0, -this.size * 1.5);
                ctx.lineTo(this.size, -this.size);
                ctx.lineTo(this.size * 1.5, 0);
                ctx.lineTo(this.size, this.size);
                ctx.lineTo(0, this.size * 1.5);
                ctx.lineTo(-this.size, this.size);
                ctx.lineTo(-this.size * 1.5, 0);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
        }

        // Create particles with intensity-based count
        const particles: AshParticle[] = [];
        const baseParticleCount = Math.floor((canvas.width * canvas.height) / 15000);
        const particleCount = Math.floor(baseParticleCount * intensity);
        
        for (let i = 0; i < particleCount; i++) {
            particles.push(new AshParticle(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                canvas.width,
                canvas.height
            ));
        }

        // Animation loop
        let animationFrameId: number;
        const animate = () => {
            if (!canvas) return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(particle => {
                particle.update(canvas.width, canvas.height);
                particle.draw(ctx);
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        // Cleanup
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [intensity, speed]);

    return (
        <canvas
            ref={canvasRef}
            className={`${className} pointer-events-none`}
            style={{ background: 'transparent' }}
        />
    );
}