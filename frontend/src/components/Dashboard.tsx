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

  const updateChatListSnippet = (msg: any, isIncoming: boolean) => {
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
  };

  const updateChatSnippetOnly = (msg: any) => {
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
  };

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
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Sidebar - list of chats & search */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col bg-slate-900 border-r border-slate-800/80 transition-all ${
          activePartner ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* User bar */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={user?.nickname}
              className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-800"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
              }}
            />
            <div>
              <h4 className="font-bold text-sm text-white leading-tight">{user?.nickname}</h4>
              <p className="text-[10px] text-slate-400 font-medium">Logged in</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="Edit Profile"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="p-4 bg-slate-900 border-b border-slate-850/40">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
            />
          </div>
        </div>

        {/* Directory Toggle Button */}
        <div className="px-4 py-2 border-b border-slate-850/30 flex gap-2">
          <button
            onClick={() => {
              setShowDirectory(!showDirectory);
              setSearchQuery('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
              showDirectory 
                ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400' 
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            {showDirectory ? 'Show Active Chats' : 'Show User Directory'}
          </button>
        </div>

        {/* Chats list / Directory / Search results */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim().length > 0 ? (
            // SEARCH RESULTS
            <div className="p-2 space-y-1">
              <h5 className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Search Results ({searchResults.length})
              </h5>
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No users found matching "{searchQuery}"
                </div>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectPartner(u)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-850 rounded-xl text-left transition-all"
                  >
                    <div className="relative">
                      <img
                        src={u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={u.nickname}
                        className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-800"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                        }}
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                          u.presence_status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{u.nickname}</h4>
                      {u.bio && <p className="text-xs text-slate-400 line-clamp-1">{u.bio}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : showDirectory ? (
            // USER DIRECTORY
            <div className="p-2 space-y-1">
              <h5 className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                User Directory ({directory.length})
              </h5>
              {directory.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No other users registered.
                </div>
              ) : (
                directory.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectPartner(u)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-850 rounded-xl text-left transition-all"
                  >
                    <div className="relative">
                      <img
                        src={u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={u.nickname}
                        className="w-10 h-10 rounded-xl object-cover bg-slate-850 border border-slate-850"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                        }}
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                          u.presence_status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">{u.nickname}</h4>
                      {u.bio ? (
                        <p className="text-xs text-slate-400 truncate">{u.bio}</p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No bio</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            // ACTIVE CHATS LIST
            <div className="p-2 space-y-1">
              <h5 className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Recent Chats ({chats.length})
              </h5>
              {chats.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center p-6 text-center">
                  <MessageSquare className="w-5 h-5 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">No active chats</p>
                  <button
                    onClick={() => setShowDirectory(true)}
                    className="text-xs text-indigo-400 hover:underline mt-1 font-semibold"
                  >
                    Open Directory
                  </button>
                </div>
              ) : (
                chats.map((c) => {
                  const isTyping = typingStates[c.partner_id];
                  const activeClass = activePartner?.id === c.partner_id ? 'bg-indigo-600/10 border-indigo-500/20 text-white' : 'hover:bg-slate-850/60 text-slate-300';
                  
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
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border border-transparent transition-all ${activeClass}`}
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={c.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={c.nickname}
                          className="w-11 h-11 rounded-xl object-cover bg-slate-850 border border-slate-850"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                          }}
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                            c.presence_status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-white truncate leading-tight">{c.nickname}</h4>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">
                            {formatLastMessageTime(c.last_message_time)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          {isTyping ? (
                            <span className="text-xs text-indigo-400 font-medium animate-pulse">
                              typing...
                            </span>
                          ) : (
                            <p className="text-xs text-slate-400 truncate flex-1 pr-2">
                              {c.last_message_sender_id === user?.id && (
                                <span className="text-slate-500 mr-1">You:</span>
                              )}
                              {c.last_message_content}
                            </p>
                          )}

                          {c.unread_count > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center min-w-4 h-4 shadow-md shadow-indigo-600/20">
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
      <div className="flex-1 flex flex-col bg-slate-950">
        {activePartner ? (
          <ChatWindow
            partner={activePartner}
            typingStatus={typingStates[activePartner.id] || false}
            onBack={() => setActivePartner(null)}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-8 bg-slate-950/20">
            <div className="p-5 bg-indigo-600/10 text-indigo-400 rounded-3xl mb-4 border border-indigo-500/20 shadow-inner">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white">Select a Chat</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
              Choose an active dialog from the sidebar, search for other users, or open the directory to start a new chat.
            </p>
          </div>
        )}
      </div>

      {/* Profile Settings Modal */}
      {isProfileOpen && <UserProfile onClose={() => setIsProfileOpen(false)} />}
    </div>
  );
};
