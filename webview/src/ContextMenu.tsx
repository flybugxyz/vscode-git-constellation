import React, { useEffect, useRef, useState } from 'react';

export type MenuItem = {
  label: string;
  icon?: string;
  action?: string;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  submenu?: MenuItem[];
};

export type MenuSeparator = { type: 'separator', hidden?: boolean };

export type MenuEntry = MenuItem | MenuSeparator;

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuEntry[];
  onAction: (action: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [activeSubmenuIndex, setActiveSubmenuIndex] = useState<number | null>(null);

  // Filter out hidden items right away
  const visibleItems = items.filter(item => !item.hidden);

  useEffect(() => {
    // Adjust position to stay within viewport
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 10;
      }
      if (y + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 10;
      }
      
      if (newX < 0) newX = 10;
      if (newY < 0) newY = 10;

      setAdjustedPos({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Need timeout so it doesn't immediately close from the click that opened it
    const timerId = setTimeout(() => {
      window.addEventListener('mousedown', handleGlobalClick);
      window.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timerId);
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleItemClick = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.disabled || item.submenu) return;
    if (item.action) {
      onAction(item.action);
    }
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {visibleItems.map((entry, index) => {
        if ('type' in entry && entry.type === 'separator') {
          return <div key={`sep-${index}`} className="context-menu-separator" />;
        }

        const item = entry as MenuItem;
        return (
          <div
            key={`item-${index}-${item.label}`}
            className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={(e) => handleItemClick(item, e)}
            onMouseEnter={() => {
              if (item.submenu) {
                setActiveSubmenuIndex(index);
              } else {
                setActiveSubmenuIndex(null);
              }
            }}
          >
            {item.icon && <span className={`codicon codicon-${item.icon}`}></span>}
            <span className="context-menu-label">{item.label}</span>
            {item.submenu && <span className="codicon codicon-chevron-right submenu-arrow"></span>}
            
            {item.submenu && activeSubmenuIndex === index && (
              <div className="context-menu-submenu context-menu">
                {item.submenu.filter(sub => !sub.hidden).map((sub, subIdx) => {
                  if ('type' in sub && sub.type === 'separator') {
                    return <div key={`subsep-${subIdx}`} className="context-menu-separator" />;
                  }
                  const subItem = sub as MenuItem;
                  return (
                    <div
                      key={`subitem-${subIdx}-${subItem.label}`}
                      className={`context-menu-item ${subItem.danger ? 'danger' : ''} ${subItem.disabled ? 'disabled' : ''}`}
                      onClick={(e) => handleItemClick(subItem, e)}
                    >
                      {subItem.icon && <span className={`codicon codicon-${subItem.icon}`}></span>}
                      <span className="context-menu-label">{subItem.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
