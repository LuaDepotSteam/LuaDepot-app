import { invoke } from '@tauri-apps/api/core';

export function WindowControls() {
  const handleMinimize = async () => {
    try {
      await invoke('minimize_window');
    } catch (e) { console.error('Minimize failed', e); }
  };
  const handleMaximize = async () => {
    try {
      await invoke('toggle_maximize_window');
    } catch (e) { console.error('Maximize failed', e); }
  };
  const handleClose = async () => {
    try {
      await invoke('close_window');
    } catch (e) { console.error('Close failed', e); }
  };

  return (
    <div className="window-controls" style={{ display: 'flex' }}>
      <button className="control-btn" onClick={handleMinimize} title="Minimize">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button className="control-btn" onClick={handleMaximize} title="Maximize">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      </button>
      <button className="control-btn close" onClick={handleClose} title="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
