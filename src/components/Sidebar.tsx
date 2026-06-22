import { HugeiconsIcon } from '@hugeicons/react';
import { LibraryIcon as HugeLibIcon, Search02Icon, Settings05Icon } from '@hugeicons/core-free-icons';
import { LibraryIcon } from './LibraryIcon';

export type View = 'library' | 'search' | 'settings';

interface SidebarProps {
  active: View;
  onChange: (view: View) => void;
  onFeedback: () => void;
}

const Logo = () => (
  <div className="sidebar-logo-container">
    <img src="./intro/flair-4.png" alt="Logo" className="sidebar-logo-img" />
    <div className="logo-overlay">
      <div className="overlay-slice top" />
      <div className="overlay-slice right" />
      <div className="overlay-slice bottom" />
      <div className="overlay-slice left" />
    </div>
  </div>
);

export default function Sidebar({ active, onChange, onFeedback }: SidebarProps) {
  const isMac = navigator.platform.toLowerCase().includes('mac');

  const items: { view: View; icon: React.ReactNode; label: string }[] = [
    { view: 'library', icon: <LibraryIcon icon={HugeLibIcon} isActive={active === 'library'} />, label: 'Library' },
    { view: 'search', icon: <HugeiconsIcon icon={Search02Icon} size={24} />, label: 'Search' },
  ];

  return (
    <nav className={`sidebar${isMac ? ' macos-padding' : ''}`}>
      <Logo />
      <div className="sidebar-divider" />
      {items.map(item => (
        <button
          key={item.view}
          className={`sidebar-item${active === item.view ? ' active' : ''}`}
          onClick={() => onChange(item.view)}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
      <button
        className="sidebar-item"
        onClick={onFeedback}
        title="Send Feedback"
        style={{ marginTop: 'auto' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <button
        className={`sidebar-item${active === 'settings' ? ' active' : ''}`}
        onClick={() => onChange('settings')}
        title="Settings"
      >
        <HugeiconsIcon icon={Settings05Icon} size={24} />
      </button>
    </nav>
  );
}
