import React from "react";
import { UserProfile } from "../types";
import { X, ArrowLeft } from "lucide-react";

interface UserDetailsViewProps {
  user: UserProfile | null;
  onBack: () => void;
}

export function UserDetailsView({ user, onBack }: UserDetailsViewProps) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col h-full w-full animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-white shrink-0">
        <button 
          onClick={onBack} 
          className="p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-800">Contact Info</h2>
        <div className="w-10"></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <div className="relative mb-6">
          {user.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={user.displayName} 
              className="w-32 h-32 rounded-full object-cover border-4 border-emerald-50 shadow-md"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-emerald-500 flex items-center justify-center text-white text-5xl font-bold border-4 border-emerald-100 shadow-md">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        
        <h3 className="text-2xl font-bold text-slate-900 mb-2">{user.displayName}</h3>
        <p className="text-base text-slate-500 mb-8">{user.email}</p>

        <div className="w-full max-w-sm bg-slate-50 p-5 rounded-2xl border border-slate-100">
          <div className="flex justify-between text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">
            <span>Account Created</span>
          </div>
          <div className="text-base font-semibold text-slate-700">
            {user.createdAt ? (
              typeof (user.createdAt as any).toMillis === 'function' ? (
                new Date((user.createdAt as any).toMillis()).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              ) : user.createdAt instanceof Date ? (
                user.createdAt.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              ) : (
                String(user.createdAt)
              )
            ) : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}
