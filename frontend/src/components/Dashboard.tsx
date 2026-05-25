import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { ChatWindow } from './ChatWindow';
import { UserProfile } from './UserProfile';
import { 
  LogOut, 
  Settings, 
  Search, 
  Users, 
  MessageSquare
} from 'lucide-react';

interface Chat {
  partner_id: number;
  nickname: string;
  avatar_url: string;
  presence_status: string;
  last_seen: string | null;
  last_message_content: string | null;
  last_message_sender_id: number | null;
  last_message_status: 'sent' | 'delivered' | 'read' | null;
  last_message_time: string | null;
  unread_count: number;
}

export const Dashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { subscribe } = useWebSocket();

  const [activePartner, setActivePartner] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [directory, setDirectory] = useState<User[]>([]);
  const [showDirectory, setShowDirectory] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Map of partnerId -> typing boolean
  const [typingStates, setTypingStates] = useState<{ [id: number]: boolean }>({});

  // 1. Fetch active chats list
  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setChats(data);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  // Fetch directory list of users
  const fetchDirectory = async () => {
    try {
      const res = await fetch('/api/users/directory', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setDirectory(data);
      }
    } catch (err) {
      console.error('Error fetching directory:', err);
    }
  };

  // Fetch search results
  const searchUsers = async (query: string) => {
    try {
      const res = await fetch(`/api/users/search?q=${query}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchDirectory();
  }, [token]);

  // Handle search input changes
  useEffect(() => {
    if (searchQuery.trim().length >= 1) {
      searchUsers(searchQuery.trim());
      setShowDirectory(false);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  function updateChatListSnippet(msg: any, isIncoming: boolean) {
    const partnerId = isIncoming ? msg.sender_id : msg.receiver_id;
    const isCurrentlyChatting = activePartner?.id === partnerId;

    setChats((prev) => {
      // Check if chat already exists in list
      const existingChatIndex = prev.findIndex((c) => c.partner_id === partnerId);

      let chatObj: Chat;

      if (existingChatIndex > -1) {
        const oldChat = prev[existingChatIndex];
        chatObj = {
          ...oldChat,
          last_message_content: msg.content,
          last_message_sender_id: msg.sender_id,
          last_message_status: msg.status,
          last_message_time: msg.created_at,
          unread_count: isIncoming && !isCurrentlyChatting ? oldChat.unread_count + 1 : 0,
        };
      } else {
        // Find partner details in directory
        const partnerDetails = directory.find((u) => u.id === partnerId) || searchResults.find((u) => u.id === partnerId);
        chatObj = {
          partner_id: partnerId,
          nickname: partnerDetails?.nickname || 'User',
          avatar_url: partnerDetails?.avatar_url || '',
          presence_status: partnerDetails?.presence_status || 'offline',
          last_seen: partnerDetails?.last_seen || null,
          last_message_content: msg.content,
          last_message_sender_id: msg.sender_id,
          last_message_status: msg.status,
          last_message_time: msg.created_at,
          unread_count: isIncoming && !isCurrentlyChatting ? 1 : 0,
        };
      }

      // Filter out old instance and prepend the updated one
      const remainingChats = prev.filter((c) => c.partner_id !== partnerId);
      return [chatObj, ...remainingChats];
    });
  }

  function updateChatSnippetOnly(msg: any) {
    const partnerId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
    setChats((prev) =>
      prev.map((c) =>
        c.partner_id === partnerId
          ? {
              ...c,
              last_message_content: msg.content,
            }
          : c
      )
    );
  }

  // 2. Subscribe to WebSocket updates
  useEffect(() => {
    // Typing indicator
    const unsubscribeTyping = subscribe('typing', (payload) => {
      const { senderId, isTyping } = payload;
      setTypingStates((prev) => ({ ...prev, [senderId]: isTyping }));
    });

    // Presence update
    const unsubscribePresence = subscribe('presence', (payload) => {
      const { userId, status, lastSeen } = payload;
      // Update chats list presence
      setChats((prev) =>
        prev.map((c) =>
          c.partner_id === userId ? { ...c, presence_status: status, last_seen: lastSeen || c.last_seen } : c
        )
      );

      // Update directory presence
      setDirectory((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, presence_status: status, last_seen: lastSeen || u.last_seen } : u
        )
      );

      // Update search results presence
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, presence_status: status, last_seen: lastSeen || u.last_seen } : u
        )
      );

      // Update active partner presence if open
      if (activePartner && activePartner.id === userId) {
        setActivePartner((prev) => prev ? { ...prev, presence_status: status, last_seen: lastSeen || prev.last_seen } : null);
      }
    });

    // New messages to update chat list snippet, badge, and order
    const unsubscribeNewMsg = subscribe('new_message', (payload) => {
      const msg = payload.message;
      updateChatListSnippet(msg, true);
    });

    // Sent message confirmation to update chat list snippet
    const unsubscribeSentConfirm = subscribe('message_sent_confirm', (payload) => {
      const msg = payload.message;
      updateChatListSnippet(msg, false);
    });

    // Message edit snippet update
    const unsubscribeEdit = subscribe('message_edited', (payload) => {
      const msg = payload.message;
      updateChatSnippetOnly(msg);
    });

    const unsubscribeEditConfirm = subscribe('message_edited_confirm', (payload) => {
      const msg = payload.message;
      updateChatSnippetOnly(msg);
    });

    // Message delete snippet update
    const unsubscribeDelete = subscribe('message_deleted', () => {
      // Re-fetch chats to ensure we have the correct last message and unread count
      fetchChats();
    });

    const unsubscribeDeleteConfirm = subscribe('message_deleted_confirm', () => {
      fetchChats();
    });

    // Messages read update
    const unsubscribeRead = subscribe('messages_read', (payload) => {
      const { receiverId } = payload; // receiverId is the partner who read our messages
      setChats((prev) =>
        prev.map((c) =>
          c.partner_id === receiverId ? { ...c, last_message_status: 'read' } : c
        )
      );
    });

    return () => {
      unsubscribeTyping();
      unsubscribePresence();
      unsubscribeNewMsg();
      unsubscribeSentConfirm();
      unsubscribeEdit();
      unsubscribeEditConfirm();
      unsubscribeDelete();
      unsubscribeDeleteConfirm();
      unsubscribeRead();
    };
  }, [activePartner?.id]);

  const handleSelectPartner = (partner: User) => {
    setActivePartner(partner);
    setSearchQuery('');
    setSearchResults([]);
    setShowDirectory(false);

    // Clear unread badge in state
    setChats((prev) =>
      prev.map((c) => (c.partner_id === partner.id ? { ...c, unread_count: 0 } : c))
    );
  };

  const formatLastMessageTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    
    // Check if it is today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if it is yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-screen w-full bg-[#05060b] text-slate-100 overflow-hidden relative">
      {/* Sidebar - list of chats & search */}
      <div
        className={`w-full md:w-80 lg:w-[380px] flex flex-col bg-[#0b0e17] border-r border-white/5 transition-all ${
          activePartner ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* User bar */}
        <div className="px-6 py-5 bg-[#0b0e17] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={user?.nickname}
              className="w-11 h-11 rounded-2xl object-cover bg-slate-800 border border-white/10 shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
              }}
            />
            <div>
              <h4 className="font-extrabold text-sm text-white tracking-wide leading-tight">{user?.nickname}</h4>
              <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                Active 👋
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              title="Edit Profile"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              className="p-2.5 text-slate-400 hover:text-rose-455 hover:bg-rose-500/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="p-4 bg-[#0b0e17] border-b border-white/2">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users... 🔎"
              className="w-full glass-input rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none text-xs font-medium"
            />
          </div>
        </div>

        {/* Directory Toggle Button */}
        <div className="px-4 py-2.5 border-b border-white/2 flex gap-2">
          <button
            onClick={() => {
              setShowDirectory(!showDirectory);
              setSearchQuery('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${
              showDirectory 
                ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-650/5' 
                : 'bg-white/2 border-white/5 text-slate-450 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{showDirectory ? 'Show Active Chats' : 'Show User Directory'}</span>
          </button>
        </div>

        {/* Chats list / Directory / Search results */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {searchQuery.trim().length > 0 ? (
            // SEARCH RESULTS
            <div className="space-y-1">
              <h5 className="px-3.5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Search Results ({searchResults.length})
              </h5>
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-medium">
                  No users found matching "{searchQuery}" 😢
                </div>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectPartner(u)}
                    className="w-full flex items-center gap-3.5 p-3 hover:bg-white/5 rounded-2xl text-left border border-transparent transition-all active:scale-[0.99]"
                  >
                    <div className="relative">
                      <img
                        src={u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={u.nickname}
                        className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-white/10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                        }}
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#0b0e17] ${
                          u.presence_status === 'online' ? 'bg-emerald-500 presence-glow-online' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white tracking-wide">{u.nickname}</h4>
                      {u.bio && <p className="text-xs text-slate-400 truncate mt-0.5">{u.bio}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : showDirectory ? (
            // USER DIRECTORY
            <div className="space-y-1">
              <h5 className="px-3.5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                User Directory ({directory.length})
              </h5>
              {directory.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-medium">
                  No other users registered yet.
                </div>
              ) : (
                directory.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectPartner(u)}
                    className="w-full flex items-center gap-3.5 p-3 hover:bg-white/5 rounded-2xl text-left border border-transparent transition-all active:scale-[0.99]"
                  >
                    <div className="relative">
                      <img
                        src={u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={u.nickname}
                        className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-white/10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                        }}
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#0b0e17] ${
                          u.presence_status === 'online' ? 'bg-emerald-500 presence-glow-online' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-sm text-white truncate tracking-wide">{u.nickname}</h4>
                      {u.bio ? (
                        <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">{u.bio}</p>
                      ) : (
                        <p className="text-xs text-slate-600 italic mt-0.5 font-medium">No biography</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            // ACTIVE CHATS LIST
            <div className="space-y-1">
              <h5 className="px-3.5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Recent Chats ({chats.length})
              </h5>
              {chats.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center p-6 text-center">
                  <div className="p-3 bg-white/2 rounded-full border border-white/5 text-slate-500 mb-3">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-slate-405 font-bold">No active chats 💬</p>
                  <button
                    onClick={() => setShowDirectory(true)}
                    className="text-xs text-indigo-400 hover:underline mt-2 font-bold flex items-center gap-1.5"
                  >
                    Browse Directory ✨
                  </button>
                </div>
              ) : (
                chats.map((c) => {
                  const isTyping = typingStates[c.partner_id];
                  const activeClass = activePartner?.id === c.partner_id 
                    ? 'bg-gradient-to-r from-indigo-650/20 to-purple-650/15 border-indigo-500/25 text-white shadow-xl shadow-indigo-600/5' 
                    : 'glass-card text-slate-300';
                  
                  return (
                    <button
                      key={c.partner_id}
                      onClick={() =>
                        handleSelectPartner({
                          id: c.partner_id,
                          nickname: c.nickname,
                          avatar_url: c.avatar_url,
                          presence_status: c.presence_status,
                          last_seen: c.last_seen || undefined,
                        })
                      }
                      className={`w-full flex items-center gap-3.5 p-3 rounded-2xl text-left border transition-all active:scale-[0.99] ${activeClass}`}
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={c.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={c.nickname}
                          className="w-11 h-11 rounded-xl object-cover bg-slate-850 border border-white/5"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                          }}
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#0b0e17] ${
                            c.presence_status === 'online' ? 'bg-emerald-500 presence-glow-online' : 'bg-slate-500'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-sm text-white truncate leading-tight tracking-wide">{c.nickname}</h4>
                          <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                            {formatLastMessageTime(c.last_message_time)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1.5">
                          {isTyping ? (
                            <span className="text-xs text-indigo-400 font-extrabold animate-pulse flex items-center gap-1">
                              typing... <span className="text-[10px]">✍️</span>
                            </span>
                          ) : (
                            <p className="text-xs text-slate-400 truncate flex-1 pr-2 font-medium">
                              {c.last_message_sender_id === user?.id && (
                                <span className="text-slate-550 mr-1 font-bold">You:</span>
                              )}
                              {c.last_message_content}
                            </p>
                          )}

                          {c.unread_count > 0 && (
                            <span className="bg-gradient-to-r from-indigo-500 to-purple-650 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center justify-center min-w-4.5 h-4.5 shadow-lg shadow-indigo-600/20">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main chat window */}
      <div className="flex-1 flex flex-col bg-[#05060b] relative">
        {activePartner ? (
          <ChatWindow
            partner={activePartner}
            typingStatus={typingStates[activePartner.id] || false}
            onBack={() => setActivePartner(null)}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-8 bg-[#05060b]/20 relative overflow-hidden">
            {/* Background Blur Spheres */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
            
            <div className="p-6 bg-gradient-to-tr from-indigo-500/10 to-purple-550/5 text-indigo-400 rounded-[32px] mb-5 border border-indigo-500/15 shadow-2xl animate-float relative z-10">
              <span className="text-5xl select-none">🔮</span>
            </div>
            <h3 className="text-2xl font-extrabold font-display bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent tracking-tight relative z-10">
              Start Your Conversation
            </h3>
            <p className="text-xs text-slate-500 max-w-[280px] mt-2.5 leading-relaxed font-semibold relative z-10">
              Choose an active dialog from the sidebar, search for contacts, or browse the directory to message friends.
            </p>
          </div>
        )}
      </div>

      {/* Profile Settings Modal */}
      {isProfileOpen && <UserProfile onClose={() => setIsProfileOpen(false)} />}
    </div>
  );
};
