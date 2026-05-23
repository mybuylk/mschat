import React from "react";
import { UserProfile } from "../types";
import { X, User } from "lucide-react";

interface UserDetailsModalProps {
  user: UserProfile | null;
  onClose: () => void;
}

export function UserDetailsModal({ user, onClose }: UserDetailsModalProps) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">User Details</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center">
          <div className="relative mb-4">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName} 
                className="w-24 h-24 rounded-full object-cover border-4 border-emerald-50 shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-emerald-100 shadow-md">
                {user.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          
          <h3 className="text-lg font-bold text-slate-900 mb-1">{user.displayName}</h3>
          <p className="text-sm text-slate-500 mb-6">{user.email}</p>

          <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Account Created</span>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {user.createdAt ? new Date(user.createdAt.toMillis()).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
