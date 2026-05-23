import React, { useState } from "react";
import { updateProfile, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage, OperationType, handleFirestoreError } from "../lib/firebase";
import { UserProfile } from "../types";
import { compressImage } from "../lib/utils";
import { X, Camera, Clipboard, Trash2, ArrowRight, ShieldAlert, Check, User } from "lucide-react";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

interface ProfileModalProps {
  currentUserProfile: UserProfile | null;
  onClose: () => void;
}

export function ProfileModal({ currentUserProfile, onClose }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(currentUserProfile?.displayName || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentUserProfile?.photoURL || null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinEnabled, setPinEnabled] = useState(currentUserProfile?.pinEnabled || false);
  const [pinCode, setPinCode] = useState(currentUserProfile?.pinCode || "");
  const [biometricEnabled, setBiometricEnabled] = useState(currentUserProfile?.biometricEnabled || false);

  // Re-auth state for Account Deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit");
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setSuccess(false);
      setError(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserProfile) return;
    
    setLoading(true);
    setSuccess(false);
    setError(null);

    // Validate PIN inputs
    if (pinEnabled) {
      if (!/^\d{4}$/.test(pinCode)) {
        setError("PIN must be exactly 4 numeric digits.");
        setLoading(false);
        return;
      }
    }

    try {
      let finalPhotoURL = currentUserProfile.photoURL;

      // 1. Upload new photo if selected
      if (avatarFile) {
        // Compress first - 150px keeps it extremely lightweight for potential Base64 storage
        const compressedBlob = await compressImage(avatarFile, 150, 0.6);
        
        const isStorageUnusable = false;
        if (isStorageUnusable) {
          console.log("Local Storage Flag indicates Storage is unusable. Direct Base64 Fallback.");
          finalPhotoURL = await blobToBase64(compressedBlob);
        } else {
          try {
            // Attempt Storage upload with a 3-second response timeout
            const avatarRef = ref(storage, `avatars/${currentUserProfile.uid}/profile_${Date.now()}.jpg`);
            
            const uploadPromise = (async () => {
              await uploadBytes(avatarRef, compressedBlob);
              return await getDownloadURL(avatarRef);
            })();

            const timeoutPromise = new Promise<string>((_, reject) => {
              setTimeout(() => reject(new Error("Storage upload timed out (hang protective trigger)")), 30000);
            });

            finalPhotoURL = await Promise.race([uploadPromise, timeoutPromise]);

            // Optional: Attempt to delete old storage avatar
            if (currentUserProfile.photoURL && currentUserProfile.photoURL.startsWith("http") && !currentUserProfile.photoURL.startsWith("data:")) {
              try {
                const oldRef = ref(storage, currentUserProfile.photoURL);
                if (oldRef) await deleteObject(oldRef);
              } catch (delErr) {
                console.warn("Could not delete old avatar, might not exist or storage limits:", delErr);
              }
            }
          } catch (storageErr) {
            console.log("Firebase Storage upload failed, falling back to Base64:", storageErr);
            // Convert to Base64 data URL
            finalPhotoURL = await blobToBase64(compressedBlob);
          }
        }
      }

      // 2. Update Auth Profile
      const authProfileParams: { displayName: string; photoURL?: string | null } = {
        displayName: displayName.trim(),
      };
      
      // Firebase Auth limits photoURL to ~2048 characters. 
      // If we fallback to base64, it might exceed this limit.
      if (finalPhotoURL === null || finalPhotoURL.length < 2000) {
        authProfileParams.photoURL = finalPhotoURL;
      }
      
      await updateProfile(auth.currentUser, authProfileParams);

      // 3. Update Firestore
      const userDocPath = `users/${currentUserProfile.uid}`;
      try {
        await updateDoc(doc(db, "users", currentUserProfile.uid), {
          displayName: displayName.trim(),
          photoURL: finalPhotoURL,
          pinEnabled: pinEnabled,
          pinCode: pinEnabled ? pinCode : "",
          biometricEnabled: biometricEnabled,
          updatedAt: serverTimestamp()
        });
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.UPDATE, userDocPath);
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while saving profile");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !currentUserProfile) return;

    setDeleting(true);
    setError(null);

    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(user, credential);

      // 2. Clear Firestore user
      const userDocPath = `users/${user.uid}`;
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.DELETE, userDocPath);
      }

      // 3. Optional: Delete Storage file
      if (currentUserProfile.photoURL) {
        try {
          const fileRef = ref(storage, currentUserProfile.photoURL);
          await deleteObject(fileRef);
        } catch (stErr) {
          console.warn("Storage deletion error during account deletion:", stErr);
        }
      }

      // 4. Delete Auth instance
      await deleteUser(user);
      
      // Page reload will trigger auth reset
      window.location.reload();
    } catch (err: any) {
      console.error("Deletion Error:", err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid password. Re-authentication failed.");
      } else {
        setError(err.message || "Could not delete your account. Try logging out first.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div id="profile_modal_overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-white fade-in">
      <div className="bg-white w-full h-full flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-emerald-600 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Clipboard className="w-5 h-5 text-emerald-100" />
            <span className="font-semibold text-base sm:text-lg">My Profile Info</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-emerald-700 transition-colors cursor-pointer"
            id="profile_modal_close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-100 font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-150 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {!showDeleteConfirm ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Avatar section */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative group">
                  {avatarPreview ? (
                    <img 
                      src={avatarPreview} 
                      alt="Avatar" 
                      className="w-24 h-24 rounded-full object-cover border-4 border-emerald-100 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-slate-300 flex items-center justify-center text-white text-3xl font-bold border-4 border-emerald-100 shadow-md">
                      {displayName ? displayName.slice(0, 2).toUpperCase() : <User />}
                    </div>
                  )}
                  <label 
                    htmlFor="profile-avatar-input" 
                    className="absolute bottom-0 right-0 p-2 bg-emerald-600 rounded-full text-white cursor-pointer hover:bg-emerald-700 shadow-lg border border-white transition-transform duration-200 group-hover:scale-110"
                    title="Change Avatar"
                  >
                    <Camera className="w-4 h-4" />
                  </label>
                  <input 
                    id="profile-avatar-input"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <span className="text-xs text-slate-500">
                  Select a new photo (Max 10MB)
                </span>
              </div>

              {/* Display name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Your Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter Display Name"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                />
              </div>

              {/* App PIN Lock Security */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">App PIN Lock Security</label>
                    <p className="text-[11px] text-slate-500">Require an access PIN when logging into the app</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pinEnabled}
                      onChange={(e) => {
                        setPinEnabled(e.target.checked);
                        if (!e.target.checked) setPinCode("");
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {pinEnabled && (
                  <div className="space-y-4 pt-2 border-t border-slate-200/60 transition-all">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-600">Choose 4-Digit PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="\d*"
                        inputMode="numeric"
                        required={pinEnabled}
                        value={pinCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (val.length <= 4) setPinCode(val);
                        }}
                        placeholder="••••"
                        className="w-full text-center tracking-[1.5em] font-mono bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                      />
                      <span className="block text-[10px] text-center text-slate-400">
                        Enter numbers only. You must input this PIN each time you log in or refresh.
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700">Biometric / Fingerprint</label>
                        <p className="text-[10px] text-slate-500">Allow scanning fingerprint to unlock faster</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={biometricEnabled}
                          onChange={(e) => setBiometricEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Email (Readonly) */}
              <div className="space-y-1 opacity-70">
                <label className="block text-xs font-semibold text-slate-600">Email Address (Permanent)</label>
                <input
                  type="email"
                  disabled
                  value={currentUserProfile?.email || ""}
                  className="w-full bg-slate-200 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-700 cursor-not-allowed font-medium"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow hover:shadow-md disabled:bg-emerald-400 transition-all cursor-pointer"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Re-authenticate + Account deletion */
            <form onSubmit={handleDeleteAccount} className="space-y-5">
              <div className="p-4 bg-rose-50 text-rose-800 rounded-xl border border-rose-100 flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 shrink-0 text-rose-600" />
                <div className="space-y-1.5 text-sm">
                  <span className="font-bold block">Danger Zone</span>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    This action is permanent and cannot be undone. You will lose access to this account. All messages we tracked might remain orphaned.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Please enter your password to confirm:
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                />
              </div>

              <div className="pt-2 border-t border-slate-150 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setPassword("");
                  }}
                  className="bg-slate-150 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  disabled={deleting || !password}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md flex items-center gap-1.5 transition-colors cursor-pointer disabled:bg-rose-400 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
