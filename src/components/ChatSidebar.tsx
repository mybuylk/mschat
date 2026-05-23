import React, { useState } from "react";
import { UserProfile, ChatRoom } from "../types";
import { formatTime, getAvatarFallbackColor } from "../lib/utils";
import { 
  Search, 
  LogOut, 
  MessageSquare, 
  Shield, 
  Smile, 
  Sparkles, 
  Pin, 
  Lock, 
  Unlock, 
  Layers, 
  HardDrive, 
  Users, 
  ToggleLeft, 
  ToggleRight, 
  FolderLock, 
  Radio, 
  User,
  Trash2,
  FolderPlus
} from "lucide-react";

interface ChatSidebarProps {
  currentUserProfile: UserProfile | null;
  users: UserProfile[];
  chats: ChatRoom[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  hiddenOnMobile: boolean;
  
  // Custom smart triggers
  activeAccountIndex?: number;
  onSwitchAccount?: (index: number) => void;
  onOpenStorageManager?: () => void;
  
  // Pinned/Locked Chat control
  pinnedChats?: string[]; // uids of pinned users
  onTogglePin?: (userId: string) => void;
  lockedChats?: string[]; // uids of locked users
  onToggleLock?: (userId: string) => void;
  isLockedUnlocked?: boolean;
  onUnlockLockedFolder?: () => void;
}

export function ChatSidebar({
  currentUserProfile,
  users,
  chats,
  selectedUserId,
  onSelectUser,
  onLogout,
  onOpenProfile,
  hiddenOnMobile,
  
  activeAccountIndex = 0,
  onSwitchAccount,
  onOpenStorageManager,
  
  pinnedChats = [],
  onTogglePin,
  lockedChats = [],
  onToggleLock,
  isLockedUnlocked = false,
  onUnlockLockedFolder,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchClickCount, setSearchClickCount] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "work" | "family" | "locked" | "unread">("all");
  const [customTags, setCustomTags] = useState<{ [userId: string]: string }>({});

  // Helper load tags from localStorage
  React.useEffect(() => {
    if (currentUserProfile) {
      const saved = localStorage.getItem(`custom_tags_${currentUserProfile.uid}`);
      if (saved) {
        try {
          setCustomTags(JSON.parse(saved));
        } catch {
          setCustomTags({});
        }
      }
    }
  }, [currentUserProfile?.uid]);

  const handleTagContact = (userId: string, tag: "work" | "family" | "") => {
    if (!currentUserProfile) return;
    const nextTags = { ...customTags };
    if (tag === "") {
      delete nextTags[userId];
    } else {
      nextTags[userId] = tag;
    }
    setCustomTags(nextTags);
    localStorage.setItem(`custom_tags_${currentUserProfile.uid}`, JSON.stringify(nextTags));
  };

  // Build the list of active contacts with room details
  const contactsList = users
    .map((user) => {
      // Find chat metadata for this user pair
      const roomId =
        currentUserProfile && currentUserProfile.uid < user.uid
          ? `${currentUserProfile.uid}_${user.uid}`
          : currentUserProfile
          ? `${user.uid}_${currentUserProfile.uid}`
          : "";

      const chatMeta = chats.find((c) => c.id === roomId);
      const isPinned = pinnedChats?.includes(user.uid) || false;
      const isLocked = lockedChats?.includes(user.uid) || false;
      const customTag = customTags[user.uid] || "";

      return {
        user,
        roomId,
        lastMessage: chatMeta?.lastMessage || "",
        lastMessageTimestamp: chatMeta?.lastMessageTimestamp || null,
        unreadCount: currentUserProfile ? chatMeta?.unreadCount?.[currentUserProfile.uid] || 0 : 0,
        isTyping: currentUserProfile ? chatMeta?.typing?.[user.uid] === true : false,
        isPinned,
        isLocked,
        customTag,
      };
    })
    // Filter contacts based on search query or custom settings
    .filter((contact) => {
      const queryMatch = 
        contact.user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!queryMatch) return false;

      // Filter tags categories
      if (selectedFilter === "work") {
        return contact.customTag === "work";
      }
      if (selectedFilter === "family") {
        return contact.customTag === "family";
      }
      if (selectedFilter === "unread") {
        return contact.unreadCount > 0;
      }
      if (selectedFilter === "locked") {
        return contact.isLocked;
      }
      
      // Default: hide locked chats from standard lists unless "locked" filter is explicitly unlocked
      if (contact.isLocked) {
        return selectedFilter === "locked" && isLockedUnlocked;
      }

      return true;
    })
    // Sort contacts: priority is Pinned Chat stays on top, then lastMessageTimestamp, then alphabetically
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (a.lastMessageTimestamp && b.lastMessageTimestamp) {
        return b.lastMessageTimestamp.toMillis() - a.lastMessageTimestamp.toMillis();
      }
      if (a.lastMessageTimestamp) return -1;
      if (b.lastMessageTimestamp) return 1;
      return a.user.displayName.localeCompare(b.user.displayName);
    });

  return (
    <div
      id="sidebar_container"
      className={`w-full md:w-[35%] lg:w-[32%] bg-white border-r border-slate-200 flex flex-col h-full ${
        hiddenOnMobile ? "hidden md:flex" : "flex"
      } fade-in shadow-xs`}
    >
      {/* Sidebar Top Action bar */}
      <div className="bg-slate-50 px-3 xs:px-4 py-3 sm:py-3.5 flex flex-col gap-2 border-b border-slate-200 w-full shrink-0">
        
        {/* Profile info switcher */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 xs:gap-3 hover:opacity-90 flex-1 min-w-0 text-left cursor-pointer group"
            id="sidebar_profile_trigger"
            title="Open Profile Settings"
          >
            {currentUserProfile?.photoURL ? (
              <img
                src={currentUserProfile.photoURL}
                alt="Profile"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-emerald-500 shadow-sm transition-transform duration-200 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold border-2 border-emerald-500 shadow-xs text-xs sm:text-sm ${
                  currentUserProfile ? getAvatarFallbackColor(currentUserProfile.displayName) : "bg-slate-400"
                }`}
              >
                {currentUserProfile ? currentUserProfile.displayName.slice(0, 2).toUpperCase() : <Smile className="w-4 h-4" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors truncate">
                {currentUserProfile?.displayName}
              </h2>
              <span className="text-[9px] sm:text-[10px] text-emerald-600 font-semibold flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="truncate">{onSwitchAccount ? `Acc ${activeAccountIndex + 1}` : "Active"}</span>
              </span>
            </div>
          </button>

          {/* Quick interactive utility actions */}
          <div className="flex items-center gap-1 xs:gap-1.5 shrink-0">
            {/* Account Switcher Button */}
            {onSwitchAccount && (
              <button
                onClick={() => onSwitchAccount?.(activeAccountIndex === 0 ? 1 : 0)}
                className="p-1.5 xs:p-2 bg-slate-200 hover:bg-emerald-50 text-slate-650 hover:text-emerald-600 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs border border-slate-250/50"
                title="Instant switch to secondary multiple account"
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                <span className="text-[9px] sm:text-[10px]">Acc {activeAccountIndex === 0 ? "2" : "1"}</span>
              </button>
            )}

            {/* Storage optimization manager */}
            <button
              onClick={() => onOpenStorageManager?.()}
              className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg shrink-0 cursor-pointer"
              title="Optimize attach storage"
            >
              <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Logout button */}
            <button
              onClick={onLogout}
              id="sidebar_logout_btn"
              className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg shrink-0 cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Customizable Filters Navigation Lists */}
      <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200 overflow-x-auto scrollbar-none w-full shrink-0">
        <button
          onClick={() => setSelectedFilter("all")}
          className={`px-2.5 xs:px-3 py-1 text-[11px] xs:text-xs rounded-full font-bold transition-all shrink-0 cursor-pointer ${selectedFilter === "all" ? "bg-slate-700 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-200"}`}
        >
          All
        </button>
        <button
          onClick={() => setSelectedFilter("work")}
          className={`px-2.5 xs:px-3 py-1 text-[11px] xs:text-xs rounded-full font-bold transition-all shrink-0 cursor-pointer ${selectedFilter === "work" ? "bg-emerald-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-200"}`}
        >
          Work
        </button>
        <button
          onClick={() => setSelectedFilter("family")}
          className={`px-2.5 xs:px-3 py-1 text-[11px] xs:text-xs rounded-full font-bold transition-all shrink-0 cursor-pointer ${selectedFilter === "family" ? "bg-indigo-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-200"}`}
        >
          Family
        </button>
        <button
          onClick={() => setSelectedFilter("unread")}
          className={`px-2.5 xs:px-3 py-1 text-[11px] xs:text-xs rounded-full font-bold transition-all shrink-0 cursor-pointer ${selectedFilter === "unread" ? "bg-teal-600 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-200"}`}
        >
          Unread
        </button>
        
        {/* Secure Locked Folder trigger */}
        <button
          onClick={() => {
            if (!isLockedUnlocked) {
              onUnlockLockedFolder?.();
            }
            setSelectedFilter("locked");
          }}
          className={`px-2.5 xs:px-3 py-1 text-[11px] xs:text-xs rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${selectedFilter === "locked" ? "bg-yellow-600 text-white shadow-xs" : "bg-amber-100/60 hover:bg-amber-100 text-amber-800"}`}
        >
          <FolderLock className="w-3.5 h-3.5 text-amber-600" />
          <span>Locked Folder</span>
        </button>
      </div>

      {/* Search Input bar */}
      <div className="p-2.5 xs:p-3 bg-white border-b border-slate-100 w-full shrink-0">
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={() => {
              setSearchClickCount((prev) => {
                if (prev + 1 === 7) {
                  onUnlockLockedFolder?.();
                  return 0;
                }
                return prev + 1;
              });
            }}
            placeholder="Search matching profiles, emails..."
            className="w-full bg-slate-105 hover:bg-slate-50 border border-slate-100 focus:border-emerald-500/35 focus:bg-white rounded-lg pl-9 pr-4 py-2 sm:py-1.5 text-xs text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-1.5 focus:ring-emerald-500/20 transition-all font-medium"
          />
        </div>
      </div>

      {/* Contacts List wrapper */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {selectedFilter === "locked" && !isLockedUnlocked ? (
          // Secure lockout overlay for Locked folder filter
          <div className="flex flex-col items-center justify-center p-8 text-center h-48">
            <FolderLock className="w-10 h-10 text-amber-500 mb-2 animate-bounce" />
            <p className="text-xs font-bold text-slate-700">Chat Folder Locked</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
              Authenticate via Face ID fingerprint simulator or PIN code to reveal chats in this secure vault folder.
            </p>
            <button
              onClick={() => onUnlockLockedFolder?.()}
              className="mt-3 text-[11px] bg-amber-550 hover:bg-amber-653 text-white font-bold py-1.5 px-4 rounded-lg shadow-xs cursor-pointer"
            >
              Unlock Now
            </button>
          </div>
        ) : contactsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-401 font-semibold">No active matches found</p>
            <span className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
              {selectedFilter === "work" && "Mark some contacts as 'Work' using the tagging selectors!"}
              {selectedFilter === "family" && "Mark some contacts as 'Family' using the tagging selectors!"}
              {selectedFilter === "locked" && "Secure folders list is empty. Lock sensitive threads from the top bar."}
              {selectedFilter === "all" && "All clear! Synced contacts lists will dynamically render messaging records."}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {contactsList.map(({ user, lastMessage, lastMessageTimestamp, unreadCount, isTyping, isPinned, isLocked, customTag }) => {
              const isActive = selectedUserId === user.uid;
              return (
                <div
                  key={user.uid}
                  className={`group relative flex items-center bg-white hover:bg-slate-50 transition-all ${
                    isActive ? "bg-slate-105/90" : ""
                  }`}
                >
                  {/* Select User contact */}
                  <button
                    onClick={() => onSelectUser(user.uid)}
                    className={`flex-1 flex items-center gap-3 px-4 py-3.5 text-left relative cursor-pointer border-l-4 ${
                      isActive ? "border-emerald-500" : "border-transparent"
                    }`}
                  >
                    {/* Status Indicator Avatar wrapper */}
                    <div className="relative shrink-0">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold border border-slate-200 shadow-inner ${getAvatarFallbackColor(
                            user.displayName
                          )}`}
                        >
                          {user.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      
                      {/* Green dot for active online state */}
                      {user.online ? (
                        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                      ) : (
                        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-slate-305 border-2 border-white" />
                      )}
                    </div>

                    {/* Contact Preview details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-xs font-bold text-slate-800 truncate">
                            {user.displayName}
                          </h3>
                          
                          {/* Tags indicator */}
                          {customTag && (
                            <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${customTag === "work" ? "bg-emerald-50 text-emerald-800" : "bg-indigo-50 text-indigo-800"}`}>
                              {customTag}
                            </span>
                          )}

                          {isPinned && <Pin className="w-3 h-3 text-emerald-600 fill-emerald-100 shrink-0" />}
                          {isLocked && <Lock className="w-2.5 h-2.5 text-yellow-600 shrink-0" />}
                        </div>
                        {lastMessageTimestamp && (
                          <span className="text-[9px] text-slate-400 font-bold shrink-0">
                            {formatTime(lastMessageTimestamp)}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center">
                        {isTyping ? (
                          <span className="text-[11px] font-bold text-emerald-600 animate-pulse italic">
                            typing...
                          </span>
                        ) : (
                          <p className={`text-[11px] truncate pr-2 ${unreadCount > 0 ? "font-bold text-slate-800" : "text-slate-500"}`}>
                            {lastMessage || <span className="text-slate-400 italic">No messages yet</span>}
                          </p>
                        )}

                        {/* Unread Message Badge */}
                        {unreadCount > 0 && (
                          <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shrink-0 shadow-xs">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Inline micro controller menu: pinning and tags selection */}
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center shadow-md bg-white/95 rounded-lg border border-slate-150 p-1 gap-1 z-20 transition-all duration-155">
                    {/* Pin/Unpin */}
                    <button
                      onClick={() => onTogglePin?.(user.uid)}
                      className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${isPinned ? "text-emerald-600" : "text-slate-400"}`}
                      title={isPinned ? "Unpin Chat from top" : "Pin Chat to top"}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    {/* Lock / Unlock biometric simulator */}
                    <button
                      onClick={() => onToggleLock?.(user.uid)}
                      className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${isLocked ? "text-yellow-600" : "text-slate-400"}`}
                      title={isLocked ? "Remove Chat Lock" : "Secure Chat with biometric PIN Lock"}
                    >
                      {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>

                    {/* Tag selectors triggers */}
                    <div className="h-4 w-px bg-slate-200 mx-0.5" />
                    <button
                      onClick={() => handleTagContact(user.uid, customTag === "work" ? "" : "work")}
                      className={`p-1 rounded hover:bg-slate-100 text-[9px] font-bold cursor-pointer ${customTag === "work" ? "bg-emerald-50 text-emerald-800" : "text-slate-400"}`}
                      title="Tag as Work group"
                    >
                      W
                    </button>
                    <button
                      onClick={() => handleTagContact(user.uid, customTag === "family" ? "" : "family")}
                      className={`p-1 rounded hover:bg-slate-100 text-[9px] font-bold cursor-pointer ${customTag === "family" ? "bg-indigo-50 text-indigo-800" : "text-slate-400"}`}
                      title="Tag as Family group"
                    >
                      F
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Design block */}
      <div className="bg-slate-50 p-2 text-center text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-center gap-1.5 font-sans font-medium">
        <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
        <span>MS Chat Multi-Account enabled</span>
      </div>
    </div>
  );
}

