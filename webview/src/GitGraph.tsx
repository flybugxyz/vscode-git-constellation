import React, { useEffect, useRef } from 'react';

interface Commit {
  hash: string;
  parents: string[];
  message: string;
}

interface GraphProps {
  commits: Commit[];
  rowHeight: number;
  onWidthChange?: (width: number) => void;
}

const COLORS = [
  '#4a9eff', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd'
];

export const GitGraph: React.FC<GraphProps> = ({ commits, rowHeight, onWidthChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !commits.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeLanes: (string | null)[] = [];
    const commitLanes: number[] = [];
    let maxLanesCount = 0;

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
      maxLanesCount = Math.max(maxLanesCount, activeLanes.length);

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
      maxLanesCount = Math.max(maxLanesCount, activeLanes.length);
    });

    const laneWidth = 12;
    const xOffset = 10;
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate required width based on actual max lanes used
    const displayWidth = Math.max(40, (maxLanesCount) * laneWidth + xOffset + 10);
    const displayHeight = commits.length * rowHeight;
    
    // Notify parent of the calculated width
    if (onWidthChange) {
      onWidthChange(displayWidth);
    }

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

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

    // Pass 2: Draw nodes
    commits.forEach((commit, i) => {
      const y = i * rowHeight + rowHeight / 2;
      const x = xOffset + commitLanes[i] * laneWidth;

      ctx.beginPath();
      ctx.fillStyle = COLORS[commitLanes[i] % COLORS.length];
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.stroke();
    });

  }, [commits, rowHeight]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ verticalAlign: 'top' }}
    />
  );
};
