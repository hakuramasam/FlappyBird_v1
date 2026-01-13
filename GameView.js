import React, { useEffect, useRef } from 'react';
import htm from 'htm';
import { GRAVITY, JUMP, PIPE_SPEED, PIPE_SPAWN_RATE, PIPE_GAP } from './constants.js';

const html = htm.bind(React.createElement);

export function GameView({ gameState, onGameOver, onScore, audioManager }) {
    const canvasRef = useRef(null);
    const gameRef = useRef({
        bird: { x: 50, y: 250, velocity: 0, width: 34, height: 24 },
        pipes: [],
        frame: 0,
        backgroundX: 0
    });

    const assets = useRef({
        bird: new Image(),
        pipe: new Image(),
        bg: new Image()
    });

    useEffect(() => {
        assets.current.bird.src = 'bird.png';
        assets.current.pipe.src = 'pipe.png';
        assets.current.bg.src = 'background.png';
    }, []);

    useEffect(() => {
        if (gameState !== 'PLAYING') {
            // Reset state if not playing
            gameRef.current = {
                bird: { x: 50, y: 250, velocity: 0, width: 34, height: 24 },
                pipes: [],
                frame: 0,
                backgroundX: 0
            };
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const update = () => {
            const { bird, pipes, frame } = gameRef.current;
            bird.velocity += GRAVITY;
            bird.y += bird.velocity;

            if (frame % PIPE_SPAWN_RATE === 0) {
                const minPipeHeight = 50;
                const maxPipeHeight = canvas.height - PIPE_GAP - 100;
                const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
                pipes.push({ x: canvas.width, topHeight, width: 52, passed: false });
            }

            for (let i = pipes.length - 1; i >= 0; i--) {
                const p = pipes[i];
                p.x -= PIPE_SPEED;
                const birdBox = { x: bird.x + 4, y: bird.y + 4, w: bird.width - 8, h: bird.height - 8 };
                
                if ((birdBox.x < p.x + p.width && birdBox.x + birdBox.w > p.x && birdBox.y < p.topHeight) ||
                    (birdBox.x < p.x + p.width && birdBox.x + birdBox.w > p.x && birdBox.y + birdBox.h > p.topHeight + PIPE_GAP)) {
                    onGameOver(gameRef.current.pipes.filter(p => p.passed).length);
                    return;
                }

                if (!p.passed && bird.x > p.x + p.width) {
                    p.passed = true;
                    onScore();
                    audioManager.playSound('score');
                }
                if (p.x + p.width < 0) pipes.splice(i, 1);
            }

            if (bird.y + bird.height > canvas.height || bird.y < 0) {
                onGameOver(gameRef.current.pipes.filter(p => p.passed).length);
                return;
            }

            gameRef.current.frame++;
            gameRef.current.backgroundX = (gameRef.current.backgroundX - 0.5) % canvas.width;
        };

        const render = () => {
            const { bird, pipes, backgroundX } = gameRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(assets.current.bg, backgroundX, 0, canvas.width, canvas.height);
            ctx.drawImage(assets.current.bg, backgroundX + canvas.width, 0, canvas.width, canvas.height);

            pipes.forEach(p => {
                ctx.save();
                ctx.translate(p.x + p.width / 2, p.topHeight);
                ctx.scale(1, -1);
                ctx.drawImage(assets.current.pipe, -p.width / 2, 0, p.width, 400);
                ctx.restore();
                ctx.drawImage(assets.current.pipe, p.x, p.topHeight + PIPE_GAP, p.width, 400);
            });

            ctx.save();
            ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
            ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.1)));
            ctx.drawImage(assets.current.bird, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
            ctx.restore();

            animationFrameId = requestAnimationFrame(() => {
                update();
                render();
            });
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState]);

    // Handle Jumps
    useEffect(() => {
        const handleInteraction = (e) => {
            if (gameState === 'PLAYING') {
                gameRef.current.bird.velocity = JUMP;
                audioManager.playSound('jump');
            }
        };
        window.addEventListener('mousedown', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        return () => {
            window.removeEventListener('mousedown', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, [gameState]);

    return html`<canvas ref=${canvasRef} width="320" height="480"></canvas>`;
}