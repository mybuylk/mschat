import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, Power, ArrowRightLeft, Smile, Lock, Fingerprint } from "lucide-react";

interface PinLockScreenProps {
  correctPin: string;
  biometricEnabled?: boolean;
  onUnlock: () => void;
  onLogout: () => void;
  userEmail: string;
}

export function PinLockScreen({ correctPin, biometricEnabled, onUnlock, onLogout, userEmail }: PinLockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [isBiometricPromptOpen, setIsBiometricPromptOpen] = useState(false);

  const handleBiometricUnlock = useCallback(async () => {
    if (!biometricEnabled) return;
    setIsBiometricPromptOpen(true);
    // Simulate real biometric scanning UX through PublicKeyCredential if preferred, 
    // but a reliable simulated wait creates the visual UX for preview environments:
    try {
      // In a real app we would call navigator.credentials.get(...)
      // Since it requires a valid domain and user credential registration, 
      // we mock the success time to mimic a biometric scan duration:
      await new Promise(resolve => setTimeout(resolve, 800));
      onUnlock(); // successfully authenticated
    } catch (err) {
      console.warn("Biometric failed", err);
    } finally {
      setIsBiometricPromptOpen(false);
    }
  }, [biometricEnabled, onUnlock]);

  // Attempt biometric when screen locks
  useEffect(() => {
    if (biometricEnabled && "credentials" in navigator) {
      handleBiometricUnlock();
    }
  }, [biometricEnabled, handleBiometricUnlock]);

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === correctPin) {
        onUnlock();
      } else {
        // Trigger shake & clear
        setError(true);
        setShake(true);
        const timer = setTimeout(() => {
          setShake(false);
          setPin("");
        }, 600);
        return () => clearTimeout(timer);
      }
    } else {
      setError(false);
    }
  }, [pin, correctPin, onUnlock]);

  const handleNumClick = (num: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-0 overflow-hidden">
      <div 
        className={`w-full h-full bg-slate-900 flex flex-col items-center justify-center p-5 sm:p-8 transition-transform duration-500 overflow-y-auto ${
          shake ? "animate-bounce" : ""
        }`}
        style={shake ? { animation: "shake 0.5s ease-in-out" } : undefined}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
            20%, 40%, 60%, 80% { transform: translateX(6px); }
          }
        `}} />
        
        {/* Animated App Icon inside a lock circle */}
        <div className="relative mb-6">
          <div className="bg-emerald-600/10 p-5 rounded-full border border-emerald-500/20 text-emerald-500 animate-pulse">
            <MessageSquare className="w-10 h-10" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-500 p-1.5 rounded-full border-2 border-slate-900 text-white shadow-md">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-extrabold text-white tracking-tight text-center">
          MS Chat Security Locked
        </h2>
        <p className="text-slate-400 text-xs mt-1 mb-6 text-center break-all font-medium">
          Logged in as <span className="text-emerald-400 font-semibold">{userEmail}</span>
        </p>

        {/* PIN Indicators showing dots */}
        <div className="flex gap-4 mb-8 justify-center items-center">
          {[0, 1, 2, 3].map((index) => {
            const isActive = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4.5 h-4.5 rounded-full transition-all duration-150 ${
                  error 
                    ? "bg-rose-500 scale-110 shadow-lg shadow-rose-500/30" 
                    : isActive 
                    ? "bg-emerald-500 scale-115 shadow-md shadow-emerald-500/40" 
                    : "bg-slate-700 border border-slate-600"
                }`}
              />
            );
          })}
        </div>

        {/* Status Error Message */}
        {error && (
          <p className="text-rose-400 text-xs font-bold mb-4 animate-pulse">
            Incorrect security PIN. Access denied.
          </p>
        )}

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-3.5 w-full max-w-[280px] mb-8 select-none">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleNumClick(num)}
              className="aspect-square flex items-center justify-center bg-slate-800/60 hover:bg-slate-700/80 active:bg-emerald-600/20 text-white font-mono font-bold text-xl rounded-2xl border border-slate-700/30 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            >
              {num}
            </button>
          ))}
          
          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleDelete}
            className="aspect-square flex flex-col items-center justify-center bg-slate-800/30 hover:bg-slate-700/40 text-slate-400 hover:text-white font-medium text-xs rounded-2xl transition-all cursor-pointer active:scale-95"
            title="Backspace"
          >
            Clear
          </button>
          
          {/* 0 Button */}
          <button
            type="button"
            onClick={() => handleNumClick("0")}
            className="aspect-square flex items-center justify-center bg-slate-800/60 hover:bg-slate-700/80 active:bg-emerald-600/20 text-white font-mono font-bold text-xl rounded-2xl border border-slate-700/30 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          >
            0
          </button>

          {/* Biometric trigger or fallback reset block */}
          {biometricEnabled ? (
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={isBiometricPromptOpen}
              className={`aspect-square flex flex-col items-center justify-center text-emerald-500 rounded-2xl transition-all cursor-pointer active:scale-95 bg-emerald-900/20 border border-emerald-900/30 hover:bg-emerald-900/40 hover:text-emerald-400 ${isBiometricPromptOpen ? 'animate-pulse' : ''}`}
              title="Use Fingerprint"
            >
              <Fingerprint className="w-8 h-8" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPin("")}
              className="aspect-square flex flex-col items-center justify-center bg-slate-800/30 hover:bg-slate-700/40 text-slate-400 hover:text-white font-medium text-xs rounded-2xl transition-all cursor-pointer active:scale-95"
              title="Reset"
            >
              Reset
            </button>
          )}
        </div>

        {/* Logout Fallback Option */}
        <button
          onClick={onLogout}
          className="text-slate-400 hover:text-white hover:bg-slate-800/50 hover:border-slate-700 px-4 py-2 border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
        >
          <Power className="w-3.5 h-3.5 text-rose-500" />
          <span>Login with another account</span>
        </button>
      </div>
    </div>
  );
}
