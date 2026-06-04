import React, { useEffect, useRef } from 'react';

interface Commit {
  hash: string;
  parents: string[];
  message: string;
  refs: string;
}

interface GraphProps {
  commits: Commit[];
  rowHeight: number;
}

const COLORS = [
  '#4a9eff', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd'
];

// Helper for rounded rect
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

export const GitGraph: React.FC<GraphProps> = ({ commits, rowHeight }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !commits.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- High DPI Handling ---
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 400;
    const displayHeight = commits.length * rowHeight;
    
    // Set actual size in memory
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    
    // Set display size in CSS
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    // Scale all drawing operations by dpr
    ctx.scale(dpr, dpr);
    // -------------------------

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const activeLanes: (string | null)[] = [];
    const commitLanes: number[] = [];

    // Calculate lanes
    commits.forEach((commit, i) => {
      let laneIndex = activeLanes.indexOf(commit.hash);
      if (laneIndex === -1) {
        laneIndex = activeLanes.indexOf(null);
        if (laneIndex === -1) {
          laneIndex = activeLanes.length;
          activeLanes.push(commit.hash);
        } else {
          activeLanes[laneIndex] = commit.hash;
        }
      }
      commitLanes[i] = laneIndex;

      activeLanes[laneIndex] = null;
      commit.parents.forEach(parentHash => {
        if (activeLanes.indexOf(parentHash) === -1) {
          const emptySlot = activeLanes.indexOf(null);
          if (emptySlot !== -1) {
            activeLanes[emptySlot] = parentHash;
          } else {
            activeLanes.push(parentHash);
          }
        }
      });
    });

    const laneWidth = 12;
    const xOffset = 10;
    
    // Pass 1: Draw lines
    commits.forEach((commit, i) => {
      const y = i * rowHeight + rowHeight / 2;
      const x = xOffset + commitLanes[i] * laneWidth;

      commit.parents.forEach(parentHash => {
        const parentIdx = commits.findIndex((c, idx) => idx > i && c.hash === parentHash);
        if (parentIdx !== -1) {
          const targetY = parentIdx * rowHeight + rowHeight / 2;
          const targetX = xOffset + commitLanes[parentIdx] * laneWidth;

          ctx.beginPath();
          ctx.strokeStyle = COLORS[commitLanes[i] % COLORS.length];
          ctx.lineWidth = 2;
          ctx.moveTo(x, y);
          
          if (x === targetX) {
            ctx.lineTo(targetX, targetY);
          } else {
            ctx.bezierCurveTo(x, y + rowHeight / 2, targetX, targetY - rowHeight / 2, targetX, targetY);
          }
          ctx.stroke();
        }
      });
    });

    // Pass 2: Draw nodes and refs
    commits.forEach((commit, i) => {
      const y = i * rowHeight + rowHeight / 2;
      const x = xOffset + commitLanes[i] * laneWidth;

      // Draw node
      ctx.beginPath();
      ctx.fillStyle = COLORS[commitLanes[i] % COLORS.length];
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Labels (Refs)
      if (commit.refs) {
        const refsArray = commit.refs.split(',').map(r => r.trim());
        let currentLabelX = x + 15;

        ctx.font = '11px sans-serif';
        refsArray.forEach(ref => {
          const isTag = ref.startsWith('tag: ');
          const labelText = isTag ? ref.replace('tag: ', '') : ref;
          
          const textWidth = ctx.measureText(labelText).width;
          const padding = 6;
          const labelWidth = textWidth + padding * 2;

          if (ref.includes('HEAD')) {
            ctx.fillStyle = '#1e3a5f';
            ctx.strokeStyle = '#6ab0f3';
          } else if (isTag) {
            ctx.fillStyle = '#4e4e10';
            ctx.strokeStyle = '#e2c08d';
          } else if (ref.includes('/')) {
            ctx.fillStyle = '#3b2d4a';
            ctx.strokeStyle = '#c09efd';
          } else {
            ctx.fillStyle = '#2d4a2d';
            ctx.strokeStyle = '#85e89d';
          }
          
          drawRoundedRect(ctx, currentLabelX, y - 8, labelWidth, 16, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, currentLabelX + padding, y + 1);

          currentLabelX += labelWidth + 6;
        });
      }
    });

  }, [commits, rowHeight]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ verticalAlign: 'top' }}
    />
  );
};
