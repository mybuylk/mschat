import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  setDoc, 
  serverTimestamp,
  updateDoc,
  getDoc,
  getDocs,
  writeBatch,
  Timestamp
} from "firebase/firestore";
import { auth, db, OperationType, handleFirestoreError } from "./lib/firebase";
import { UserProfile, ChatRoom, Message } from "./types";
import { AuthScreen } from "./components/AuthScreen";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatArea } from "./components/ChatArea";
import { ProfileModal } from "./components/ProfileModal";
import { ImageModal } from "./components/ImageModal";
import { UserDetailsView } from "./components/UserDetailsView";
import { PinLockScreen } from "./components/PinLockScreen";
import { StorageManager } from "./components/StorageManager";
import { 
  MessageSquare, 
  ShieldCheck, 
  Wifi, 
  Tablet, 
  Compass, 
  Power,
  Sparkles,
  Loader2,
  Lock,
  X,
  Check
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showUserDetailsUserId, setShowUserDetailsUserId] = useState<string | null>(null);
  
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isSessionPinUnlocked, setIsSessionPinUnlocked] = useState(false);

  const [pinnedChats, setPinnedChats] = useState<string[]>([]);
  const [lockedChats, setLockedChats] = useState<string[]>([]);
  const [isLockedUnlocked, setIsLockedUnlocked] = useState(false);
  const [activeAccountIndex, setActiveAccountIndex] = useState(0);
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [storageMessages, setStorageMessages] = useState<Message[]>([]);

  // Secure locked folder custom state hooks
  const [isLockFolderOpenChallenge, setIsLockFolderOpenChallenge] = useState(false);
  const [lockedFolderChallengeInput, setLockedFolderChallengeInput] = useState("");
  const [lockedFolderChallengeError, setLockedFolderChallengeError] = useState<string | null>(null);
  const [lockedFolderChallengeSuccess, setLockedFolderChallengeSuccess] = useState(false);

  // Call active state to prevent inactivity lock
  const [isCallActive, setIsCallActive] = useState(false);

  // 1. Listen to Auth state changes and handle presence
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoadingAuth(false);
      
      if (firebaseUser) {
        // Set presence state online
        try {
          await updateOnlineStatus(firebaseUser.uid, true);
        } catch (err) {
          console.warn("Could not set initial online state:", err);
        }

        // Handle abrupt disconnection / tab close via window unload
        const handleTabClose = () => {
          // SendBeacon pattern is sometimes unreliable, but synchronous updateDoc or firestore writes work well on beforeunload
          const userDocRef = doc(db, "users", firebaseUser.uid);
          updateDoc(userDocRef, {
            online: false,
            lastSeen: serverTimestamp()
          }).catch(() => {});
        };
        
        window.addEventListener("beforeunload", handleTabClose);
        return () => {
          window.removeEventListener("beforeunload", handleTabClose);
          handleTabClose();
        };
      } else {
        setCurrentUserProfile(null);
        setSelectedUserId(null);
        setIsSessionPinUnlocked(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Inactivity auto-lock timer: locks the screen after 3 seconds of touch or mouse inactivity
  useEffect(() => {
    const pinEnabledLocal = user ? localStorage.getItem(`pinEnabled_${user.uid}`) === "true" : false;
    const isPinEnabled = currentUserProfile?.pinEnabled || pinEnabledLocal;
    
    if (!user || !isPinEnabled || !isSessionPinUnlocked || isCallActive) {
      return;
    }

    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        setIsSessionPinUnlocked(false);
      }, 3000); // 3 seconds timeout
    };

    // Trigger initial timer on load/unlock
    resetTimer();

    // Listen to user touches, clicks, keyboard entries, and cursor movements
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "pointerdown"];
    
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, currentUserProfile, isSessionPinUnlocked, isCallActive]);

  // Update Firestore user presence key helper
  const updateOnlineStatus = async (uid: string, online: boolean) => {
    const userDocRef = doc(db, "users", uid);
    try {
      if (online && auth.currentUser) {
        // ALWAYS use setDoc with merge: true to ensure all user metadata is written (especially for a new Firebase project/database)
        const userData: any = {
          email: auth.currentUser.email || "",
          displayName: auth.currentUser.displayName || "New User",
          online: true,
          lastSeen: null,
          updatedAt: serverTimestamp()
        };
        if (auth.currentUser.photoURL) {
          userData.photoURL = auth.currentUser.photoURL;
        }
        await setDoc(userDocRef, userData, { merge: true });
      } else {
        await updateDoc(userDocRef, {
          online: online,
          lastSeen: online ? null : serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Error changing presence status, doing fallback setDoc", err);
      // Fallback if doc doesn't exist
      if (online && auth.currentUser) {
        const userData: any = {
          email: auth.currentUser.email || "",
          displayName: auth.currentUser.displayName || "New User",
          online: true,
          lastSeen: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (auth.currentUser.photoURL) {
          userData.photoURL = auth.currentUser.photoURL;
        }
        await setDoc(userDocRef, userData, { merge: true });
      }
    }
  };

  // 2. Listen to currentUserProfile changes from Firestore (real-time)
  useEffect(() => {
    if (!user) return;

    let active = true;
    const userDocPath = `users/${user.uid}`;
    const userDocRef = doc(db, "users", user.uid);

    let unsubscribeProfile: (() => void) | null = null;

    // Prefetch database/server values first to prime the firestore cache.
    // This blocks any potential state discrepancies from latency compensation on initial layout changes.
    getDoc(userDocRef).then((snapshot) => {
      if (!active) return;
      if (snapshot.exists()) {
        const data = snapshot.data();
        const pinEnabled = data.pinEnabled || false;
        const pinCode = data.pinCode || "";
        const biometricEnabled = data.biometricEnabled || false;
        
        setCurrentUserProfile({
          uid: snapshot.id,
          email: data.email || user.email || "",
          displayName: data.displayName || user.displayName || "User",
          photoURL: data.photoURL || null,
          online: data.online || false,
          lastSeen: data.lastSeen || null,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          pinEnabled,
          pinCode,
          biometricEnabled
        });

        localStorage.setItem(`pinEnabled_${user.uid}`, pinEnabled ? "true" : "false");
        localStorage.setItem(`pinCode_${user.uid}`, pinCode);
        localStorage.setItem(`biometricEnabled_${user.uid}`, biometricEnabled ? "true" : "false");
      }
      
      // Start live subscription
      unsubscribeProfile = onSnapshot(userDocRef, (snap) => {
        if (!active) return;
        if (snap.exists()) {
          const data = snap.data();
          const pinEnabled = data.pinEnabled || false;
          const pinCode = data.pinCode || "";
          const biometricEnabled = data.biometricEnabled || false;
          
          setCurrentUserProfile({
            uid: snap.id,
            email: data.email || user.email || "",
            displayName: data.displayName || user.displayName || "User",
            photoURL: data.photoURL || null,
            online: data.online || false,
            lastSeen: data.lastSeen || null,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            pinEnabled,
            pinCode,
            biometricEnabled
          });

          localStorage.setItem(`pinEnabled_${user.uid}`, pinEnabled ? "true" : "false");
          localStorage.setItem(`pinCode_${user.uid}`, pinCode);
          localStorage.setItem(`biometricEnabled_${user.uid}`, biometricEnabled ? "true" : "false");
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, userDocPath);
      });
    }).catch((err) => {
      console.warn("Could not prefetch profile during boot, falling back to instant stream:", err);
      if (!active) return;
      unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (!active) return;
        if (snap.exists()) {
          const data = snap.data();
          const pinEnabled = data.pinEnabled || false;
          const pinCode = data.pinCode || "";
          const biometricEnabled = data.biometricEnabled || false;
          
          setCurrentUserProfile({
            uid: snap.id,
            email: data.email || user.email || "",
            displayName: data.displayName || user.displayName || "User",
            photoURL: data.photoURL || null,
            online: data.online || false,
            lastSeen: data.lastSeen || null,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            pinEnabled,
            pinCode,
            biometricEnabled
          });

          localStorage.setItem(`pinEnabled_${user.uid}`, pinEnabled ? "true" : "false");
          localStorage.setItem(`pinCode_${user.uid}`, pinCode);
          localStorage.setItem(`biometricEnabled_${user.uid}`, biometricEnabled ? "true" : "false");
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, userDocPath);
      });
    });

    return () => {
      active = false;
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [user]);

  // 3. Listen to all registered contacts from Firestore
  useEffect(() => {
    // 1) Evaluate the PIN block using cached security values as well as current loaded profile
    const cachedPinEnabled = user ? localStorage.getItem(`pinEnabled_${user.uid}`) === "true" : false;
    const cachedPinCode = user ? localStorage.getItem(`pinCode_${user.uid}`) || "" : "";
    const isPinLocked = user && (
      (currentUserProfile && currentUserProfile.pinEnabled && currentUserProfile.pinCode && !isSessionPinUnlocked) ||
      (!currentUserProfile && cachedPinEnabled && cachedPinCode && !isSessionPinUnlocked)
    );

    // 2) Keep contacts securely empty and in loading state as long as profile is not loaded OR locked out by PIN
    if (!user || !currentUserProfile || isPinLocked) {
      setUsers([]);
      setLoadingUsers(user ? !isPinLocked : false);
      return;
    }

    const pathForUsersQuery = "all_users";
    const refUsers = collection(db, "users");
    setLoadingUsers(true);
    
    // Listen to all users so we have real-time profile dynamics
    const unsubscribeUsers = onSnapshot(refUsers, (snapshot) => {
      const allUsers: UserProfile[] = [];

      snapshot.forEach((docSnap) => {
        // Exclude current user from contact list
        if (docSnap.id !== user.uid) {
          const data = docSnap.data();
          allUsers.push({
            uid: docSnap.id,
            email: data.email || "",
            displayName: data.displayName || "Anonymous User",
            photoURL: data.photoURL || null,
            online: data.online || false,
            lastSeen: data.lastSeen || null,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null
          });
        }
      });
      setUsers(allUsers);
      setLoadingUsers(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, pathForUsersQuery);
    });

    return () => unsubscribeUsers();
  }, [user, currentUserProfile, isSessionPinUnlocked]);

  // 4. Listen to active chats metadata
  useEffect(() => {
    // 1) Evaluate the PIN block using cached security values as well as current loaded profile
    const cachedPinEnabled = user ? localStorage.getItem(`pinEnabled_${user.uid}`) === "true" : false;
    const cachedPinCode = user ? localStorage.getItem(`pinCode_${user.uid}`) || "" : "";
    const isPinLocked = user && (
      (currentUserProfile && currentUserProfile.pinEnabled && currentUserProfile.pinCode && !isSessionPinUnlocked) ||
      (!currentUserProfile && cachedPinEnabled && cachedPinCode && !isSessionPinUnlocked)
    );

    // 2) Keep active room states securely empty as long as profile is not loaded OR locked out by PIN
    if (!user || !currentUserProfile || isPinLocked) {
      setChats([]);
      return;
    }

    const chatsRef = collection(db, "chats");
    // Get chat rooms where the current user is a participant
    const q = query(chatsRef, where("participants", "array-contains", user.uid));

    const unsubscribeChats = onSnapshot(q, (snapshot) => {
      const activeRooms: ChatRoom[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        activeRooms.push({
          id: docSnap.id,
          participants: data.participants || [],
          lastMessage: data.lastMessage || "",
          lastMessageTimestamp: data.lastMessageTimestamp || null,
          unreadCount: data.unreadCount || {},
          typing: data.typing || {}
        });
      });
      setChats(activeRooms);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats [user=${user.uid}]`);
    });

    return () => unsubscribeChats();
  }, [user, currentUserProfile, isSessionPinUnlocked]);

  // Persistent Pins and Locks loading/saving logic
  useEffect(() => {
    if (currentUserProfile) {
      const savedPins = localStorage.getItem(`pinned_chats_${currentUserProfile.uid}`);
      if (savedPins) {
        try { setPinnedChats(JSON.parse(savedPins)); } catch {}
      } else {
        setPinnedChats([]);
      }

      const savedLocks = localStorage.getItem(`locked_chats_${currentUserProfile.uid}`);
      if (savedLocks) {
        try { setLockedChats(JSON.parse(savedLocks)); } catch {}
      } else {
        setLockedChats([]);
      }
    }
  }, [currentUserProfile?.uid]);

  // Storage listener to fetch files when StorageManager is open
  useEffect(() => {
    if (!isStorageOpen || !currentUserProfile) {
      setStorageMessages([]);
      return;
    }
    const q = query(
      collection(db, "messages")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((msgDoc) => {
        const data = msgDoc.data();
        if (data.fileURL && (data.from === currentUserProfile.uid || data.to === currentUserProfile.uid)) {
          list.push({ id: msgDoc.id, ...data } as Message);
        }
      });
      setStorageMessages(list);
    });
    return () => unsubscribe();
  }, [isStorageOpen, currentUserProfile?.uid]);

  const handleTogglePin = (uid: string) => {
    if (!currentUserProfile) return;
    const nextPins = pinnedChats.includes(uid)
      ? pinnedChats.filter((id) => id !== uid)
      : [...pinnedChats, uid];
    setPinnedChats(nextPins);
    localStorage.setItem(`pinned_chats_${currentUserProfile.uid}`, JSON.stringify(nextPins));
  };

  const handleToggleLock = (uid: string) => {
    if (!currentUserProfile) return;
    const nextLocks = lockedChats.includes(uid)
      ? lockedChats.filter((id) => id !== uid)
      : [...lockedChats, uid];
    setLockedChats(nextLocks);
    localStorage.setItem(`locked_chats_${currentUserProfile.uid}`, JSON.stringify(nextLocks));
    if (!isLockedUnlocked && nextLocks.includes(uid)) {
      setIsLockedUnlocked(true);
    }
  };

  const handleUnlockLockedFolder = () => {
    setIsLockFolderOpenChallenge(true);
    setLockedFolderChallengeInput("");
    setLockedFolderChallengeError(null);
    setLockedFolderChallengeSuccess(false);
  };

  const handleSecureFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasPin = currentUserProfile?.pinCode;
    const isSuccess = hasPin 
      ? lockedFolderChallengeInput === currentUserProfile.pinCode 
      : (lockedFolderChallengeInput.toLowerCase() === "unlock" || lockedFolderChallengeInput.trim() !== "");

    if (isSuccess) {
      setIsLockedUnlocked(true);
      setLockedFolderChallengeSuccess(true);
      setLockedFolderChallengeError(null);
      setTimeout(() => {
        setIsLockFolderOpenChallenge(false);
      }, 1200);
    } else {
      setLockedFolderChallengeError(hasPin ? "Incorrect PIN entered. Secure Folder is locked." : "Incorrect verification phrase. Enter 'unlock'.");
    }
  };

  const handleDeleteAsset = async (msgId: string) => {
    try {
      const msgRef = doc(db, "messages", msgId);
      await updateDoc(msgRef, {
        fileURL: null,
        fileType: null,
        fileName: null,
        text: "🚫 This file was removed to optimize storage space."
      });
    } catch (err) {
      console.error("Storage Asset delete error", err);
    }
  };

  const handleClearAllMedia = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "messages"));
      const batch = writeBatch(db);
      let count = 0;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.fileURL && (data.from === currentUserProfile?.uid || data.to === currentUserProfile?.uid)) {
          batch.update(docSnap.ref, {
            fileURL: null,
            fileType: null,
            fileName: null,
            text: "🚫 This file was removed to optimize storage space."
          });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
        alert(`Successfully optimized database schema! Cleared ${count} asset attachments.`);
      }
    } catch (err) {
      console.error("Clear media error", err);
    }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        // 1. Set presence offline cleanly
        await updateOnlineStatus(user.uid, false);
      } catch (e) {
        console.warn("Could not set offline state before logging out:", e);
      }
      // 2. Clear selected room
      setSelectedUserId(null);
      // 3. Complete signout
      await signOut(auth);
    }
  };

  // Get current selected contact profile info
  const selectedUser = users.find((u) => u.uid === selectedUserId) || null;

  // Not authenticated? Show Login UI immediately
  if (!loadingAuth && !user) {
    return <AuthScreen />;
  }

  // 1. PIN code security lock verification block (if enabled and not yet unlocked in current session)
  // Check either the real-time profile OR local cache fallback so it shows instantly on boot with no loading screen
  const cachedPinEnabled = user ? localStorage.getItem(`pinEnabled_${user.uid}`) === "true" : false;
  const cachedPinCode = user ? localStorage.getItem(`pinCode_${user.uid}`) || "" : "";
  const activePinCode = (currentUserProfile?.pinEnabled && currentUserProfile?.pinCode) ? currentUserProfile.pinCode : cachedPinCode;
  
  const isPinBlocked = user && (
    (currentUserProfile && currentUserProfile.pinEnabled && currentUserProfile.pinCode && !isSessionPinUnlocked) ||
    (!currentUserProfile && cachedPinEnabled && cachedPinCode && !isSessionPinUnlocked)
  );
  
  const cachedBiometricEnabled = user ? localStorage.getItem(`biometricEnabled_${user.uid}`) === "true" : false;
  const activeBiometricEnabled = currentUserProfile?.biometricEnabled ?? cachedBiometricEnabled;
  
  if (isPinBlocked) {
    return (
      <PinLockScreen
        correctPin={activePinCode}
        biometricEnabled={activeBiometricEnabled}
        onUnlock={() => setIsSessionPinUnlocked(true)}
        onLogout={handleLogout}
        userEmail={user.email || ""}
      />
    );
  }

  // Pre-profile load state OR general auth state loading. (Only shown if PIN is not locked/enabled)
  if (loadingAuth || (user && !currentUserProfile)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="animate-pulse bg-emerald-600 p-4 rounded-3xl shadow-lg mb-4">
          <MessageSquare className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">MS Chat Loading</h2>
        <div className="flex items-center gap-1.5 mt-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span className="text-xs font-semibold">Decrypting offline databases...</span>
        </div>
      </div>
    );
  }

  // Now if user was logged in and PIN screen has been unlocked successfully, check if contacts are still loading
  if (user && loadingUsers) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="animate-pulse bg-emerald-600 p-4 rounded-3xl shadow-lg mb-4">
          <MessageSquare className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Loading Contacts</h2>
        <div className="flex items-center gap-1.5 mt-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span className="text-xs font-semibold">Decrypting secure chats...</span>
        </div>
      </div>
    );
  }

  return (
    <div id="app_frame" className="min-h-[100dvh] w-full bg-slate-100 flex items-center justify-center p-0 font-sans chat-bg">
      {/* Maximum scale viewport */}
      <div className="w-full h-[100dvh] bg-white flex overflow-hidden">
        
        {/* Responsive left sidebar */}
        <ChatSidebar
          currentUserProfile={currentUserProfile}
          users={users}
          chats={chats}
          selectedUserId={selectedUserId}
          onSelectUser={(uid) => setSelectedUserId(uid)}
          onLogout={handleLogout}
          onOpenProfile={() => setIsProfileOpen(true)}
          hiddenOnMobile={selectedUserId !== null}
          activeAccountIndex={activeAccountIndex}
          onSwitchAccount={(idx) => setActiveAccountIndex(idx)}
          onOpenStorageManager={() => setIsStorageOpen(true)}
          pinnedChats={pinnedChats}
          onTogglePin={handleTogglePin}
          lockedChats={lockedChats}
          onToggleLock={handleToggleLock}
          isLockedUnlocked={isLockedUnlocked}
          onUnlockLockedFolder={handleUnlockLockedFolder}
        />

        {/* Responsive right chat area */}
        {selectedUserId ? (
          <ChatArea
            currentUserProfile={currentUserProfile}
            selectedUser={selectedUser}
            onBack={() => setSelectedUserId(null)}
            onOpenImageModal={(url) => setZoomedImage(url)}
            onCallActiveChange={setIsCallActive}
            onOpenUserDetails={(uid) => setShowUserDetailsUserId(uid)}
          />
        ) : users.length === 0 ? (
          /* Empty WhatsApp style default panel - Onboarding mode if no other users are available */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-50 border-l border-slate-100 h-full p-8 text-center">
            <div className="p-5 bg-emerald-50 rounded-full border border-emerald-100 mb-4 animate-pulse">
              <MessageSquare className="w-12 h-12 text-emerald-600" />
            </div>
            
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight mb-2">
              Welcome to MS Chat Web
            </h1>
            
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed mb-6 font-medium">
              Real-time messaging with instant presence indicators, typing effects, file uploads, and read-receipts. Offline-first synchronization is active.
            </p>

            {/* Micro details */}
            <div className="grid grid-cols-2 gap-4 max-w-md w-full border-t border-slate-100 pt-6 mt-2 text-slate-400 text-xs font-semibold">
              <div className="flex items-center gap-2 justify-center">
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span>Synchronized realtime</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Zero Trust Rule Guards</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <Tablet className="w-4 h-4 text-emerald-500" />
                <span>Desktop & Mobile</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <Compass className="w-4 h-4 text-emerald-500" />
                <span>Offline queue capabilities</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-300 font-bold uppercase mt-12 tracking-wider flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-spin" style={{ animationDuration: "12s" }} />
              <span>Tell your friends to sign up to start chatting!</span>
            </div>
          </div>
        ) : (
          /* Simple WhatsApp style default panel - Once contacts exist but none are currently selected */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-50 border-l border-slate-150 h-full p-8 text-center">
            <div className="p-5 bg-slate-100 rounded-full mb-4 text-slate-400">
              <MessageSquare className="w-10 h-10 text-slate-500" />
            </div>
            
            <h1 className="text-lg font-bold text-slate-700 tracking-tight mb-1 animate-pulse">
              Select a conversation
            </h1>
            
            <p className="text-slate-400 text-xs max-w-xs leading-relaxed font-semibold">
              Click on any contact in the sidebar list to start exchanging secure messages.
            </p>
          </div>
        )}
      </div>

      {/* User profile details modal layer */}
      {isProfileOpen && (
        <ProfileModal
          currentUserProfile={currentUserProfile}
          onClose={() => setIsProfileOpen(false)}
        />
      )}

      {/* Click-to-enlarge modal layer for images */}
      {zoomedImage && (
        <ImageModal
          photoURL={zoomedImage}
          onClose={() => setZoomedImage(null)}
        />
      )}

      {/* User profile details view layer */}
      {showUserDetailsUserId && (
        <UserDetailsView
          user={users.find((u) => u.uid === showUserDetailsUserId) || null}
          onBack={() => setShowUserDetailsUserId(null)}
        />
      )}

      {/* Storage optimization manager modal */}
      {isStorageOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="w-full max-w-2xl">
            <StorageManager
              messages={storageMessages}
              onDeleteAsset={handleDeleteAsset}
              onClearAllMedia={handleClearAllMedia}
              onClose={() => setIsStorageOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Responsive Custom Decryption Folder Challenge Modal */}
      {isLockFolderOpenChallenge && (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-4 z-[1000] animate-fade-in w-full h-full">
          <div className="bg-white w-full h-full overflow-hidden flex flex-col justify-center animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                  <Lock className="w-4 h-4" />
                </span>
                <span className="font-extrabold text-slate-800 text-sm tracking-tight">Decrypt Secure Folder</span>
              </div>
              <button 
                onClick={() => setIsLockFolderOpenChallenge(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                title="Cancel Decryption"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {lockedFolderChallengeError && (
              <div className="mb-4 p-2.5 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-100 font-semibold animate-shake">
                {lockedFolderChallengeError}
              </div>
            )}

            {lockedFolderChallengeSuccess && (
              <div className="mb-4 p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-100 font-bold flex items-center gap-1.5 animate-pulse">
                <Check className="w-4 h-4" />
                <span>Verification Succeeded! Folder Decrypted.</span>
              </div>
            )}

            <form onSubmit={handleSecureFolderSubmit} className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                {currentUserProfile?.pinCode 
                  ? "Enter your secure 4-digit chat PIN to reveal locked threads:" 
                  : "Type the bypass phrase 'unlock' to reveal the secure folder:"}
              </p>

              <div>
                {currentUserProfile?.pinCode ? (
                  <input
                    type="password"
                    maxLength={4}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    required
                    value={lockedFolderChallengeInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 4) setLockedFolderChallengeInput(val);
                    }}
                    placeholder="••••"
                    className="w-full text-center tracking-[1.5em] font-mono bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                  />
                ) : (
                  <input
                    type="text"
                    required
                    value={lockedFolderChallengeInput}
                    onChange={(e) => setLockedFolderChallengeInput(e.target.value)}
                    placeholder="Type 'unlock'"
                    className="w-full bg-slate-50 border border-slate-305 border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-center font-bold"
                  />
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsLockFolderOpenChallenge(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!lockedFolderChallengeInput || lockedFolderChallengeSuccess}
                  className="bg-emerald-600 hover:bg-emerald-750 text-white px-5 py-2 rounded-lg text-xs font-bold shadow disabled:bg-emerald-400 transition-all cursor-pointer"
                >
                  Confirm Decrypt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
