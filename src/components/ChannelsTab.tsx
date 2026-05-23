import React, { useState, useEffect } from "react";
import { Channel, ChannelUpdate } from "../types";
import { Search, Radio, CircleAlert, CheckCircle, Heart, BellRing, MessageSquarePlus, Share2 } from "lucide-react";

interface ChannelsTabProps {
  onBackSelection?: () => void;
  onSendSystemNotice?: (notice: string) => void;
}

const DEFAULT_CHANNELS: Channel[] = [
  {
    id: "g_workspace",
    name: "Google Workspace Hub",
    handle: "@google_workspace",
    description: "Your official broadcast channel for Google Calendar, Sheets, Docs, and Gmail updates.",
    logo: "💻",
    followers: 124005,
    followedByUser: false,
    updates: [
      {
        id: "gw_1",
        text: "⚡ New Gemini Integration in Google Sheets! You can now generate tables, organize schedules, and summarize spreadsheet cells instantly with the side panel.",
        timestamp: "Today, 10:30 AM",
        likes: 1290
      },
      {
        id: "gw_2",
        text: "✉️ Google Mail is rolling out dynamic category labeling. Prioritize newsletters, social alerts, and personal notifications with seamless automated workflows.",
        timestamp: "Yesterday, 3:15 PM",
        likes: 934
      }
    ]
  },
  {
    id: "sports_desk",
    name: "Sports Hub 360",
    handle: "@sports_hub360",
    description: "Stay updated with live game scores, transfer alerts, and major championship results worldwide.",
    logo: "⚽",
    followers: 489201,
    followedByUser: false,
    updates: [
      {
        id: "sd_1",
        text: "🏆 CHAMPIONS! The league final ended 3-2 after a thrilling penalty shoot-out in the 94th minute! Match summary and highlights uploaded inside our portal.",
        timestamp: "Today, 8:45 AM",
        likes: 4892
      },
      {
        id: "sd_2",
        text: "🏀 Draft season kicks off this Thursday! Read the full list of top tier profiles slated for selection into metropolitan leagues.",
        timestamp: "2 days ago",
        likes: 2199
      }
    ]
  },
  {
    id: "meta_ai",
    name: "Meta AI updates",
    handle: "@meta_ai_official",
    description: "Creative writing prompts, quick interactive translations, and visual generator releases by Meta.",
    logo: "🤖",
    followers: 320498,
    followedByUser: true,
    updates: [
      {
        id: "ma_1",
        text: "✨ Introducing Custom avatar generation triggers! You can now construct 3D digital stickers directly inside chat systems to express instant styles.",
        timestamp: "Today, 1:20 PM",
        likes: 3109
      },
      {
        id: "ma_2",
        text: "🌐 Language Translation Upgrade: Our translation services now support over 145 global dialects fluently with localized tone intelligence.",
        timestamp: "3 days ago",
        likes: 1845
      }
    ]
  },
  {
    id: "tech_radar",
    name: "Tech Radar Feed",
    handle: "@techpreview",
    description: "Hardware diagnostics, custom microchips, quantum mechanics updates, and developer reviews.",
    logo: "📡",
    followers: 78540,
    followedByUser: false,
    updates: [
      {
        id: "tr_1",
        text: "🔋 breakthrough: Sand-based batteries demonstrating 3x higher energy storage output successfully validated in prototype mobile grids.",
        timestamp: "Yesterday, 9:02 AM",
        likes: 492
      }
    ]
  }
];

