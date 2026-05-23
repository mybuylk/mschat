import React, { useState } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, OperationType, handleFirestoreError } from "../lib/firebase";
import { compressImage, getAvatarFallbackColor } from "../lib/utils";
import { MessageSquare, Upload, Lock, Mail, User, Eye, EyeOff, CheckCircle } from "lucide-react";

export function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Handle avatar select
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError("Avatar file size must not exceed 10MB");
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  // Switch tabs
  const handleModeChange = (mode: "login" | "signup" | "forgot") => {
    setError(null);
    setInfoMessage(null);
    if (mode === "login") {
      setIsSignUp(false);
      setIsForgotPassword(false);
    } else if (mode === "signup") {
      setIsSignUp(true);
      setIsForgotPassword(false);
    } else {
      setIsForgotPassword(true);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (isForgotPassword) {
        // Password Reset Flow
        if (!email.trim()) {
          setError("Please enter your email address");
          setLoading(false);
          return;
        }
        await sendPasswordResetEmail(auth, email);
        setInfoMessage("Reset link has been sent to your email!");
        setLoading(false);
        return;
      }

      if (isSignUp) {
        // Sign Up Flow
        if (!displayName.trim()) {
          setError("Display Name is required");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

        // 1. Create User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        let photoURL = null;

        // 2. Upload avatar if selected (and compressed)
        if (avatarFile) {
          try {
            const compressedBlob = await compressImage(avatarFile, 200, 0.7);
            const avatarRef = ref(storage, `avatars/${user.uid}/profile_${Date.now()}.jpg`);
            await uploadBytes(avatarRef, compressedBlob);
            photoURL = await getDownloadURL(avatarRef);
          } catch (uploadErr) {
            console.error("Avatar upload failed, falling back to default", uploadErr);
          }
        }

        // 3. Update auth profile
        await updateProfile(user, {
          displayName: displayName.trim(),
          photoURL: photoURL
        });

        // 4. Save to Firestore (Users collection)
        const userDocPath = `users/${user.uid}`;
        try {
          await setDoc(doc(db, "users", user.uid), {
            email: email,
            displayName: displayName.trim(),
            photoURL: photoURL,
            online: true,
            lastSeen: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.WRITE, userDocPath);
        }

      } else {
        // Login Flow
        if (!email.trim() || !password) {
          setError("Please fill out all fields");
          setLoading(false);
          return;
        }
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update presence online with complete user profile details so they are not missing in a new database
        const userDocPath = `users/${user.uid}`;
        try {
          const userData: any = {
            email: user.email || "",
            displayName: user.displayName || "New User",
            online: true,
            lastSeen: null,
            updatedAt: serverTimestamp()
          };
          if (user.photoURL) {
            userData.photoURL = user.photoURL;
          }
          await setDoc(doc(db, "users", user.uid), userData, { merge: true });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.UPDATE, userDocPath);
        }
      }
    } catch (err: any) {
      console.error("Authentication Error:", err);
      const errMsg = err.message || String(err);
      const errCode = err.code || "";

      // Handle custom user-friendly error messages with fallback to substring search
      if (errCode === "auth/email-already-in-use" || errMsg.includes("email-already-in-use")) {
        setError("This email address is already registered or in use. Try signing in or use another email address.");
      } else if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed")) {
        setError("Email/Password authentication has not been enabled inside the Firebase Console of this project yet.");
      } else if (errCode === "auth/unauthorized-domain" || errMsg.includes("unauthorized-domain") || errMsg.includes("unauthorized-client")) {
        setError("NOT_AUTHORIZED_DOMAIN");
      } else if (
        errCode === "auth/invalid-credential" || 
        errMsg.includes("invalid-credential") || 
        errCode === "auth/wrong-password" || 
        errMsg.includes("wrong-password") || 
        errCode === "auth/user-not-found" || 
        errMsg.includes("user-not-found")
      ) {
        setError("Invalid email or password. Please double-check your credentials and try again.");
      } else if (errCode === "auth/weak-password" || errMsg.includes("weak-password")) {
        setError("Password is too weak. It must be at least 6 characters.");
      } else if (errCode === "auth/invalid-email" || errMsg.includes("invalid-email")) {
        setError("Please enter a valid email address (e.g., user@example.com).");
      } else {
        setError(errMsg || "An authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth_container" className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 chat-bg">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 fade-in">
        
        {/* Brand bar / Header */}
        <div className="bg-emerald-600 px-6 py-8 text-white flex flex-col items-center justify-center">
          <div className="p-3 bg-emerald-500 rounded-2xl shadow-inner mb-3">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">MS Chat</h1>
          <p className="text-xs text-emerald-100 mt-1">
            {isForgotPassword 
              ? "Recover Your Account" 
              : isSignUp 
                ? "Create Your Chat Account" 
                : "Real-time communication, simplified"}
          </p>
        </div>

        {/* Form area */}
        <div className="px-8 py-6">
          {error && (
            error === "NOT_AUTHORIZED_DOMAIN" ? (
              <div className="mb-5 p-4 bg-amber-50 rounded-xl border border-amber-250 text-xs shadow-xs text-slate-800 leading-relaxed text-left space-y-3">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-sm">
                  <span className="text-base">⚠️</span>
                  <span>Unauthorized Domain Error</span>
                </div>
                <p className="font-medium text-slate-700">
                  Firebase needs your approval to authorize connections from this app's domain. Please follow these simple steps to solve this:
                </p>
                <ol className="list-decimal pl-4.5 space-y-1.5 font-medium text-slate-700">
                  <li>
                    Go to the{" "}
                    <a 
                      href={`https://console.firebase.google.com/project/${auth.app.options.projectId}/authentication/settings`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-emerald-700 font-extrabold hover:underline inline-flex items-center gap-0.5"
                    >
                      Firebase Console Settings ↗
                    </a>
                  </li>
                  <li>Scroll down to the <span className="font-bold text-slate-900">Authorized Domains</span> section.</li>
                  <li>
                    Click <span className="font-bold text-slate-900">Add domain</span> and paste the following hostname:
                    <div className="my-1.5 flex items-center gap-1.5">
                      <code className="bg-slate-200/80 px-2 py-1 rounded text-[11px] font-mono text-slate-800 font-semibold select-all break-all border border-slate-350">
                        {window.location.hostname}
                      </code>
                    </div>
                  </li>
                  <li>Click <span className="font-bold text-slate-900">Add</span> to save it.</li>
                </ol>
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-[10px] text-slate-500 font-medium">
                  Once added, refresh this page and you'll be able to sign up and login smoothly!
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-150 font-medium font-sans">
                {error}
              </div>
            )
          )}

          {infoMessage && (
            <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-150 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                {/* Avatar upload */}
                <div className="flex flex-col items-center justify-center space-y-2 pb-2">
                  <div className="relative group">
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview} 
                        alt="Profile preview" 
                        className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold border-2 border-slate-300 bg-slate-400`}>
                        {displayName ? displayName.slice(0, 2).toUpperCase() : <User className="h-8 w-8 text-white" />}
                      </div>
                    )}
                    <label 
                      htmlFor="avatar-input" 
                      className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 rounded-full text-white cursor-pointer hover:bg-emerald-700 shadow shadow-slate-300 transition-colors"
                      title="Upload avatar"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </label>
                    <input 
                      id="avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    Upload avatar (default if blank, Max 10MB)
                  </span>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., John Doe"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            {!isForgotPassword && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-10 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg text-sm shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-emerald-400 disabled:cursor-not-allowed transition-all"
            >
              {loading 
                ? "Processing..." 
                : isForgotPassword 
                  ? "Send Reset Email" 
                  : isSignUp 
                    ? "Create Account" 
                    : "Login"}
            </button>
          </form>

          {/* Mode Switchers */}
          <div className="mt-6 pt-4 border-t border-slate-150 flex flex-col items-center space-y-2 text-xs">
            {isForgotPassword ? (
              <button 
                onClick={() => handleModeChange("login")}
                className="text-emerald-600 font-medium hover:underline cursor-pointer"
              >
                Back to Login
              </button>
            ) : (
              <>
                <div className="text-slate-500">
                  {isSignUp ? "Already have an account?" : "New to MS Chat?"}
                  <button
                    onClick={() => handleModeChange(isSignUp ? "login" : "signup")}
                    className="ml-1 text-emerald-600 font-semibold hover:underline cursor-pointer"
                  >
                    {isSignUp ? "Log In" : "Sign Up Now"}
                  </button>
                </div>
                {!isSignUp && (
                  <button
                    onClick={() => handleModeChange("forgot")}
                    className="text-slate-500 font-medium hover:text-emerald-600 cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </>
            )}
          </div>

          <div className="mt-6 text-center text-[10px] text-slate-400 max-w-xs mx-auto">
            By signing up, you agree to enable offline persistence and real-time synchronization on your device.
          </div>

        </div>
      </div>
    </div>
  );
}
