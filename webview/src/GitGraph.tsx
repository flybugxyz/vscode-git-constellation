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

export const GitGraph: React.FC<GraphProps> = ({ commits, rowHeight }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !commits.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    const laneWidth = 15;
    const xOffset = 10;
    
    // Draw lines
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

    // Draw nodes and refs
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
        let currentLabelX = xOffset + activeLanes.length * laneWidth + 10;

        ctx.font = '10px sans-serif';
        refsArray.forEach(ref => {
          const isTag = ref.startsWith('tag: ');
          const labelText = isTag ? ref.replace('tag: ', '') : ref;
          
          const textWidth = ctx.measureText(labelText).width;
          const padding = 4;
          const labelWidth = textWidth + padding * 2;

          // Background
          ctx.fillStyle = isTag ? '#4e4e10' : '#2d4a2d'; // Dark gold for tag, dark green for branch
          if (ref.includes('HEAD')) ctx.fillStyle = '#1e3a5f'; // Dark blue for HEAD
          
          ctx.roundRect?.(currentLabelX, y - 7, labelWidth, 14, 3);
          ctx.fill();

          // Border
          ctx.strokeStyle = isTag ? '#e2c08d' : '#85e89d';
          if (ref.includes('HEAD')) ctx.strokeStyle = '#6ab0f3';
          ctx.stroke();

          // Text
          ctx.fillStyle = 'white';
          ctx.fillText(labelText, currentLabelX + padding, y + 3);

          currentLabelX += labelWidth + 5;
        });
      }
    });

  }, [commits, rowHeight]);

  // Adjust width based on lanes and refs
  const maxLanes = 10; // Simple estimate
  const width = 200 + maxLanes * 15;

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={commits.length * rowHeight}
      style={{ verticalAlign: 'top' }}
    />
  );
};
