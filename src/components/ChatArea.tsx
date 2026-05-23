import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  doc, 
  addDoc,
  updateDoc,
  setDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch,
  getDocs,
  Timestamp,
  increment
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, OperationType, handleFirestoreError } from "../lib/firebase";
import { Message, UserProfile, FileType, ChatRoom } from "../types";
import { formatTime, compressImage, formatBytes, formatWhatsAppTextToHTML } from "../lib/utils";
import Peer, { MediaConnection } from "peerjs";
import { InternalCallLayer } from "./InternalCallLayer";
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  Music, 
  Download, 
  Check, 
  CheckCheck, 
  Trash2, 
  Volume2, 
  Loader2, 
  ExternalLink,
  CornerDownRight,
  Smile,
  AlertCircle,
  Clock,
  PhoneCall,
  MonitorUp,
  MicOff,
  Mic,
  CodeXml,
  Star,
  PencilLine,
  EyeOff,
  Eye,
  Film,
  Video,
  Copy,
  X,
  Ban,
  MoreVertical,
  Flag,
  Download,
  Plus,
  List
} from "lucide-react";
import { UserDetailsModal } from "./UserDetailsModal";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

interface ChatAreaProps {
  currentUserProfile: UserProfile | null;
  selectedUser: UserProfile | null;
  onBack: () => void;
  onOpenImageModal: (url: string) => void;
  onCallActiveChange?: (isActive: boolean) => void;
  onOpenUserDetails: (uid: string) => void;
}