export function ChannelsTab({ onBackSelection, onSendSystemNotice }: ChannelsTabProps) {
  const [channels, setChannels] = useState<Channel[]>(() => {
    const saved = localStorage.getItem("ms_followed_channels");
    if (saved) {
      try {
        const followedIds: string[] = JSON.parse(saved);
        return DEFAULT_CHANNELS.map(ch => ({
          ...ch,
          followedByUser: followedIds.includes(ch.id)
        }));
      } catch (e) {
        return DEFAULT_CHANNELS;
      }
    }
    return DEFAULT_CHANNELS;
  });

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const followedIds = channels.filter(ch => ch.followedByUser).map(ch => ch.id);
    localStorage.setItem("ms_followed_channels", JSON.stringify(followedIds));
  }, [channels]);

  const handleToggleFollow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setChannels(prev => prev.map(ch => {
      if (ch.id === id) {
        const nextState = !ch.followedByUser;
        if (onSendSystemNotice) {
          onSendSystemNotice(nextState ? `You are now following ${ch.name} 🔔` : `Unfollowed ${ch.name}`);
        }
        return {
          ...ch,
          followedByUser: nextState,
          followers: nextState ? ch.followers + 1 : ch.followers - 1
        };
      }
      return ch;
    }));

    // If viewing this channel, update state list as well
    if (selectedChannel && selectedChannel.id === id) {
      setSelectedChannel(prev => {
        if (!prev) return null;
        const nextState = !prev.followedByUser;
        return {
          ...prev,
          followedByUser: nextState,
          followers: nextState ? prev.followers + 1 : prev.followers - 1
        };
      });
    }
  };

  const handleLikePost = (channelId: string, updateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChannels(prev => prev.map(ch => {
      if (ch.id === channelId) {
        return {
          ...ch,
          updates: ch.updates.map(up => {
            if (up.id === updateId) {
              return { ...up, likes: up.likes + 1 };
            }
            return up;
          })
        };
      }
      return ch;
    }));

    // Update active viewed channel state
    if (selectedChannel && selectedChannel.id === channelId) {
      setSelectedChannel(prev => {
        if (!prev) return null;
        return {
          ...prev,
          updates: prev.updates.map(up => {
            if (up.id === updateId) {
              return { ...up, likes: up.likes + 1 };
            }
            return up;
          })
        };
      });
    }
  };

  const filteredChannels = channels.filter(ch =>
    ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 relative fade-in">
      {selectedChannel ? (
        // Detailed Feed View for a Particular Channel
        <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] relative overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedChannel(null)}
                className="p-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                ← Channels
              </button>
              
              <span className="text-xl">{selectedChannel.logo}</span>
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="text-sm font-bold text-slate-800">{selectedChannel.name}</h3>
                  <CheckCircle className="w-3.5 h-3.5 fill-blue-500 text-white shrink-0" />
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  {selectedChannel.handle} • {selectedChannel.followers.toLocaleString()} followers
                </p>
              </div>
            </div>

            <button
              onClick={() => handleToggleFollow(selectedChannel.id)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedChannel.followedByUser
                  ? "bg-slate-100 text-slate-600 border border-slate-250 hover:bg-slate-200"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-xs"
              }`}
            >
              {selectedChannel.followedByUser ? "✓ Following" : "+ Follow"}
            </button>
          </div>

          {/* Description container banner */}
          <div className="bg-white px-5 py-4 border-b border-slate-150 shrink-0 text-xs text-slate-600 italic">
            {selectedChannel.description}
          </div>

          {/* Broadcast Posts Scrollable Feed */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto w-full">
            {selectedChannel.updates.map((post) => (
              <div key={post.id} className="bg-white rounded-xl border border-slate-155 p-4 shadow-xs transition-shadow hover:shadow-sm">
                
                {/* Channel Brand Tag Inline */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm bg-slate-100 p-1 rounded-full">{selectedChannel.logo}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-800">{selectedChannel.name}</span>
                    <span className="text-[9px] text-slate-400 block font-medium">{post.timestamp}</span>
                  </div>
                </div>

                {/* Broadcast message text content */}
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                  {post.text}
                </p>

                {/* Custom reactive action triggers */}
                <div className="flex items-center justify-between border-t border-slate-100 mt-4 pt-3 text-[10px] text-slate-500">
                  <button
                    onClick={(e) => handleLikePost(selectedChannel.id, post.id, e)}
                    className="flex items-center gap-1.5 hover:text-rose-600 transition-colors uppercase font-bold cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-100 hover:fill-rose-500 transition-all duration-150" />
                    <span>{post.likes} Likes</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onSendSystemNotice && onSendSystemNotice("Post Shared!")}
                      className="hover:text-emerald-600 flex items-center gap-1 cursor-pointer font-bold uppercase"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase">
                      Official Broadcast
                    </span>
                  </div>
                </div>

              </div>
            ))}

            {selectedChannel.updates.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-150">
                <Radio className="w-8 h-8 text-slate-300 mx-auto animate-pulse mb-2" />
                <p className="text-xs text-slate-400 font-medium">No updates broadcasted recently.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Explore listing panel
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
          
          {/* Header area with active notification */}
          <div className="bg-white p-4 border-b border-slate-200 sticky top-0 shrink-0 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-800">Explore Channels</h3>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <BellRing className="w-3 h-3" /> Anonymous Feeds
              </span>
            </div>

            <p className="text-[11px] text-slate-550 leading-relaxed mb-3">
              Follow official announcements, score updates, or creative translations directly.
              Other participants or channels cannot see your telephone details.
            </p>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search public hubs by name or keywords..."
                className="w-full bg-slate-100 hover:bg-slate-50 border border-slate-100 focus:border-emerald-500/30 focus:bg-white rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
              />
            </div>
          </div>

          {/* Scrollable list of explore hubs */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              curated recommendations for you
            </div>

            {filteredChannels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => setSelectedChannel(channel)}
                className="w-full text-left bg-white border border-slate-155 hover:border-emerald-500/40 rounded-xl p-3.5 flex items-start gap-3.5 shadow-xs transition-all duration-150 hover:shadow-xs hover:scale-[1.005] cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-2xl shrink-0 border border-slate-150 shadow-inner group-hover:scale-105 duration-200 transition-transform">
                  {channel.logo}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className="text-xs font-bold text-slate-850 truncate group-hover:text-emerald-600 transition-colors">
                        {channel.name}
                      </h4>
                      <CheckCircle className="w-3.5 h-3.5 fill-blue-500 text-white shrink-0" />
                    </div>

                    <button
                      onClick={(e) => handleToggleFollow(channel.id, e)}
                      className={`text-[10px] font-bold px-2 py-1 rounded transition-colors shrink-0 cursor-pointer ${
                        channel.followedByUser
                          ? "bg-slate-100 text-slate-650 hover:bg-slate-200"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {channel.followedByUser ? "Following" : "+ Follow"}
                    </button>
                  </div>

                  <span className="text-[9px] text-slate-400 font-bold block mb-1">
                    {channel.handle} • {channel.followers.toLocaleString()} followers
                  </span>

                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                    {channel.description}
                  </p>
                </div>
              </div>
            ))}

            {filteredChannels.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-150 p-6">
                <CircleAlert className="w-8 h-8 text-amber-500 mx-auto mb-2 animate-bounce" />
                <p className="text-xs text-slate-600 font-bold">No verified channels match your query</p>
                <p className="text-[10px] text-slate-405 mt-1">Try searching for workspace, sport, or updates.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
