import React, { useState, useEffect } from "react";
import { Message, FileType } from "../types";
import { Trash2, AlertTriangle, Disc, Music, Image as ImageIcon, FileText, CheckCircle, RefreshCw } from "lucide-react";
import { formatBytes } from "../lib/utils";

interface StorageManagerProps {
  messages: Message[];
  onDeleteAsset?: (msgId: string) => void;
  onClearAllMedia?: () => void;
  onClose?: () => void;
}

interface StorageItem {
  id: string;
  fileName: string;
  fileType: FileType;
  fileURL: string;
  sizeBytes: number;
  fromName: string;
  timestamp: string;
}

export function StorageManager({ messages, onDeleteAsset, onClearAllMedia, onClose }: StorageManagerProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Parse media files out of the supplied messages to represent files with mock file sizes
  useEffect(() => {
    const list: StorageItem[] = [];
    messages.forEach((m) => {
      if (m.fileURL) {
        // Generate a mock file size based on name length to provide concrete data density
        const sizeSeed = (m.fileName || "").length * 1024 * 34 + 120531;
        list.push({
          id: m.id,
          fileName: m.fileName || "Shared File",
          fileType: m.fileType || "other",
          fileURL: m.fileURL,
          sizeBytes: sizeSeed,
          fromName: m.from === "current" ? "You" : "Contact",
          timestamp: m.timestamp ? new Date(m.timestamp.toMillis()).toLocaleDateString() : "Recent"
        });
      };
    });

    // Sort by largest files first
    list.sort((a, b) => b.sizeBytes - a.sizeBytes);
    setItems(list);
  }, [messages]);

  // Calculations
  const totalAllocatedBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
  const quotaBytes = 10 * 1024 * 1024; // 10MB default demo limit inside sandbox
  const allocatedPercentage = Math.min(100, Math.round((totalAllocatedBytes / quotaBytes) * 100));

  const imageStats = items.filter(i => i.fileType === "image").reduce((sum, i) => sum + i.sizeBytes, 0);
  const audioStats = items.filter(i => i.fileType === "audio" || i.fileType === "video").reduce((sum, i) => sum + i.sizeBytes, 0);
  const docStats = items.filter(i => i.fileType === "pdf" || i.fileType === "other").reduce((sum, i) => sum + i.sizeBytes, 0);

  const handleDeleteItemLocally = (id: string) => {
    if (onDeleteAsset) {
      onDeleteAsset(id);
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllLocally = () => {
    if (confirm("Are you sure you want to clear ALL media files from your active chat database? This action frees up the maximum space immediately.")) {
      if (onClearAllMedia) {
        onClearAllMedia();
      }
      setItems([]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-lg w-full max-w-2xl mx-auto fade-in">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Disc className="w-5 h-5 text-emerald-600 animate-spin-slow" />
          <h3 className="text-sm font-bold text-slate-800">Storage Optimization Manager</h3>
        </div>
        <button
          onClick={handleClearAllLocally}
          disabled={items.length === 0}
          className="text-xs bg-rose-50 hover:bg-rose-105 hover:text-rose-700 disabled:opacity-50 text-rose-600 border border-rose-100 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Clear All Media
        </button>
      </div>

      {/* Usage bar */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-5">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs font-semibold text-slate-500">Shared Sandbox Storage Quota</span>
          <span className="text-xs font-bold text-slate-800">
            {formatBytes(totalAllocatedBytes)} of {formatBytes(quotaBytes)} ({allocatedPercentage}%)
          </span>
        </div>

        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
          <div className="bg-indigo-500 h-full" style={{ width: `${(imageStats / quotaBytes) * 100}%` }} title="Images" />
          <div className="bg-amber-500 h-full" style={{ width: `${(audioStats / quotaBytes) * 100}%` }} title="Audio/Video" />
          <div className="bg-emerald-500 h-full" style={{ width: `${(docStats / quotaBytes) * 100}%` }} title="PDF Documents" />
        </div>

        {/* Categories labels */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-150 text-[10px] text-slate-500 font-medium">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full shrink-0" />
            <span>Images: <strong>{formatBytes(imageStats)}</strong></span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full shrink-0" />
            <span>Voice & Audio: <strong>{formatBytes(audioStats)}</strong></span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0" />
            <span>PDF Documents: <strong>{formatBytes(docStats)}</strong></span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {allocatedPercentage > 80 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-3 text-xs text-amber-800 flex items-start gap-2 mb-4">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <p className="font-bold">Low Storage Alert!</p>
            <p className="text-[11px] mt-0.5 text-amber-700 leading-relaxed">
              Your chat assets are approaching the 10MB sandbox limit. Use the list below to delete large image files or PDF documents.
            </p>
          </div>
        </div>
      )}

      {/* Files List sorted by size */}
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider sticky top-0 bg-white block pb-1.5">
          largest attachments in your database ({items.length} files)
        </label>

        {items.map((file) => (
          <div key={file.id} className="bg-white border border-slate-150 rounded-lg p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
            
            <div className="flex items-center gap-2.5 min-w-0">
              {file.fileType === "image" && <ImageIcon className="w-7 h-7 text-indigo-550 bg-indigo-50 p-1.5 rounded-lg shrink-0" />}
              {(file.fileType === "audio" || file.fileType === "video") && <Music className="w-7 h-7 text-amber-550 bg-amber-50 p-1.5 rounded-lg shrink-0" />}
              {file.fileType === "pdf" && <FileText className="w-7 h-7 text-emerald-555 bg-emerald-50 p-1.5 rounded-lg shrink-0" />}
              {file.fileType === "other" && <FileText className="w-7 h-7 text-slate-500 bg-slate-100 p-1.5 rounded-lg shrink-0" />}

              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-850 truncate max-w-[280px]">{file.fileName}</p>
                <span className="text-[9px] text-slate-400 block font-medium">
                  {file.timestamp} • Sent by {file.fromName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-slate-700">
                {formatBytes(file.sizeBytes)}
              </span>

              <button
                onClick={() => handleDeleteItemLocally(file.id)}
                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                title="Delete attachment file completely"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-bold">Storage is completely optimal!</p>
            <p className="text-[10px] text-slate-400 mt-0.5">No medium attachments found in your database.</p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Done
        </button>
      </div>

    </div>
  );
}
