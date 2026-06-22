import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

interface MenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
  shortcut?: string;
}

interface SeparatorItem {
  separator: true;
}

type ContextMenuItem = MenuItem | SeparatorItem;

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

let globalShowMenu: ((items: ContextMenuItem[], x: number, y: number) => void) | null = null;

export function showContextMenu(items: ContextMenuItem[], x: number, y: number) {
  globalShowMenu?.(items, x, y);
}

export default function ContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    globalShowMenu = (items, x, y) => {
      // Clamp to viewport
      const menuW = 200;
      const menuH = items.length * 36;
      const clampedX = Math.min(x, window.innerWidth - menuW - 8);
      const clampedY = Math.min(y, window.innerHeight - menuH - 8);
      setMenu({ visible: true, x: clampedX, y: clampedY, items });
    };
    return () => { globalShowMenu = null; };
  }, []);

  const close = useCallback(() => {
    setMenu(prev => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    if (!menu.visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menu.visible, close]);

  if (!menu.visible) return null;

  return (
    <div ref={menuRef} className="context-menu" style={{ left: menu.x, top: menu.y }}>
      {menu.items.map((item, i) => {
        if ('separator' in item && item.separator) {
          return <div key={i} className="context-menu-separator" />;
        }
        const mi = item as MenuItem;
        return (
          <div
            key={i}
            className={`context-menu-item${mi.danger ? ' danger' : ''}`}
            onClick={() => {
              mi.onClick();
              close();
            }}
          >
            {mi.icon}
            <span>{mi.label}</span>
            {mi.shortcut && (
              <span className="context-menu-shortcut">{mi.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
