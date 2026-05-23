import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Loader2 } from "lucide-react";
import { UserProfile } from "../types";
import Peer, { MediaConnection } from "peerjs";

interface InternalCallLayerProps {
  peerInstance: Peer | null;
  incomingCallConnection?: MediaConnection | null;
  callType: "audio" | "video";
  selectedUser: UserProfile;
  currentUserProfile: UserProfile;
  onEndCall: () => void;
}

export function InternalCallLayer({ peerInstance, incomingCallConnection, callType, selectedUser, currentUserProfile, onEndCall }: InternalCallLayerProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callRef = useRef<MediaConnection | null>(null);

  useEffect(() => {
    let active = true;
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video"
        });
        
        if (!active) {
           stream.getTracks().forEach(track => track.stop());
           return;
        }

        setLocalStream(stream);
        if (localVideoRef.current && callType === "video") {
           localVideoRef.current.srcObject = stream;
        }

        // Handle P2P connection logic
        if (incomingCallConnection) {
            // We are receiving a call
            incomingCallConnection.answer(stream);
            callRef.current = incomingCallConnection;
            
            incomingCallConnection.on('stream', (rStream) => {
               setRemoteStream(rStream);
               if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
            });
        } else if (peerInstance) {
            // We are initiating a call
            const call = peerInstance.call(selectedUser.uid, stream, {
                metadata: { type: callType }
            });
            callRef.current = call;
            
            call.on('stream', (rStream) => {
               setRemoteStream(rStream);
               if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
            });
        }

      } catch (err: any) {
        console.warn("Could not get media stream", err);
        setMediaError(err.message || "Permission denied or no device found.");
      }
    };
    
    initMedia();

    return () => {
      active = false;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (callRef.current) {
        callRef.current.close();
      }
    };
  }, [callType]); // we disable extensive deps re-renders to maintain stream

  // Handle stream stop properly when unmounting
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (callRef.current) {
        callRef.current.close();
      }
    };
  }, [localStream]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!localStream.getAudioTracks()[0]?.enabled);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === "video") {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!localStream.getVideoTracks()[0]?.enabled);
    }
  };

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (callRef.current) {
       callRef.current.close();
    }
    onEndCall();
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-slate-900 border-b border-slate-700 h-[60vh] md:h-96 flex flex-col items-center justify-center relative z-15 shadow-md overflow-hidden animate-slide-down shrink-0">
      
      {/* Background aesthetics */}
      <div className="absolute inset-0 opacity-20 pointer-events-none flex justify-center items-center overflow-hidden">
        <div className="w-64 h-64 bg-emerald-500 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 z-10 w-full p-4">
        {mediaError && (
          <div className="absolute top-4 left-4 right-4 bg-rose-500/20 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-lg text-sm text-center mb-4 max-w-lg mx-auto z-50 backdrop-blur-sm">
            <span className="font-semibold">Camera/Microphone Error</span>: {mediaError}
          </div>
        )}
        
        {callType === "video" ? (
          <div className="w-full max-w-lg aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-slate-700 flex">
            {/* Remote Video (Full Screen) */}
            {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
                  <User className="w-16 h-16 text-slate-600 mb-2" />
                  <span className="text-slate-400 text-sm animate-pulse">Calling {selectedUser.displayName}...</span>
                </div>
            )}
            
            {/* Local Video (PiP) */}
            <div className="absolute bottom-4 right-4 w-24 sm:w-32 aspect-video bg-black rounded-lg overflow-hidden border-2 border-emerald-500 shadow-lg">
                {isVideoOff ? (
                  <div className="flex items-center justify-center h-full bg-slate-800">
                    <VideoOff className="w-6 h-6 text-slate-500" />
                  </div>
                ) : (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted // always mute local loopback
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                )}
            </div>
            
            <div className="absolute bottom-4 left-4 flex justify-between items-end pointer-events-none">
               <div className="bg-black/50 backdrop-blur block px-3 py-1.5 rounded-lg text-white text-xs font-semibold">
                 {selectedUser.displayName} 
               </div>
            </div>
          </div>
        ) : (
           <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-xl border-4 border-slate-700 relative">
                 {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} alt="avatar" className="w-full h-full rounded-full object-cover" />
                 ) : (
                    <User className="w-10 h-10 text-emerald-500" />
                 )}
                 {remoteStream ? (
                     <div className="absolute inset-0 rounded-full border-2 border-emerald-500/50 animate-ping"></div>
                 ) : (
                     <div className="mt-32 absolute flex flex-col items-center">
                        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin mb-1" />
                        <span className="text-slate-400 text-xs">Ringing...</span>
                     </div>
                 )}
              </div>
              <h3 className="text-xl font-bold text-white mb-1 shadow-sm">{selectedUser.displayName}</h3>
              <p className="text-emerald-400 font-mono text-sm tracking-wider">{formatDuration(callDuration)}</p>
              
              {/* Hidden audio element for remote stream */}
              <audio ref={remoteVideoRef as any} autoPlay playsInline className="hidden" />
           </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="bg-slate-800/80 backdrop-blur-md px-6 py-4 w-full flex items-center justify-center gap-6 z-20 border-t border-slate-700">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-all ${isMuted ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {callType === "video" && (
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all ${isVideoOff ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={handleEndCall}
          className="p-4 bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-all shadow-[0_0_15px_rgba(225,29,72,0.5)] transform hover:scale-105"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>

    </div>
  );
}
