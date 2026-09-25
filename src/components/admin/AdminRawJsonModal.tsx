/**
 * Admin Raw JSON Modal / Viewer
 * Allows operators to inspect and copy raw API responses from /api/admin/*
 */

import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface AdminRawJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any;
}

export const AdminRawJsonModal: React.FC<AdminRawJsonModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonString).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-12 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{title}</span>
            <span className="text-[11px] text-slate-500 font-mono">
              ({jsonString.length.toLocaleString()} bytes)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* JSON Code Viewer */}
        <div className="flex-1 p-4 overflow-auto bg-slate-950 font-mono text-xs text-slate-300 leading-relaxed custom-scrollbar">
          <pre className="whitespace-pre">{jsonString}</pre>
        </div>
      </div>
    </div>
  );
};
