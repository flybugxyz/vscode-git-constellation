import React, { useEffect, useRef } from 'react';

interface Commit {
  hash: string;
  parents: string[];
  message: string;
}

interface GraphProps {
  commits: Commit[];
  rowHeight: number;
}

const COLORS = [
  '#4a9eff', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd'
];

export const GitGraph: React.FC<GraphProps> = ({ commits, rowHeight }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !commits.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const laneMap = new Map<string, number>();
    let nextLane = 0;
    const commitLanes: number[] = [];
    const activeLanes: (string | null)[] = [];

    // Calculate lanes
    commits.forEach((commit, i) => {
      // Find a lane for this commit
      let laneIndex = activeLanes.indexOf(commit.hash);
      if (laneIndex === -1) {
        // Find empty slot or push new
        laneIndex = activeLanes.indexOf(null);
        if (laneIndex === -1) {
          laneIndex = activeLanes.length;
          activeLanes.push(commit.hash);
        } else {
          activeLanes[laneIndex] = commit.hash;
        }
      }
      commitLanes[i] = laneIndex;

      // Update active lanes for children
      activeLanes[laneIndex] = null; // Remove current
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

    // Draw lines
    const laneWidth = 15;
    const xOffset = 10;
    
    // Pass 1: Draw lines between commits
    activeLanes.fill(null);
    const currentActiveLanes: {hash: string, lane: number}[] = [];

    commits.forEach((commit, i) => {
      const y = i * rowHeight + rowHeight / 2;
      const x = xOffset + commitLanes[i] * laneWidth;

      // Draw lines to parents
      commit.parents.forEach(parentHash => {
        // Find if parent is in next few commits
        const parentIdx = commits.findIndex((c, idx) => idx > i && c.hash === parentHash);
        if (parentIdx !== -1) {
          const targetY = parentIdx * rowHeight + rowHeight / 2;
          const targetX = xOffset + commitLanes[parentIdx] * laneWidth;

          ctx.beginPath();
          ctx.strokeStyle = COLORS[commitLanes[i] % COLORS.length];
          ctx.lineWidth = 2;
          ctx.moveTo(x, y);
          
          // Draw a nice curve or angled line
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
      
      // Outer circle for better visibility
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
      width={150} 
      height={commits.length * rowHeight}
      style={{ verticalAlign: 'top' }}
    />
  );
};
