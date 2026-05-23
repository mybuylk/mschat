import { Timestamp } from "firebase/firestore";

/**
 * Format a Firebase Timestamp into a neat human-readable time or date string.
 */
export function formatTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const now = new Date();
  
  // Today: return 14:32
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  
  // Yesterday: return Yesterday
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  
  // Within 7 days: return of the week e.g. Wednesday
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  }
  
  // Older: MM/DD/YYYY
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Client-side image compression to shrink files before upload.
 * Max width 1200px, quality 0.7 as requested.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // If it's not a compressible image, don't compress
    if (!file.type.startsWith("image/") || file.type.includes("svg") || file.type.includes("gif")) {
      resolve(file);
      return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2D context for image compression"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas toBlob output is null"));
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
}

/**
 * Simple avatar fallback color hash based on user display-name or email.
 */
export function getAvatarFallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-pink-500",
    "bg-rose-500",
  ];
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Format filesizes for attachments in a friendly string.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Custom WhatsApp-style text formatter.
 * Implements Bold (*text*), Italic (_text_), Strikethrough (~text~),
 * Monospace (```text```), and Bulleted lists.
 */
export function formatWhatsAppTextToHTML(text: string): string {
  if (!text) return "";

  // Helper safely escapes HTML tags to avoid XSS before replacing custom markdown
  const escapeHTML = (str: string) => {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  };
  
  let formatted = escapeHTML(text);

  // 1. Monospace format: ```text```
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<span class="font-mono bg-slate-200/50 rounded-md px-1.5 py-0.5 text-xs text-slate-700">$1</span>');

  // 2. Bold format: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<strong class="font-extrabold">$1</strong>');

  // 3. Italic format: _text_
  formatted = formatted.replace(/_(.*?)_/g, '<em class="italic">$1</em>');

  // 4. Strikethrough format: ~text~
  formatted = formatted.replace(/~(.*?)~/g, '<del class="line-through text-slate-400">$1</del>');

  // 5. Bullet points format: start of line with "- " or "* " (after a newline)
  formatted = formatted.replace(/^(?:-|\*)\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>');
  
  // Wrap li items intelligently with ul tags
  formatted = formatted.replace(/(<li.*?>.*?<\/li>([\n\r\s]*))+/g, match => {
    return `<ul class="my-1.5 pl-2 space-y-0.5">${match}</ul>`;
  });

  return formatted;
}
