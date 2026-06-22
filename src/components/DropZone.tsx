import { Upload01Icon } from '@hugeicons/core-free-icons';
import React, { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '@heroui/react';
import { AnimatedIcon } from './AnimatedIcon';

interface DropZoneProps {
  onFilesProcessed?: () => void;
}

export default function DropZone({ onFilesProcessed }: DropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFiles = async (paths: string[]) => {
    if (paths.length === 0) return;
    setProcessing(true);
    try {
      const results = await invoke<any[]>('handle_dropped_files', { paths });
      let successCount = 0;
      let failCount = 0;
      for (const r of results) {
        if (r.success) successCount++;
        else failCount++;
      }
      if (successCount > 0) {
        toast(`Installed ${successCount} file(s) successfully`, { description: "Files added" });
        onFilesProcessed?.();
      }
      if (failCount > 0) {
        toast(`${failCount} file(s) failed to install`);
      }
    } catch (e: any) {
      toast(e?.toString() || 'Failed to process files');
    } finally {
      setProcessing(false);
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const paths = files.map(f => (f as any).path).filter(Boolean);
    if (paths.length > 0) {
      await processFiles(paths);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const paths = files.map(f => (f as any).path).filter(Boolean);
    if (paths.length > 0) {
      await processFiles(paths);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      className={`drop-zone${dragActive ? ' active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <svg className="drop-zone-border" preserveAspectRatio="none">
        <rect x="0" y="0" width="100%" height="100%" rx="10" ry="10" />
      </svg>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".zip,.lua,.manifest"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {processing ? (
        <div className="drop-zone-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span className="spinner" />
          Processing files...
        </div>
      ) : (
        <div className="drop-zone-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <AnimatedIcon icon={Upload01Icon} size={24} className="no-drag" style={{ color: 'var(--text-muted)' }} />
          <span>
            <strong>Drop</strong> .zip, .lua, or .manifest files here, or <strong>click</strong> to browse
          </span>
        </div>
      )}
    </div>
  );
}