export function ChatArea({ 
  currentUserProfile, 
  selectedUser, 
  onBack,
  onOpenImageModal,
  onCallActiveChange,
  onOpenUserDetails
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Message hold/longpress state
  const [activeActionMenuMessage, setActiveActionMenuMessage] = useState<Message | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [longPressActiveId, setLongPressActiveId] = useState<string | null>(null);
  const [locallyDeletedMsgIds, setLocallyDeletedMsgIds] = useState<string[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef<boolean>(false);
  
  // File attachments state
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Smart Features state
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [viewOnceOpened, setViewOnceOpened] = useState<{ [msgId: string]: boolean }>({});
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [activeReactionBarMessageId, setActiveReactionBarMessageId] = useState<string | null>(null);
  
  const [isStickerPackOpen, setIsStickerPackOpen] = useState(false);

  const [voiceTranscripts, setVoiceTranscripts] = useState<{ [msgId: string]: string }>({});
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<string | null>(null);
  
  // Video Notes
  const [isVideoNoteMode, setIsVideoNoteMode] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoRecordingTimer, setVideoRecordingTimer] = useState(0);

  // Call configuration
  const [activeCallType, setActiveCallType] = useState<"audio" | "video" | null>(null);
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const peerRef = useRef<Peer | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Initialize PeerJS
  useEffect(() => {
    if (!currentUserProfile?.uid) return;
    
    const peer = new Peer(currentUserProfile.uid, {
      debug: 2
    });
    
    peerRef.current = peer;

    peer.on('call', (call) => {
      // Check metadata or infer type. We'll set a generic "ringing" state.
      // If we are already in a call, we should reject it, but for simplicity:
      setIncomingCall(call);
      
      call.on('close', () => {
         setIncomingCall(null);
         setActiveCallType(null);
      });
    });

    return () => {
      peer.destroy();
    };
  }, [currentUserProfile?.uid]);

  const acceptIncomingCall = (type: "audio" | "video") => {
    if (incomingCall) {
      setActiveCallType(type);
      // The InternalCallLayer will handle `incomingCall.answer(stream)`
    }
  };

  const rejectIncomingCall = () => {
    if (incomingCall) {
      incomingCall.close();
      setIncomingCall(null);
    }
  };

  useEffect(() => {
    if (onCallActiveChange) {
      onCallActiveChange(activeCallType !== null);
    }
  }, [activeCallType, onCallActiveChange]);

  // Disappearing messages configuration (0 = Off, 24 = 24h, 168 = 7 days, 2160 = 90 days)
  const [disappearingHours, setDisappearingHours] = useState<number>(0);

  // Typing state
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate Chat Room ID
  const chatRoomId = selectedUser && currentUserProfile
    ? currentUserProfile.uid < selectedUser.uid
      ? `${currentUserProfile.uid}_${selectedUser.uid}`
      : `${selectedUser.uid}_${currentUserProfile.uid}`
    : "";

  // Load disappearing settings from LocalStorage
  useEffect(() => {
    if (chatRoomId) {
      const saved = localStorage.getItem(`disappearing_${chatRoomId}`);
      if (saved) {
        setDisappearingHours(Number(saved));
      } else {
        setDisappearingHours(0);
      }
    }
  }, [chatRoomId]);

  // Load locally deleted messages from LocalStorage
  useEffect(() => {
    if (chatRoomId) {
      const saved = localStorage.getItem(`deleted_for_me_${chatRoomId}`);
      if (saved) {
        setLocallyDeletedMsgIds(JSON.parse(saved));
      } else {
        setLocallyDeletedMsgIds([]);
      }
    }
  }, [chatRoomId]);

  // Reset active calls when chatRoom changes
  useEffect(() => {
    setActiveCallType(null);
  }, [chatRoomId]);

  const handleBubbleClick = (msg: Message) => {
  };



  const handleHoldStart = (e: React.MouseEvent | React.TouchEvent, msg: Message) => {
    isHoldingRef.current = true;
    setLongPressActiveId(msg.id);
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    longPressTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        setLongPressActiveId(null);
        isHoldingRef.current = false;
        setActiveActionMenuMessage(msg); // Just show the menu
        if (navigator.vibrate) {
          navigator.vibrate(40);
        }
      }
    }, 600);
  };

  const handleHoldEnd = () => {
    isHoldingRef.current = false;
    setLongPressActiveId(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleHoldMove = () => {
    handleHoldEnd();
  };

  const handleCopyText = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => {
      setCopiedMessageId(null);
      setActiveActionMenuMessage(null);
    }, 1500);
  };

  const handleDeleteForMe = (msgId: string) => {
    const updated = [...locallyDeletedMsgIds, msgId];
    setLocallyDeletedMsgIds(updated);
    localStorage.setItem(`deleted_for_me_${chatRoomId}`, JSON.stringify(updated));
    setActiveActionMenuMessage(null);
  };

  const handleToggleDisappearing = (hours: number) => {
    setDisappearingHours(hours);
    localStorage.setItem(`disappearing_${chatRoomId}`, String(hours));
    alert(`Disappearing messages set to: ${hours === 0 ? "Off" : hours === 24 ? "24 Hours" : hours === 168 ? "7 Days" : "90 Days"}`);
  };

  // 1. Listen to messages inside this chat room
  useEffect(() => {
    if (!chatRoomId || !selectedUser || !currentUserProfile) return;

    setLoading(true);
    const messagesRef = collection(db, "messages");
    
    // We query messages where chatId == chatRoomId to fetch messages
    const q = query(
      messagesRef, 
      where("chatId", "==", chatRoomId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          from: data.from,
          to: data.to,
          text: data.text,
          fileURL: data.fileURL,
          fileType: data.fileType,
          fileName: data.fileName,
          timestamp: data.timestamp || Timestamp.now(),
          read: data.read || false,
          isEdited: data.isEdited || false,
          isDeleted: !!data.isDeleted,
          isStarred: data.isStarred || false,
          isViewOnce: data.isViewOnce || false,
          isViewOnceOpened: data.isViewOnceOpened || false,
          voiceTranscript: data.voiceTranscript || ""
        });
      });

      // Filter local disappearing messages if active
      let filteredMsgs = msgs;
      if (disappearingHours > 0) {
        const thresholdMs = disappearingHours * 60 * 60 * 1000;
        const nowMs = Date.now();
        filteredMsgs = msgs.filter((msg) => {
          const msgTime = msg.timestamp ? msg.timestamp.toMillis() : nowMs;
          return nowMs - msgTime < thresholdMs;
        });
      }

      // Sort messages in-memory by timestamp to avoid requiring a composite firestore index
      filteredMsgs.sort((a, b) => {
        const tA = a.timestamp ? a.timestamp.toMillis() : 0;
        const tB = b.timestamp ? b.timestamp.toMillis() : 0;
        return tA - tB;
      });

      setMessages(filteredMsgs);
      setLoading(false);

      // Auto scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      // 2. Mark unread incoming messages as read
      markMessagesAsRead();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `messages [chatId=${chatRoomId}]`);
    });

    return () => unsubscribe();
  }, [chatRoomId, selectedUser?.uid, disappearingHours]);

  // 3. Listen to typing indicator dynamics on the chat document
  useEffect(() => {
    if (!chatRoomId || !selectedUser) return;

    const chatDocRef = doc(db, "chats", chatRoomId);
    const unsubscribe = onSnapshot(chatDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const typingState = data.typing?.[selectedUser.uid] === true;
        
        // Ensure typing indicator is recent (within 4 seconds) to prevent stuck states
        const typingTime = data.typing?.timestamp?.toMillis() || 0;
        const now = Date.now();
        if (typingState && now - typingTime < 4000) {
          setIsRecipientTyping(true);
        } else {
          setIsRecipientTyping(false);
        }
      } else {
        setIsRecipientTyping(false);
      }
    });

    return () => unsubscribe();
  }, [chatRoomId, selectedUser?.uid]);

  // Mark all unread messages sent TO current user in this chat as read
  const markMessagesAsRead = async () => {
    if (!chatRoomId || !currentUserProfile || !selectedUser) return;

    try {
      const messagesRef = collection(db, "messages");
      const unreadQuery = query(
        messagesRef,
        where("chatId", "==", chatRoomId),
        where("to", "==", currentUserProfile.uid),
        where("read", "==", false)
      );

      const querySnapshot = await getDocs(unreadQuery);
      if (querySnapshot.empty) return;

      const batch = writeBatch(db);
      querySnapshot.forEach((msgDoc) => {
        batch.update(doc(db, "messages", msgDoc.id), { read: true });
      });

      // Clear the unread count in metadata too
      const chatDocRef = doc(db, "chats", chatRoomId);
      batch.update(chatDocRef, {
        [`unreadCount.${currentUserProfile.uid}`]: 0
      });

      await batch.commit();
    } catch (err) {
      console.warn("Could not mark messages as read:", err);
    }
  };

  // 4. Typing indicator sender logic
  const handleTyping = async () => {
    if (!chatRoomId || !currentUserProfile) return;

    // Throttle triggers: update doc with typing state
    const chatDocRef = doc(db, "chats", chatRoomId);
    try {
      await setDoc(chatDocRef, {
        typing: {
          [currentUserProfile.uid]: true,
          timestamp: serverTimestamp()
        }
      }, { merge: true });
    } catch (err) {
      console.warn("Typing start indicator error:", err);
    }

    // Clear previous timeout and start a 2-second clear timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(chatDocRef, {
          typing: {
            [currentUserProfile.uid]: false,
            timestamp: serverTimestamp()
          }
        }, { merge: true });
      } catch (err) {
        console.warn("Typing stop indicator error:", err);
      }
    }, 2000);
  };

  // 5. Send message trigger (text + files)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachment) return;
    if (!currentUserProfile || !selectedUser || !chatRoomId) return;

    const currentText = inputText.trim();
    setInputText(""); // Reset input box immediately for Optimistic UI

    // If typing timeout was active, clear it
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      const chatDocRef = doc(db, "chats", chatRoomId);
      try {
        await setDoc(chatDocRef, {
          typing: {
            [currentUserProfile.uid]: false,
          }
        }, { merge: true });
      } catch (err) {}
    }

    setUploadError(null);

    try {
      let fileURL: string | null = null;
      let fileType: FileType | null = null;
      let fileName: string | null = null;

      // Check if file attachment exists
      if (attachment) {
        fileName = attachment.name;
        // Map native file type
        if (attachment.type.startsWith("image/")) {
          fileType = "image";
        } else if (attachment.type.startsWith("audio/") || attachment.name.endsWith(".mp3") || attachment.name.endsWith(".m4a")) {
          fileType = "audio";
        } else if (attachment.type.startsWith("video/")) {
          fileType = "video";
        } else if (attachment.type === "application/pdf" || attachment.name.endsWith(".pdf")) {
          fileType = "pdf";
        } else {
          fileType = "other";
        }

        const timestampStr = Date.now();
        const storagePath = `chat_files/${chatRoomId}/${timestampStr}_${attachment.name}`;
        const fileRef = ref(storage, storagePath);

        setUploadProgress(10); // Start visually

        // Compress images client-side before sending
        let uploadBlob: Blob = attachment;
        if (fileType === "image") {
          try {
            uploadBlob = await compressImage(attachment, 1200, 0.7);
          } catch (compressError) {
            console.error("Compression failed, using original file", compressError);
          }
        }

        const isStorageUnusable = false;
        if (isStorageUnusable) {
          console.warn("Storage is known to be unusable. Bypassing upload, entering direct lightweight Base64 mode.");
          if (fileType === "image") {
            try {
              const tinyBlob = await compressImage(attachment, 600, 0.5);
              if (tinyBlob.size <= 400 * 1024) {
                fileURL = await blobToBase64(tinyBlob);
              } else {
                throw new Error("Local fallback image size is too large to send via database.");
              }
            } catch (fallbackErr: any) {
              setUploadError(`Base64 fallback failed: ${fallbackErr.message}`);
              setUploadProgress(null);
              throw fallbackErr;
            }
          } else {
            if (uploadBlob.size <= 300 * 1024) {
              fileURL = await blobToBase64(uploadBlob);
            } else {
              setUploadError(`File exceeds transfer limit for direct secure base64 mode (maximum 300KB).`);
              setUploadProgress(null);
              throw new Error("File too large for base64 fallback");
            }
          }
          setUploadProgress(null);
          setAttachment(null);
        } else {
          // Upload to Storage with state listeners
          try {
            const uploadTask = uploadBytesResumable(fileRef, uploadBlob);

            await new Promise<void>((resolve, reject) => {
              // Set up a watchdog that cancels the upload if there is no transfer progress for 3 seconds on startup
              let watchdog: any = setTimeout(() => {
                console.warn("Storage upload progress stuck at 0% for too long. Triggering auto-fallback.");
                try {
                  uploadTask.cancel();
                } catch (cancelErr) {
                  console.error("Error cancelling task:", cancelErr);
                }
                reject(new Error("Storage upload timed out (stuck at 0%)"));
              }, 30000);

              uploadTask.on(
                "state_changed",
                (snapshot) => {
                  const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                  setUploadProgress(progress);
                  if (snapshot.bytesTransferred > 0 && watchdog) {
                    clearTimeout(watchdog);
                    watchdog = null;
                  }
                },
                (error) => {
                  if (watchdog) clearTimeout(watchdog);
                  reject(error);
                },
                async () => {
                  if (watchdog) clearTimeout(watchdog);
                  fileURL = await getDownloadURL(uploadTask.snapshot.ref);
                  resolve();
                }
              );
            });
            setUploadProgress(null);
            setAttachment(null);
          } catch (storageErr) {
            console.warn("Firebase Storage upload failed:", storageErr);
            
            if (fileType === "image") {
              try {
                // Compress even further to fit within Firestore's document limitations safely
                const tinyBlob = await compressImage(attachment, 600, 0.5);
                if (tinyBlob.size <= 400 * 1024) {
                  fileURL = await blobToBase64(tinyBlob);
                } else {
                  throw new Error("Local fallback image size is too large to send via database.");
                }
              } catch (fallbackErr: any) {
                setUploadError(`Storage upload failed: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}. Base64 fallback also failed: ${fallbackErr.message}`);
                setUploadProgress(null);
                throw storageErr;
              }
            } else {
              // Check if non-image file is small enough to fallback to base64 safely
              if (uploadBlob.size <= 300 * 1024) {
                fileURL = await blobToBase64(uploadBlob);
              } else {
                setUploadError(`Storage upload failed: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}. File exceeds base64 local fallback size limit.`);
                setUploadProgress(null);
                throw storageErr;
              }
            }
            setUploadProgress(null);
            setAttachment(null);
          }
        }
      }

      // Add document to "messages"
      const messagesDocPath = "messages";
      const messagePayload: any = {
        chatId: chatRoomId,
        from: currentUserProfile.uid,
        to: selectedUser.uid,
        text: currentText || null,
        fileURL,
        fileType,
        fileName,
        timestamp: serverTimestamp(),
        read: false,
        isViewOnce: isViewOnce && !!fileURL,
        isViewOnceOpened: false
      };
      
      if (replyingToMessage) {
        messagePayload.replyToMessage = {
          id: replyingToMessage.id,
          text: replyingToMessage.text,
          fileName: replyingToMessage.fileName || null,
          sender: replyingToMessage.from === currentUserProfile.uid ? currentUserProfile.displayName || "You" : selectedUser.displayName || "User"
        };
      }

      // Reset View Once and Rely toggle after dispatching
      setIsViewOnce(false);
      setReplyingToMessage(null);

      let newMessageRef;
      try {
        newMessageRef = await addDoc(collection(db, "messages"), messagePayload);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, messagesDocPath);
        return;
      }

      // Sync/Update chat room metadata
      const chatDocRef = doc(db, "chats", chatRoomId);
      const roomsDocPath = `chats/${chatRoomId}`;
      try {
        await setDoc(chatDocRef, {
          participants: [currentUserProfile.uid, selectedUser.uid],
          lastMessage: currentText || `📷 Sent attachment: ${fileName}`,
          lastMessageTimestamp: serverTimestamp(),
          [`unreadCount.${selectedUser.uid}`]: increment(1)
        }, { merge: true });
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, roomsDocPath);
      }

      // Automated AI Assistant trigger if recipient is Meta AI
      if (selectedUser.uid === "meta_ai") {
        triggerMetaAIResponse(currentText, chatRoomId);
      }

    } catch (err: any) {
      console.error("Send Message failed: ", err);
      setUploadError(err.message || "Could not deliver message.");
    }
  };

  // 6. Delete message after sending (unlimited soft deletes)
  const handleDeleteMessage = async (msg: Message) => {
    // Only author can delete for everyone
    if (msg.from !== currentUserProfile?.uid) {
      if (confirm("This message was sent by another user and cannot be deleted for everyone. Delete for you instead?")) {
        const updated = [...locallyDeletedMsgIds, msg.id];
        const uniqueUpdated = Array.from(new Set(updated));
        setLocallyDeletedMsgIds(uniqueUpdated);
        localStorage.setItem(`deleted_for_me_${chatRoomId}`, JSON.stringify(uniqueUpdated));
      }
      return;
    }

    if (!confirm("Are you sure you want to delete this message for everyone?")) return;

    try {
      await updateDoc(doc(db, "messages", msg.id), {
        text: "This message was deleted",
        fileURL: null,
        fileType: null,
        fileName: null,
        isDeleted: true // custom metadata
      });
    } catch (err) {
      console.error("Message deletion failed:", err);
    }
  };

  // 7. Save Edited Message (unlimited timeline)
  const handleSaveEditMessage = async (msgId: string, oldTimestamp: any) => {
    if (!editingText.trim()) return;

    try {
      await updateDoc(doc(db, "messages", msgId), {
        text: editingText,
        isEdited: true
      });
      setEditingMessageId(null);
      setEditingText("");
    } catch (err) {
      console.error("Editing message failed: ", err);
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    if (!currentUserProfile) return;
    try {
      const msgRef = doc(db, "messages", msgId);
      // We will perform a simple merge for the `reactions` map.
      await setDoc(msgRef, {
        reactions: {
          [currentUserProfile.uid]: emoji
        }
      }, { merge: true });
      setActiveReactionBarMessageId(null);
    } catch (err) {
      console.error("Reacting to message failed: ", err);
    }
  };

  // 8. Toggle Message Star State for easy bookmarking
  const handleToggleStar = async (msgId: string, currentStarred: boolean) => {
    try {
      await updateDoc(doc(db, "messages", msgId), {
        isStarred: !currentStarred
      });
    } catch (err) {
      console.error("Star state toggle failed:", err);
    }
  };

  // 9. Transcribe Received Voice Note
  const handleTranscribeMessage = (msgId: string, fileName: string) => {
    setTranscriptLoadingId(msgId);
    
    // Simulate smart transcribing with a high fidelity delay
    setTimeout(() => {
      let resultText = "Hello! Sure, let me review the custom requirements for this project and verify the final layout compilation. Speak to you shortly!";
      
      const lower = fileName.toLowerCase();
      if (lower.includes("meeting") || lower.includes("work")) {
        resultText = "We need to optimize sandbox memory usage, refine key visual contrast metrics, and deploy to external production slots by Thursday.";
      } else if (lower.includes("family") || lower.includes("home")) {
        resultText = "Sounds good! I will grab the credentials and head over right after the call is wrapped. Don't forget to lock the garage door!";
      }

      setVoiceTranscripts(prev => ({
        ...prev,
        [msgId]: resultText
      }));
      setTranscriptLoadingId(null);
    }, 1200);
  };

  // 10. Meta AI Automatic Intelligence Responder
  const triggerMetaAIResponse = async (userPrompt: string, roomId: string) => {
    if (!currentUserProfile) return;

    const chatDocRef = doc(db, "chats", roomId);
    
    try {
      // Simulate typing indicator
      await setDoc(chatDocRef, {
        typing: {
          meta_ai: true,
          timestamp: serverTimestamp()
        }
      }, { merge: true });

      // Simulate network wait
      setTimeout(async () => {
        let aiText = `Hello! I am your Meta AI assistant. 📡 Use commands to try advanced helpers:
- **@translate <text>** - Translate any sentence to Spanish, French, or Japanese fluently.
- **@write <topic>** - Instantly draft a beautiful marketing layout outline or essay.
- **@avatar** - View instructions to customize your profile sticker pack.

What can I build or answer for you today?`;

        const lowerPrompt = userPrompt.toLowerCase();
        if (lowerPrompt.startsWith("@translate")) {
          const phrase = userPrompt.slice(10).trim() || "Thank you for utilizing MS Chat";
          aiText = `✨ **Meta AI Translator Pro** ✨
📝 *Original Text:* "${phrase}"

🇪🇸 *Spanish translation:* "${phrase === "Thank you for utilizing MS Chat" ? "Gracias por utilizar MS Chat" : "Traducción completada con éxito. Listo para producción."}"
🇫🇷 *French translation:* "Merci d'utiliser MS Chat"
🇯🇵 *Japanese translation:* "MS Chatをご利用いただきありがとうございます"`;
        } else if (lowerPrompt.startsWith("@write")) {
          const topic = userPrompt.slice(6).trim() || "Modern Messaging Tech Stack";
          aiText = `✏️ **Meta AI Copywriter Draft** ✏️
📝 *Topic Proposal:* ${topic}

### Core Structural Proposition
1. **Dynamic Sandboxing**: Isolate layout metrics utilizing lightweight local persistence values.
2. **Biometric Security Gates**: Limit unauthorized access paths via multi-layered lock pins.
3. **Decentralized Backups**: Sync historical transcripts with state-authoritative caches.

*Draft generated successfully under AI sandboxing metrics.*`;
        } else if (lowerPrompt.includes("avatar") || lowerPrompt.startsWith("@avatar")) {
          aiText = `🎨 **Meta AI Sticker & Avatar Studio** 🎨
Your custom Avatar configuration is fully unlocked! 

**Here's how to create yours now:**
1. Click the Smiley icon next to the chat text input field to open your Avatar Sticker Pack.
2. Mix and match gorgeous facial layouts, custom skins, eyewear, and background cosmetics.
3. Save your avatar and tap "Generate Stickers" to instantly receive and use custom sticker tags in the active conversation chat!`;
        } else if (lowerPrompt.includes("hello") || lowerPrompt.includes("hi")) {
          aiText = `Hello! I'm Meta AI. How can I assist you in your workspace today? Send any question, essay prompt, or use are specialized translator tags!`;
        }

        const messagePayload = {
          chatId: roomId,
          from: "meta_ai",
          to: currentUserProfile.uid,
          text: aiText,
          fileURL: null,
          fileType: null,
          fileName: null,
          timestamp: serverTimestamp(),
          read: false,
          isViewOnce: false,
          isViewOnceOpened: false
        };

        // Write Meta AI response to Firestore
        await addDoc(collection(db, "messages"), messagePayload);

        // Terminate typing indicator
        await setDoc(chatDocRef, {
          typing: {
            meta_ai: false
          }
        }, { merge: true });

      }, 1500);

    } catch (err) {
      console.warn("Meta AI simulation error:", err);
    }
  };

  // 11. Custom Simulated Video Note Sender
  const handleSendSimulatedVideoNote = async () => {
    if (!currentUserProfile || !selectedUser || !chatRoomId) return;
    
    setIsVideoRecording(true);
    setVideoRecordingTimer(0);
    
    // Increment timer for visual effect
    const interval = setInterval(() => {
      setVideoRecordingTimer(prev => {
        if (prev >= 4) {
          clearInterval(interval);
          return 4;
        }
        return prev + 1;
      });
    }, 1000);

    setTimeout(async () => {
      clearInterval(interval);
      setIsVideoRecording(false);
      setIsVideoNoteMode(false);

      // Send simulated circular video message
      const videoURL = "https://assets.mixkit.co/videos/preview/mixkit-womans-feet-splashing-in-puddle-43343-large.mp4"; // Beautiful, lightweight high contrast creative commons video
      const messagePayload = {
        chatId: chatRoomId,
        from: currentUserProfile.uid,
        to: selectedUser.uid,
        text: null,
        fileURL: videoURL,
        fileType: "video",
        fileName: "Circular_Video_Note.mp4",
        timestamp: serverTimestamp(),
        read: false,
        isViewOnce: false,
        isViewOnceOpened: false
      };

      try {
        await addDoc(collection(db, "messages"), messagePayload);
        
        // Sync/Update chat room metadata
        const chatDocRef = doc(db, "chats", chatRoomId);
        await setDoc(chatDocRef, {
          participants: [currentUserProfile.uid, selectedUser.uid],
          lastMessage: "📹 Circular Video Note",
          lastMessageTimestamp: serverTimestamp()
        }, { merge: true });

      } catch (err) {
        console.error("Failed to deliver video note:", err);
      }
    }, 4500);
  };

  const handleFileShareSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("Shared attachment sizes must not exceed 10MB limit.");
        return;
      }
      setAttachment(file);
      setUploadError(null);
    }
  };

  const handleClearChat = async () => {
      if (!chatRoomId || !confirm("Are you sure you want to clear this chat?")) return;
      try {
          const q = query(collection(db, "messages"), where("chatId", "==", chatRoomId));
          const msgs = await getDocs(q);
          const batch = writeBatch(db);
          msgs.forEach(m => batch.delete(m.ref));
          await batch.commit();
          alert("Chat cleared.");
      } catch(e) { console.error(e); }
  };
  const handleExportChat = () => {
      const chatData = JSON.stringify(messages, null, 2);
      const blob = new Blob([chatData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat_export_${chatRoomId}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  return (
    <div id="chat_area_canvas" className="flex-1 flex flex-col h-full bg-[#efeae2] relative justify-between overflow-hidden">
      
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0 z-20">
          <div 
            className="flex items-center gap-3 min-w-0 cursor-pointer"
            onClick={() => selectedUser && onOpenUserDetails(selectedUser.uid)}
          >
            {/* Back button visible only on mobile screens */}
            <button 
              onClick={onBack}
              className="md:hidden p-1 rounded-full text-slate-600 hover:bg-slate-200 cursor-pointer"
              id="chat_back_btn"
              title="Back to Chats list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="relative shrink-0">
              {selectedUser?.photoURL ? (
                <img 
                  src={selectedUser.photoURL} 
                  alt={selectedUser.displayName} 
                  className="w-10 h-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold border border-slate-200 shadow-sm">
                  {selectedUser?.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              {selectedUser?.online && (
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-800 truncate" id="chat_header_name">
                {selectedUser?.displayName}
              </h2>
              
              {/* Typing dynamics or online subline */}
              {isRecipientTyping ? (
                <span className="text-xs text-emerald-600 font-semibold animate-pulse block">
                  typing...
                </span>
              ) : selectedUser?.online ? (
                <span className="text-[10px] text-emerald-600 block font-medium">
                  online
                </span>
              ) : selectedUser?.lastSeen ? (
                <span className="text-[10px] text-slate-400 block font-medium">
                  last seen {formatTime(selectedUser.lastSeen)}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 block">
                  offline
                </span>
              )}
            </div>
          </div>

          {/* Custom controller toolbox */}
          <div className="flex items-center gap-2">
            {disappearingHours > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 animate-pulse">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>{disappearingHours}h disappearing active</span>
              </span>
            )}

            {/* Disappearing Timer Button with interactive timing select picker */}
            <div className="relative group/time">
              <button
                className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-all cursor-pointer"
                title="Configure Disappearing Messages settings"
              >
                <Clock className="w-4.5 h-4.5" />
              </button>
              
              {/* Dropdown list revealed on hover */}
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-150 rounded-xl p-1.5 shadow-lg w-40 z-30 hidden group-hover/time:block animate-fade-in">
                <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider px-2 py-1 border-b border-slate-100 mb-1">
                  Disappearing Mode
                </p>
                <button
                  onClick={() => handleToggleDisappearing(0)}
                  className={`w-full text-left text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-slate-100 ${disappearingHours === 0 ? "text-emerald-600" : "text-slate-700"}`}
                >
                  Off (Default)
                </button>
                <button
                  onClick={() => handleToggleDisappearing(24)}
                  className={`w-full text-left text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-slate-100 ${disappearingHours === 24 ? "text-emerald-600" : "text-slate-700"}`}
                >
                  24 Hours
                </button>
                <button
                  onClick={() => handleToggleDisappearing(168)}
                  className={`w-full text-left text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-slate-100 ${disappearingHours === 168 ? "text-emerald-600" : "text-slate-700"}`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => handleToggleDisappearing(2160)}
                  className={`w-full text-left text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-slate-100 ${disappearingHours === 2160 ? "text-emerald-600" : "text-slate-700"}`}
                >
                  90 Days
                </button>
              </div>
            </div>

            {/* Call Action Triggers */}
            <button
              onClick={() => setActiveCallType("audio")}
              className={`p-1.5 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${activeCallType === "audio" ? "bg-emerald-100 text-emerald-700 font-bold" : ""}`}
              title="Start Live Audio Call"
            >
              <PhoneCall className="w-4.5 h-4.5" />
              <span className="text-[10px] font-bold hidden sm:inline">Audio</span>
            </button>
            <button
              onClick={() => setActiveCallType("video")}
              className={`p-1.5 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${activeCallType === "video" ? "bg-emerald-100 text-emerald-700 font-bold" : ""}`}
              title="Start Live Video Call"
            >
              <Video className="w-4.5 h-4.5" />
              <span className="text-[10px] font-bold hidden sm:inline">Video</span>
            </button>
            <div className="relative">
              <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)} 
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg"
              >
                  <MoreVertical className="w-4.5 h-4.5" />
              </button>
              {isMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl p-2 w-40 z-50 text-slate-700 font-semibold text-xs py-2">
                    <button onClick={() => { setIsMenuOpen(false); alert('Reported user'); }} className="block w-full text-left px-2 py-2 hover:bg-slate-100 flex items-center gap-2"><Flag className="w-4 h-4"/>Report</button>
                    <button onClick={() => { setIsMenuOpen(false); alert('Blocked user'); }} className="block w-full text-left px-2 py-2 hover:bg-slate-100 flex items-center gap-2"><Ban className="w-4 h-4"/>Block</button>
                    <button onClick={() => { setIsMenuOpen(false); handleClearChat(); }} className="block w-full text-left px-2 py-2 hover:bg-slate-100 flex items-center gap-2"><Trash2 className="w-4 h-4"/>Clear chat</button>
                    <button onClick={() => { setIsMenuOpen(false); handleExportChat(); }} className="block w-full text-left px-2 py-2 hover:bg-slate-100 flex items-center gap-2"><Download className="w-4 h-4"/>Export chat</button>
                    <button onClick={() => { setIsMenuOpen(false); alert('Shortcut added'); }} className="block w-full text-left px-2 py-2 hover:bg-slate-100 flex items-center gap-2"><Plus className="w-4 h-4"/>Add shortcut</button>
                    <button onClick={() => { setIsMenuOpen(false); alert('Added to list'); }} className="block w-full text-left px-2 py-2 hover:bg-slate-100 flex items-center gap-2"><List className="w-4 h-4"/>Add to list</button>
                  </div>
              )}
            </div>
          </div>
        </div>

      {/* Incoming Call Ringing Modal UI */}
      {incomingCall && !activeCallType && (
        <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between shadow-xl border-b border-slate-700 animate-slide-down shrink-0 relative z-20">
          <div className="flex items-center gap-3 mb-3 sm:mb-0">
             <div className="bg-emerald-500/20 p-2 rounded-full animate-bounce">
                <PhoneCall className="w-5 h-5 text-emerald-400" />
             </div>
             <div>
               <p className="font-bold text-sm">Incoming Call...</p>
               <p className="text-xs text-slate-400">from {selectedUser.displayName}</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => acceptIncomingCall("video")}
              className="bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-md"
            >
              <MonitorUp className="w-4 h-4" /> Accept Video
            </button>
            <button
              onClick={() => acceptIncomingCall("audio")}
              className="bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-md"
            >
              <PhoneCall className="w-4 h-4" /> Accept Audio
            </button>
            <button
              onClick={rejectIncomingCall}
              className="bg-rose-600 hover:bg-rose-500 px-4 py-1.5 rounded-lg text-sm font-semibold transition shadow-md"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Floating full-fidelity Drop-In Call Deck at top if active */}
      {activeCallType && (
        <InternalCallLayer
          peerInstance={peerRef.current}
          incomingCallConnection={incomingCall}
          callType={activeCallType}
          selectedUser={selectedUser}
          currentUserProfile={currentUserProfile}
          onEndCall={() => {
             setActiveCallType(null);
             setIncomingCall(null);
          }}
        />
      )}
      
      {/* Removing the local modal usage, handled by App.tsx now */}

      {/* Primary Message Scroller Area with customized backdrops */}
      <div 
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4 chat-bg space-y-3.5"
        id="messages_scroller"
      >
        {loading ? (
          <div className="flex flex-col justify-center items-center h-full">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
            <p className="text-xs text-slate-500">Retrieving chats securely...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-white/85 backdrop-blur-xs p-5 rounded-2xl shadow-sm text-center max-w-sm mt-12 border border-slate-100">
              <Smile className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Encrypted 1-to-1 Chat</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Send text, upload PDFs, share details or audio recordings. All data synchronized cleanly via Firebase Firestore.
              </p>
            </div>
          </div>
        ) : (
          messages
            .filter((msg) => !locallyDeletedMsgIds.includes(msg.id))
            .map((msg) => {
              const isOutgoing = msg.from === currentUserProfile?.uid;
              
              // Check if deletable (outgoing and not deleted already)
              const canDelete = isOutgoing && !msg.isDeleted && !(msg.text?.includes("🚫"));
              
              // Check if editable (outgoing and not deleted and not a physical file)
              const canEdit = isOutgoing && !msg.isDeleted && !msg.fileURL;

              const isStarred = msg.isStarred === true;
              const isOpenedViewOnce = msg.isViewOnceOpened === true || !!viewOnceOpened[msg.id];

              return (
                <div 
                  key={msg.id} 
                  className={`flex w-full items-center gap-3 ${isOutgoing ? "justify-end" : "justify-start"} fade-in`}
                >
                  <div 
                    onClick={() => handleBubbleClick(msg)}
                    className={`max-w-[80%] md:max-w-[70%] rounded-xl px-3.5 py-2.5 shadow-xs border relative group select-none transition-all cursor-pointer ${
                      isOutgoing 
                        ? "chat-bubble-out border-emerald-100/30 rounded-tr-none text-slate-900" 
                        : "chat-bubble-in border-slate-100 rounded-tl-none text-slate-900"
                    } ${
                      longPressActiveId === msg.id ? "scale-97 opacity-85 duration-100 ring-2 ring-emerald-400" : ""
                    }`}
                    onMouseDown={(e) => handleHoldStart(e, msg)}
                    onMouseUp={handleHoldEnd}
                    onMouseLeave={handleHoldEnd}
                    onTouchStart={(e) => handleHoldStart(e, msg)}
                    onTouchEnd={handleHoldEnd}
                    onTouchMove={handleHoldMove}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveActionMenuMessage(msg);
                    }}
                    title="Hold to multi-select / Right click options"
                  >
                    {/* Visual holding overlay progress/pulse dynamic */}
                    {longPressActiveId === msg.id && (
                      <div className="absolute inset-0 rounded-xl bg-emerald-500/10 pointer-events-none transition-all z-20 flex items-center justify-center animate-pulse" />
                    )}
                  {/* Floating Action Menu on Hover */}
                  <div className="absolute -top-3.5 right-2 bg-white border border-slate-150 rounded-lg p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 z-15">
                      {/* React toggle */}
                      <button
                        onClick={() => setActiveReactionBarMessageId(activeReactionBarMessageId === msg.id ? null : msg.id)}
                        className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-55 flex items-center cursor-pointer"
                        title="React"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      {/* Reply button */}
                      <button
                        onClick={() => setReplyingToMessage(msg)}
                        className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-55 flex items-center cursor-pointer"
                        title="Reply"
                      >
                        <CornerDownRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Star toggle */}
                      <button
                        onClick={() => handleToggleStar(msg.id, isStarred)}
                        className={`p-1 rounded hover:bg-slate-55 flex items-center cursor-pointer ${isStarred ? "text-amber-500" : "text-slate-400"}`}
                        title={isStarred ? "Unstar Message" : "Star Message"}
                      >
                        <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-400" : ""}`} />
                      </button>

                      {/* Pencil edit tool */}
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditingText(msg.text || "");
                          }}
                          className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-55 flex items-center cursor-pointer"
                          title="Edit Message (within 15 mins)"
                        >
                          <PencilLine className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete for everyone */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteMessage(msg)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center cursor-pointer"
                          title="Delete for everyone (within 5 mins)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  {/* Reaction Quick Bar */}
                  {activeReactionBarMessageId === msg.id && (
                    <div className="absolute -top-10 right-0 bg-white border border-slate-200 rounded-full shadow-lg p-1.5 flex items-center gap-1 z-20 animate-slide-down">
                      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReactToMessage(msg.id, emoji)}
                          className={`hover:scale-125 transition-transform text-lg cursor-pointer ${msg.reactions?.[currentUserProfile?.uid || ""] === emoji ? "bg-emerald-100 rounded-full" : ""}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quoted Reply Content */}
                  {msg.replyToMessage && (
                    <div className="bg-slate-900/5 rounded p-2 mb-1.5 border-l-4 border-emerald-500 text-xs">
                      <span className="font-bold text-emerald-700 block mb-0.5">{msg.replyToMessage.sender}</span>
                      <span className="text-slate-600 line-clamp-2">{msg.replyToMessage.text || msg.replyToMessage.fileName || "Media"}</span>
                    </div>
                  )}

                  {/* Message body text / Inline Edit Form */}
                  {editingMessageId === msg.id ? (
                    <div className="flex flex-col gap-1.5 min-w-[220px]">
                      <span className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-wider block">
                        Edit Sent Message
                      </span>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                        rows={2}
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-650"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEditMessage(msg.id, msg.timestamp)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-[10px] font-bold text-white shadow-xs"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : msg.isDeleted ? (
                    <div className="flex items-center gap-1.5 opacity-60 italic text-slate-500 py-0.5 pr-6">
                      <Ban className="w-4 h-4" /> <span className="text-sm">This message was deleted</span>
                    </div>
                  ) : msg.text ? (
                    <p 
                      className="text-sm break-words whitespace-pre-wrap leading-relaxed pr-6" 
                      dangerouslySetInnerHTML={{ __html: formatWhatsAppTextToHTML(msg.text) }}
                    />
                  ) : null}

                  {/* Attachment layouts */}
                  {msg.fileURL && (
                    <div className="my-1 rounded-sm">
                      
                      {msg.isViewOnce ? (
                        // View once secure module
                        isOpenedViewOnce ? (
                          <div className="bg-slate-100/80 border border-slate-200/50 rounded-xl p-3 flex items-center gap-2.5 min-w-[185px] leading-relaxed select-none">
                            <EyeOff className="w-4.5 h-4.5 text-slate-400" />
                            <div>
                              <p className="text-xs font-bold text-slate-500">Opened View Once</p>
                              <span className="text-[9px] text-slate-450 block font-medium">This attachment is closed.</span>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={async () => {
                              // Trigger state lock instantly and update DB
                              setViewOnceOpened(prev => ({ ...prev, [msg.id]: true }));
                              try {
                                await updateDoc(doc(db, "messages", msg.id), { isViewOnceOpened: true });
                              } catch {}
                              onOpenImageModal(msg.fileURL || "");
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 rounded-xl p-3 flex items-center justify-between gap-3 min-w-[200px] cursor-pointer"
                            title="Tap once to view"
                          >
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-600 text-white rounded-full w-5 h-5 text-xs font-black flex items-center justify-center">①</span>
                              <div>
                                <p className="text-xs font-bold text-emerald-800">Photo Attachment</p>
                                <span className="text-[9px] font-semibold text-emerald-600 block mt-0.5">Click to view once</span>
                              </div>
                            </div>
                            <Eye className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
                          </div>
                        )
                      ) : msg.fileType === "image" ? (
                        <div className="relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 group max-w-xs mt-1 shadow-sm">
                          <img 
                            src={msg.fileURL} 
                            alt={msg.fileName || "Shared image"} 
                            onClick={() => onOpenImageModal(msg.fileURL || "")}
                            className="max-h-48 rounded-xl object-cover transition-transform duration-200 group-hover:scale-102"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                            Enlarge Asset
                          </div>
                          <a 
                            href={msg.fileURL || ""} 
                            download 
                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white cursor-pointer transition-all"
                            title="Download Image"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ) : msg.fileType === "video" ? (
                        // Generic Video player bubble
                        <div className="my-1 flex items-center justify-center">
                          <video 
                            src={msg.fileURL || ""} 
                            controls
                            className="max-w-full h-auto rounded-lg" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : msg.fileType === "video" && msg.fileName?.includes("Circular_Video_Note") ? (
                        // WhatsApp circular Video note bubble selflooping
                        <div className="my-1 flex items-center justify-center">
                          <div className="w-28 h-28 rounded-full border-3 border-emerald-500 overflow-hidden shadow-md cursor-pointer relative bg-slate-950">
                            <video 
                              src={msg.fileURL} 
                              autoPlay 
                              loop 
                              muted 
                              playsInline 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-1 left-1 bg-emerald-500 text-white p-0.5 rounded-full">
                              <Film className="w-3 h-3" />
                            </div>
                            <a 
                              href={msg.fileURL || ""} 
                              download 
                              className="absolute bottom-1 right-1 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full cursor-pointer transition-all"
                              title="Download Video"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ) : msg.fileType === "audio" ? (
                        // Custom styled Audio player with inline transcription triggers
                        <div className="flex flex-col gap-2 min-w-[220px] bg-slate-105 p-2.5 rounded-xl border border-slate-205 mt-1">
                          <div className="flex items-center justify-between gap-1 text-emerald-800">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <Volume2 className="w-4 h-4 shrink-0 text-emerald-600" />
                              <span className="text-xs font-bold truncate max-w-[120px]">
                                {msg.fileName}
                              </span>
                            </div>
                            
                            {/* Transcribe trigger */}
                            <button
                              onClick={() => handleTranscribeMessage(msg.id, msg.fileName || "")}
                              disabled={transcriptLoadingId === msg.id}
                              className="text-[10px] bg-white border border-slate-200 hover:border-emerald-250 text-emerald-800 hover:bg-emerald-50 px-1.5 py-0.5 rounded text-right shrink-0 cursor-pointer disabled:opacity-50 font-bold"
                            >
                              {transcriptLoadingId === msg.id ? "Analyzing..." : voiceTranscripts[msg.id] ? "Transcribed" : "Transcribe 🗣️"}
                            </button>
                          </div>
                          
                          <audio 
                            src={msg.fileURL} 
                            controls 
                            className="w-full h-8 rounded" 
                          />

                          {/* Voice Transcript Panel */}
                          {voiceTranscripts[msg.id] && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-[11px] text-slate-700 italic leading-relaxed mt-1.5 font-sans relative">
                              <span className="text-[8px] uppercase font-mono font-bold tracking-wider text-emerald-700 bg-white border border-emerald-100 rounded px-1 absolute -top-2 left-2 shadow-xs">
                                transcript
                              </span>
                              "{voiceTranscripts[msg.id]}"
                            </div>
                          )}
                        </div>
                      ) : (
                        // Default general Document loader
                        <div className="flex items-center justify-between gap-4 p-2 bg-slate-50 border border-slate-100 rounded-lg min-w-[220px] mt-1 shadow-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-8 h-8 text-indigo-505 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate max-w-[145px]">
                                {msg.fileName}
                              </p>
                              <span className="text-[10px] text-slate-500 uppercase">
                                {msg.fileType === "pdf" ? ".pdf Doc" : "Document"}
                              </span>
                            </div>
                          </div>
                          <a 
                            href={msg.fileURL} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-150 hover:bg-emerald-200 rounded-full text-emerald-800 transition-colors cursor-pointer"
                            title="Download/Open"
                          >
                            <ExternalLink className="w-4.5 h-4.5" />
                          </a>
                        </div>
                      )}

                    </div>
                  )}

                  {/* Timestamp and Meta Status */}
                  <div className="flex justify-end items-center gap-1.5 mt-1 text-[9px] text-slate-450 select-none">
                    {msg.isEdited && <span className="text-[8px] italic font-semibold text-emerald-600">(edited)</span>}
                    {isStarred && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                    <span>{formatTime(msg.timestamp)}</span>
                    
                    {isOutgoing && (
                      <span>
                        {msg.read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Combined Reactions Display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="absolute -bottom-3 right-2 flex items-center bg-white border border-slate-200 rounded-full px-1.5 py-0.5 shadow-sm z-10 text-[10px]">
                      {Array.from(new Set(Object.values(msg.reactions))).map((emoji, idx) => (
                        <span key={idx} className="mr-0.5">{emoji}</span>
                      ))}
                      <span className="text-slate-500 ml-0.5">{Object.keys(msg.reactions).length > 1 ? Object.keys(msg.reactions).length : ""}</span>
                    </div>
                  )}

                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Main typing/attachments Control Box */}
      <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col gap-1 shrink-0 z-10">
        {/* Errors displays */}
        {uploadError && (
          <div className="px-3 py-1 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-100 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Progress monitor */}
        {uploadProgress !== null && (
          <div className="flex items-center gap-3 bg-slate-100 text-slate-700 p-2 rounded-lg text-xs">
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between font-semibold mb-1 text-[10px]">
                <span>Uploading {attachment?.name}...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Active attachment pill with View Once controller */}
        {attachment && uploadProgress === null && (
          <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500 p-2.5 rounded-lg text-xs max-w-sm shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <CornerDownRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-semibold text-[11px]">{attachment.name}</span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 ml-4">
              {/* View once selector */}
              {attachment.type.startsWith("image/") && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white hover:bg-emerald-100/50 border border-emerald-250/50 text-emerald-800 rounded-lg px-2 py-1 text-[10px] font-extrabold transition-all">
                  <input 
                    type="checkbox" 
                    checked={isViewOnce} 
                    onChange={(e) => setIsViewOnce(e.target.checked)} 
                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 w-3 h-3 cursor-pointer" 
                  />
                  <span>View Once ①</span>
                </label>
              )}

              <button 
                onClick={() => {
                  setAttachment(null);
                  setIsViewOnce(false);
                }}
                className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2 py-1 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Custom Avatar Sticker Pack Tray Selector overlay if active */}
        {isStickerPackOpen && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg flex flex-col gap-2 animate-slide-up mb-2 z-25">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                My Avatar Sticker Pack 🎨
              </p>
              <button 
                onClick={() => setIsStickerPackOpen(false)}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                close
              </button>
            </div>
            
            {/* Horizontal scroll of cute custom built Avatar presets */}
            <div className="flex gap-3 overflow-x-auto py-1 scrollbar-thin">
              {[
                { label: "Smiley Custom Avatar", emoji: "😎", message: "✨ Customized Avatar: Feeling great today! ✨" },
                { label: "Cool Custom Avatar", emoji: "🤠", message: "🚀 Customized Avatar: Headed in the right direction! 🚀" },
                { label: "Brainy Custom Avatar", emoji: "🤓", message: "🧠 Customized Avatar: Let me double-check the logic on port 3000..." },
                { label: "Active Custom Avatar", emoji: "🥳", message: "⭐ Customized Avatar: Outstanding compilation successful! ⭐" },
                { label: "Busy Custom Avatar", emoji: "⚡", message: "⚡ Customized Avatar: Accelerating build performance!" },
                { label: "Quiet Custom Avatar", emoji: "👽", message: "🛸 Customized Avatar: In deep focus..." }
              ].map((style, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={async () => {
                    const roomRef = doc(db, "chats", chatRoomId || "sandbox");
                    const stickerText = `${style.emoji} ${style.message}`;
                    const payload = {
                      chatId: chatRoomId,
                      from: currentUserProfile?.uid,
                      to: selectedUser?.uid,
                      text: stickerText,
                      fileURL: null,
                      fileType: null,
                      fileName: null,
                      timestamp: serverTimestamp(),
                      read: false,
                      isViewOnce: false,
                      isViewOnceOpened: false,
                      isAvatarSticker: true // custom type identifier
                    };
                    try {
                      await addDoc(collection(db, "messages"), payload);
                      await setDoc(roomRef, {
                        lastMessage: `🎨 Avatar Sticker: ${style.emoji}`,
                        lastMessageTimestamp: serverTimestamp()
                      }, { merge: true });
                    } catch (e) {
                      console.error("Sticker dispatch error", e);
                    }
                    setIsStickerPackOpen(false);
                  }}
                  className="p-2 border border-slate-150 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 transition-all flex flex-col items-center justify-center gap-1 shrink-0 text-center cursor-pointer min-w-[72px]"
                  title={style.label}
                >
                  <span className="text-2xl">{style.emoji}</span>
                  <span className="text-[8px] font-extrabold whitespace-nowrap text-slate-500 uppercase">{style.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 italic">
              Tap any customized element sticker design to send instantly to the chat stream.
            </p>
          </div>
        )}

        {/* Reply active panel */}
        {replyingToMessage && (
          <div className="bg-slate-100 border-l-4 border-emerald-500 rounded-t-xl rounded-b-md p-2.5 mb-2 flex justify-between items-center relative animate-slide-down">
            <div className="flex flex-col flex-1 min-w-0 pr-4">
              <span className="text-xs font-bold text-emerald-600 line-clamp-1">
                {replyingToMessage.from === currentUserProfile?.uid ? "You" : selectedUser?.displayName || "User"}
              </span>
              <span className="text-[11px] text-slate-500 line-clamp-1 italic mt-0.5">
                {replyingToMessage.text || replyingToMessage.fileName || "Media"}
              </span>
            </div>
            <button
              onClick={() => setReplyingToMessage(null)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Camera simulation recording state overlay */}
        {isVideoRecording && (
          <div className="bg-rose-900 text-white rounded-xl p-3 flex items-center justify-between mb-2 shadow-inner animate-pulse">
            <div className="flex items-center gap-2.5 text-xs font-bold font-mono">
              <span className="h-3 w-3 bg-red-500 rounded-full animate-ping" />
              <span>📹 DIRECT CIRCULAR VIDEO NOTE RECORDING: 0:0{videoRecordingTimer} / 0:04</span>
            </div>
            <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-[#fda4af] hidden sm:inline">
              Live Feed active
            </span>
          </div>
        )}

        {/* Action input toolbar */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
          
          {/* File Selectors clip button option */}
          <div className="relative group shrink-0">
            <label 
              htmlFor="chat-file-attachment" 
              className="p-1.5 xs:p-2 sm:p-2.5 bg-slate-200 hover:bg-slate-100 rounded-lg sm:rounded-xl text-slate-500 hover:text-emerald-600 flex items-center justify-center cursor-pointer transition-colors shadow-sm"
              title="Attach File (Max 10MB JPG/PNG/PDF/MP3/MP4)"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
            </label>
            <input 
              id="chat-file-attachment"
              type="file"
              accept="image/*,application/pdf,audio/*,video/*"
              onChange={handleFileShareSelect}
              className="hidden"
            />
          </div>

          {/* Sticker Tray selector toggler */}
          <button
            type="button"
            onClick={() => setIsStickerPackOpen(!isStickerPackOpen)}
            className={`p-1.5 xs:p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer pointer-events-auto ${isStickerPackOpen ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500 hover:text-emerald-600"}`}
            title="Open Avatar Sticker selector pack"
          >
            <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Video note mode simulated sender */}
          <button
            type="button"
            onClick={handleSendSimulatedVideoNote}
            disabled={isVideoRecording}
            className="p-1.5 xs:p-2 sm:p-2.5 bg-slate-200 hover:bg-slate-100 text-slate-550 hover:text-rose-600 rounded-lg sm:rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer pointer-events-auto disabled:opacity-50"
            title="Send short circular Video Note"
          >
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <input
            type="text"
            ref={inputRef}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-inner font-sans"
          />

          <button
            type="submit"
            disabled={!inputText.trim() && !attachment}
            className="p-1.5 xs:p-2 sm:p-2.5 bg-emerald-600 hover:bg-emerald-750 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white shadow-md hover:shadow-lg rounded-lg sm:rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer"
            title="Send"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </form>
      </div>

      {activeActionMenuMessage && (
        <div 
          onClick={() => setActiveActionMenuMessage(null)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-150"
          id="hold_message_backdrop"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden scale-100 transition-all duration-150"
            id="hold_message_menu"
          >
            {/* Header Info */}
            <div className="bg-slate-50 border-b border-slate-100 p-4">
              <p className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                Message Options
              </p>
              <p className="text-xs text-slate-600 mt-1 truncate font-medium">
                {activeActionMenuMessage.text || (activeActionMenuMessage.fileName ? `📎 ${activeActionMenuMessage.fileName}` : "Attachment")}
              </p>
            </div>

            {/* Options List */}
            <div className="p-2 divide-y divide-slate-100/50">
              
              {/* Copy text action */}
              {activeActionMenuMessage.text && (
                <button
                  onClick={() => handleCopyText(activeActionMenuMessage.text || "", activeActionMenuMessage.id)}
                  className="w-full flex items-center justify-between text-left px-4 py-3 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors font-medium rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copy Text</span>
                  </div>
                  {copiedMessageId === activeActionMenuMessage.id && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md font-bold">
                      Copied!
                    </span>
                  )}
                </button>
              )}

              {/* Star action */}
              <button
                onClick={() => {
                  const isCurrentlyStarred = activeActionMenuMessage.isStarred === true;
                  handleToggleStar(activeActionMenuMessage.id, isCurrentlyStarred);
                  setActiveActionMenuMessage(null);
                }}
                className="w-full flex items-center text-left px-4 py-3 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors font-medium rounded-xl cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Star className={`w-4 h-4 ${activeActionMenuMessage.isStarred ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>{activeActionMenuMessage.isStarred ? "Unstar Message" : "Star Message"}</span>
                </div>
              </button>


              {/* Edit action */}
              {activeActionMenuMessage.from === currentUserProfile?.uid && !activeActionMenuMessage.isDeleted && !activeActionMenuMessage.fileURL && (
                <button
                  onClick={() => {
                    setEditingMessageId(activeActionMenuMessage.id);
                    setEditingText(activeActionMenuMessage.text || "");
                    setActiveActionMenuMessage(null);
                  }}
                  className="w-full flex items-center text-left px-4 py-3 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors font-medium rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <PencilLine className="w-4 h-4 text-slate-400" />
                    <span>Edit Message</span>
                  </div>
                </button>
              )}

              {/* Delete actions section */}
              <div className="pt-2">
                
                {/* Delete for everyone (only author) */}
                {activeActionMenuMessage.from === currentUserProfile?.uid && !activeActionMenuMessage.isDeleted && (
                  <button
                    onClick={() => {
                      handleDeleteMessage(activeActionMenuMessage);
                      setActiveActionMenuMessage(null);
                    }}
                    className="w-full flex items-center text-left px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors font-semibold rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                      <span>Delete for Everyone</span>
                    </div>
                  </button>
                )}

                {/* Delete for Me (always available) */}
                <button
                  onClick={() => handleDeleteForMe(activeActionMenuMessage.id)}
                  className="w-full flex items-center text-left px-4 py-3 text-sm text-slate-650 hover:bg-rose-50 hover:text-rose-700 transition-colors font-medium rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 className="w-4 h-4 text-slate-400" />
                    <span>Delete for Me</span>
                  </div>
                </button>
              </div>

            </div>

            <div className="bg-slate-50 p-2.5 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveActionMenuMessage(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
