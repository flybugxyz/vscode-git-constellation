import React, { useEffect, useRef } from 'react';
import { Commit } from './types';

interface GraphProps {
  commits: Commit[];
  rowHeight: number;
  onWidthChange?: (width: number) => void;
  isLinear?: boolean;
}

const COLORS = [
  '#4a9eff', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd'
];

export const GitGraph: React.FC<GraphProps> = ({ commits, rowHeight, onWidthChange, isLinear }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !commits.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const style = getComputedStyle(canvas);
    const bgColor = style.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';

    if (isLinear) {
      const displayWidth = 40;
      const displayHeight = commits.length * rowHeight;
      const xOffset = 20;
      if (onWidthChange) {
        onWidthChange(displayWidth);
      }
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Draw straight vertical connection line
      ctx.beginPath();
      ctx.strokeStyle = COLORS[0];
      ctx.lineWidth = 2;
      ctx.moveTo(xOffset, rowHeight / 2);
      ctx.lineTo(xOffset, (commits.length - 1) * rowHeight + rowHeight / 2);
      ctx.stroke();

      // Draw nodes
      commits.forEach((commit, i) => {
        const y = i * rowHeight + rowHeight / 2;
        ctx.beginPath();
        ctx.fillStyle = COLORS[0];
        ctx.arc(xOffset, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.strokeStyle = bgColor;
        ctx.lineWidth = 1;
        ctx.arc(xOffset, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      });
      return;
    }

    const commitIndices = new Map<string, number>();
    commits.forEach((c, idx) => {
      commitIndices.set(c.hash, idx);
    });

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
        const parentExistsInList = commitIndices.has(parentHash);
        if (parentExistsInList) {
          if (activeLanes.indexOf(parentHash) === -1) {
            const emptySlot = activeLanes.indexOf(null);
            if (emptySlot !== -1) {
              activeLanes[emptySlot] = parentHash;
            } else {
              activeLanes.push(parentHash);
            }
          }
        }
      });
      maxLanesCount = Math.max(maxLanesCount, activeLanes.length);
    });

    const laneWidth = 12;
    const xOffset = 10;
    
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
        const idxVal = commitIndices.get(parentHash);
        const parentIdx = (idxVal !== undefined && idxVal > i) ? idxVal : -1;
        if (parentIdx !== -1) {
          const targetY = parentIdx * rowHeight + rowHeight / 2;
          const targetX = xOffset + commitLanes[parentIdx] * laneWidth;

          ctx.beginPath();
          ctx.strokeStyle = COLORS[commitLanes[i] % COLORS.length];
          ctx.lineWidth = 2;
          if (x === targetX) {
            ctx.moveTo(x, y);
            ctx.lineTo(targetX, targetY);
          } else {
            const radius = Math.min(8, Math.abs(x - targetX));
            if (x < targetX) {
              // 下一个点在左边：先上再左
              ctx.moveTo(targetX, targetY);
              ctx.arcTo(targetX, y, x, y, radius);
              ctx.lineTo(x, y);
            } else {
              // 下一个点在右边：先右再上
              ctx.moveTo(targetX, targetY);
              ctx.arcTo(x, targetY, x, y, radius);
              ctx.lineTo(x, y);
            }
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
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = 1;
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.stroke();
    });

  }, [commits, rowHeight, isLinear]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ verticalAlign: 'top' }}
    />
  );
};
