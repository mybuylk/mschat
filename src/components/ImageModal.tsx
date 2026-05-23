import React from "react";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";

interface ImageModalProps {
  photoURL: string | null;
  onClose: () => void;
}

export function ImageModal({ photoURL, onClose }: ImageModalProps) {
  if (!photoURL) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-center items-center bg-black/90 p-4 fade-in"
      id="zoom_image_modal_overlay"
    >
      {/* Header controls */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <a 
          href={photoURL} 
          target="_blank" 
          rel="noopener noreferrer" 
          download="chat_image.jpg"
          className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 rounded-full text-white cursor-pointer transition-colors shadow-lg"
          title="Download original file"
        >
          <Download className="w-5 h-5" />
        </a>
        <button 
          onClick={onClose}
          className="p-2.5 bg-slate-800/85 hover:bg-rose-600/90 rounded-full text-white cursor-pointer transition-colors shadow-lg"
          id="zoom_image_modal_close_btn"
          title="Close overlay"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main image holder with responsive scaling bounds */}
      <div className="max-w-[95%] max-h-[85%] relative flex justify-center items-center rounded-lg overflow-hidden border border-slate-700/30">
        <img 
          src={photoURL} 
          alt="Expanded zoom preview" 
          className="max-w-full max-h-[82vh] object-contain select-none"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Footer descriptor help text */}
      <div className="mt-4 text-xs text-slate-400 font-medium select-none text-center">
        Powered by MS Chat Secure Storage. Click close or tap overlay borders to exit.
      </div>
    </div>
  );
}
