import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Avatar } from './Avatar';
import { Send, Edit3, Trash2, Sparkles, Smile, ArrowLeft, Search, X, ChevronDown } from 'lucide-react';

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  reactions?: any;
  created_at: string;
  updated_at: string;
}

interface ChatWindowProps {
  partner: User;
  typingStatus: boolean;
  onBack: () => void;
}

// ----------------------------------------------------
// Programmatic Chime Synthesizer using Web Audio API
// ----------------------------------------------------
const playChimeSound = (type: 'sent' | 'received') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'sent') {
      osc.type = 'sine';
      // Futuristic clean bubble pop: short, high-pitched slide up
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else {
      osc.type = 'sine';
      // Futuristic soft double chime: chime slide down
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch (e) {
    // Fail silently to avoid interrupting UI if browser blocks autoplay
  }
};

// ----------------------------------------------------
// Reaction parsing helper
// ----------------------------------------------------
const parseReactions = (reactions: any) => {
  if (!reactions) return [];
  let parsed: Record<string, string> = {};
  if (typeof reactions === 'string') {
    try {
      parsed = JSON.parse(reactions);
    } catch (e) {
      return [];
    }
  } else {
    parsed = reactions;
  }

  const groups: Record<string, string[]> = {};
  Object.entries(parsed).forEach(([username, emoji]) => {
    if (!groups[emoji]) groups[emoji] = [];
    groups[emoji].push(username);
  });

  return Object.entries(groups).map(([emoji, users]) => ({
    emoji,
    count: users.length,
    users,
  }));
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ partner, typingStatus, onBack }) => {
  const { user, token } = useAuth();
  const { sendJson, subscribe } = useWebSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editInputText, setEditInputText] = useState('');
  const [deleteConfirmMsgId, setDeleteConfirmMsgId] = useState<number | null>(null);

  // Search in chat
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Scroll bottom and unread track
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadScrolledCount, setUnreadScrolledCount] = useState(0);

  // Emojis keyboard popup drawer
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [isTypingState, setIsTypingState] = useState(false);

  const LIMIT = 50;

  function scrollToBottom() {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    setUnreadScrolledCount(0);
  }

  // 1. Fetch initial message history
  const fetchMessages = async (initial = false) => {
    const currentOffset = initial ? 0 : offset;
    if (!initial && (!hasMore || loadingMore)) return;

    setLoadingMore(true);
    try {
      const res = await fetch(`/api/chats/${partner.id}/messages?limit=${LIMIT}&offset=${currentOffset}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (res.ok) {
        if (data.length < LIMIT) {
          setHasMore(false);
        }

        if (initial) {
          setMessages(data);
          setOffset(data.length);
          setTimeout(scrollToBottom, 50);
        } else {
          const container = containerRef.current;
          const previousScrollHeight = container?.scrollHeight || 0;

          setMessages((prev) => [...data, ...prev]);
          setOffset((prev) => prev + data.length);

          setTimeout(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - previousScrollHeight;
            }
          }, 0);
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Trigger initial fetch when partner changes
  useEffect(() => {
    setMessages([]);
    setOffset(0);
    setHasMore(true);
    setLoadingMore(false);
    setUnreadScrolledCount(0);
    setShowScrollBottom(false);
    setShowEmojiPicker(false);
    setShowSearchInput(false);
    setChatSearchQuery('');
    fetchMessages(true);

    sendJson({ type: 'read_messages', senderId: partner.id });
  }, [partner.id]);

  // 2. Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribeNew = subscribe('new_message', (payload) => {
      const msg: Message = payload.message;
      if (msg.sender_id === partner.id) {
        setMessages((prev) => [...prev, msg]);
        setOffset((o) => o + 1);

        const container = containerRef.current;
        const isScrolledUp = container && (container.scrollHeight - container.clientHeight - container.scrollTop) > 200;

        if (isScrolledUp) {
          setUnreadScrolledCount((prev) => prev + 1);
          playChimeSound('received');
        } else {
          setTimeout(scrollToBottom, 50);
          playChimeSound('received');
          sendJson({ type: 'read_messages', senderId: partner.id });
        }
      }
    });

    const unsubscribeSentConfirm = subscribe('message_sent_confirm', (payload) => {
      const msg: Message = payload.message;
      if (msg.receiver_id === partner.id) {
        setMessages((prev) => [...prev, msg]);
        setOffset((o) => o + 1);
        setTimeout(scrollToBottom, 50);
        playChimeSound('sent');
      }
    });

    const unsubscribeEdit = subscribe('message_edited', (payload) => {
      const edited: Message = payload.message;
      if (edited.sender_id === partner.id) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === edited.id ? edited : msg))
        );
      }
    });

    const unsubscribeEditConfirm = subscribe('message_edited_confirm', (payload) => {
      const edited: Message = payload.message;
      if (edited.receiver_id === partner.id) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === edited.id ? edited : msg))
        );
        setEditingMessage(null);
      }
    });

    const unsubscribeDelete = subscribe('message_deleted', (payload) => {
      const { messageId } = payload;
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setOffset((o) => Math.max(0, o - 1));
    });

    const unsubscribeDeleteConfirm = subscribe('message_deleted_confirm', (payload) => {
      const { messageId } = payload;
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setOffset((o) => Math.max(0, o - 1));
      setDeleteConfirmMsgId(null);
    });

    const unsubscribeRead = subscribe('messages_read', (payload) => {
      const { receiverId } = payload;
      if (receiverId === partner.id) {
        setMessages((prev) =>
          prev.map((msg) => (msg.sender_id === user?.id ? { ...msg, status: 'read' } : msg))
        );
      }
    });

    const unsubscribeReact = subscribe('message_reacted', (payload) => {
      const { messageId, reactions } = payload;
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, reactions } : msg))
      );
    });

    return () => {
      unsubscribeNew();
      unsubscribeSentConfirm();
      unsubscribeEdit();
      unsubscribeEditConfirm();
      unsubscribeDelete();
      unsubscribeDeleteConfirm();
      unsubscribeRead();
      unsubscribeReact();
    };
  }, [partner.id, user?.id]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    if (container.scrollTop <= 10 && !loadingMore && hasMore) {
      fetchMessages(false);
    }

    const scrolledUp = container.scrollHeight - container.clientHeight - container.scrollTop;
    if (scrolledUp > 200) {
      setShowScrollBottom(true);
    } else {
      setShowScrollBottom(false);
      setUnreadScrolledCount(0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!isTypingState) {
      setIsTypingState(true);
      sendJson({ type: 'typing', receiverId: partner.id, isTyping: true });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTypingState(false);
      sendJson({ type: 'typing', receiverId: partner.id, isTyping: false });
    }, 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendJson({
      type: 'send_message',
      receiverId: partner.id,
      content: inputText.trim(),
    });

    setInputText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTypingState(false);
    sendJson({ type: 'typing', receiverId: partner.id, isTyping: false });
  };

  const handleReactMessage = (messageId: number, emoji: string) => {
    sendJson({
      type: 'react_message',
      messageId,
      emoji,
    });
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg);
    setEditInputText(msg.content);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage || !editInputText.trim()) return;

    sendJson({
      type: 'edit_message',
      messageId: editingMessage.id,
      content: editInputText.trim(),
    });
  };

  const handleDeleteMessage = (messageId: number, mode: 'me' | 'both') => {
    sendJson({
      type: 'delete_message',
      messageId,
      mode,
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filter messages based on chat search query
  const filteredMessages = chatSearchQuery.trim()
    ? messages.filter((msg) => msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()))
    : messages;

  return (
    <div className="flex flex-col h-full bg-[#05060b]/40 relative">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 bg-[#0d111c]/80 border-b border-white/5 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl mr-1 transition-all active:scale-95 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          {!showSearchInput ? (
            <>
              <div className="relative flex-shrink-0">
                <Avatar url={partner.avatar_url} name={partner.nickname} size="md" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d111c] ${
                    partner.presence_status === 'online' ? 'bg-emerald-500 presence-glow-online' : 'bg-slate-500'
                  }`}
                />
              </div>

              <div className="min-w-0">
                <h3 className="font-extrabold text-white text-sm leading-tight tracking-wide truncate">{partner.nickname}</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                  {partner.presence_status === 'online' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      online <span className="animate-ping w-1 h-1 bg-emerald-450 rounded-full" />
                    </span>
                  ) : (
                    <span className="opacity-80">
                      offline
                      {partner.last_seen && ` • last seen ${new Date(partner.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  )}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full animate-fade-in pr-2">
              <Search className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none py-1 border-b border-indigo-500/30 focus:border-indigo-500/80"
                autoFocus
              />
              {chatSearchQuery && (
                <button 
                  onClick={() => setChatSearchQuery('')}
                  className="text-slate-450 hover:text-white p-1 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {partner.bio && !showSearchInput && (
            <div className="hidden lg:block max-w-[200px] xl:max-w-[280px] text-right mr-2">
              <p className="text-[10px] text-slate-400 font-semibold line-clamp-1 italic text-indigo-200/80">
                💬 "{partner.bio}"
              </p>
            </div>
          )}
          
          <button
            onClick={() => {
              if (showSearchInput) {
                setChatSearchQuery('');
              }
              setShowSearchInput(!showSearchInput);
            }}
            className={`p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 ${
              showSearchInput 
                ? 'bg-indigo-650/20 border-indigo-500/35 text-indigo-300' 
                : 'bg-white/2 border-white/5 text-slate-400 hover:text-white'
            }`}
            title="Search messages"
          >
            {showSearchInput ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-6 space-y-4 bg-gradient-to-b from-transparent via-[#060810]/20 to-[#060810]/50 relative"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-[10px] font-bold text-indigo-400 animate-pulse tracking-wide">
              Loading history... 🔍
            </span>
          </div>
        )}

        {filteredMessages.length === 0 && !loadingMore && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="p-5 bg-indigo-500/10 text-indigo-400 rounded-3xl mb-4 border border-indigo-500/15 animate-float">
              <Sparkles className="w-7 h-7" />
            </div>
            <p className="text-sm font-extrabold text-slate-200 tracking-wide">
              {chatSearchQuery ? 'No matching messages 🔍' : 'Start the conversation 👋'}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-[240px]">
              {chatSearchQuery ? 'Try adjusting your keywords.' : `Say hello to ${partner.nickname} and make a connection!`}
            </p>
          </div>
        )}

        {filteredMessages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} group animate-bubble-in`}
            >
              {!isMe && (
                <Avatar url={partner.avatar_url} name={partner.nickname} size="sm" className="flex-shrink-0" />
              )}

              <div className="max-w-[85%] md:max-w-[68%] relative">
                {/* Bubble content */}
                <div
                  className={`px-4 py-3 rounded-2xl text-[13px] md:text-[13.5px] leading-relaxed relative shadow-lg ${
                    isMe
                      ? 'bubble-sent text-white rounded-br-none'
                      : 'bubble-received rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-all pr-4 font-medium">{msg.content}</p>
                  
                  {/* Reactions list */}
                  {msg.reactions && parseReactions(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 animate-emoji-pop justify-start select-none">
                      {parseReactions(msg.reactions).map(({ emoji, count, users }) => {
                        const hasReacted = users.includes(user?.nickname || '');
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReactMessage(msg.id, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold border transition-all hover:scale-105 active:scale-95 ${
                              hasReacted
                                ? 'bg-white/20 border-white/40 text-white'
                                : 'bg-black/25 border-white/5 text-slate-350 hover:bg-black/35'
                            }`}
                            title={`Reacted by: ${users.join(', ')}`}
                          >
                            <span>{emoji}</span>
                            <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Status, Date, Edited state */}
                  <div className="flex items-center justify-end gap-1.5 mt-2 text-[9px] text-white/50 select-none font-bold">
                    {msg.updated_at !== msg.created_at && (
                      <span className="italic opacity-85 text-[8px] bg-white/10 px-1 py-0.5 rounded">edited</span>
                    )}
                    <span>{formatTime(msg.created_at)}</span>
                    {isMe && (
                      <span className="ml-1 text-[10px]">
                        {msg.status === 'read' ? (
                          <span className="text-emerald-300 font-extrabold">✓✓</span>
                        ) : msg.status === 'delivered' ? (
                          <span className="text-indigo-250 font-extrabold">✓✓</span>
                        ) : (
                          <span className="text-white/60">✓</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hover actions & quick reactions */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1.5 px-2 z-20 ${
                    isMe ? 'right-full mr-2 flex-row-reverse' : 'left-full ml-2'
                  }`}
                >
                  {/* Quick Reaction Panel */}
                  <div className="flex items-center gap-0.5 bg-[#0f1322]/95 border border-white/8 rounded-full px-1.5 py-0.5 shadow-2xl backdrop-blur-md animate-emoji-pop select-none">
                    {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => {
                      const parsed = msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions) : {};
                      const active = parsed[user?.nickname || ''] === emoji;
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReactMessage(msg.id, emoji)}
                          className={`hover:scale-130 active:scale-90 transition-transform p-0.5 text-xs select-none duration-150 ${
                            active ? 'bg-white/10 rounded-full' : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>

                  {isMe && (
                    <button
                      onClick={() => handleStartEdit(msg)}
                      className="p-1.5 bg-slate-900/90 hover:bg-indigo-650 border border-white/5 rounded-lg text-slate-400 hover:text-white transition-all shadow-xl active:scale-90"
                      title="Edit message"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => setDeleteConfirmMsgId(msg.id)}
                    className="p-1.5 bg-slate-900/90 hover:bg-rose-900/40 border border-white/5 rounded-lg text-slate-400 hover:text-rose-450 transition-all shadow-xl active:scale-90"
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Message delete confirmation dialog */}
              {deleteConfirmMsgId === msg.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-sm bg-[#121624] border border-white/5 p-6 rounded-[24px] shadow-2xl relative animate-slide-up">
                    <h4 className="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
                      <span>Delete message?</span>
                      <span>🗑️</span>
                    </h4>
                    <p className="text-xs text-slate-400 mb-5 leading-relaxed font-medium">
                      {isMe
                        ? 'Do you want to delete this message just for you, or for both of you?'
                        : 'This message will be deleted only for your history.'}
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setDeleteConfirmMsgId(null)}
                        className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id, 'me')}
                        className="px-4 py-2.5 text-xs font-bold rounded-xl border border-white/5 text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        Delete for me
                      </button>
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id, 'both')}
                          className="px-4 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:brightness-110 text-white transition-all shadow-md shadow-rose-600/15"
                        >
                          Delete for both
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingStatus && (
          <div className="flex items-end gap-2.5 justify-start animate-pulse">
            <Avatar url={partner.avatar_url} name={partner.nickname} size="sm" />
            <div className="px-4 py-2.5 bg-[#121828]/80 border border-white/5 text-slate-400 rounded-2xl rounded-bl-none text-xs flex items-center gap-1.5 font-bold shadow-md">
              <span>{partner.nickname} is writing</span>
              <span className="flex gap-0.5 items-center justify-center mt-1">
                <span className="w-1.5 h-1.5 bg-indigo-450 rounded-full typing-dot" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-indigo-450 rounded-full typing-dot" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-indigo-450 rounded-full typing-dot" style={{ animationDelay: '300ms' }} />
              </span>
              <span className="text-xs select-none ml-0.5">✍️</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Scroll Bottom Widget */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 z-30 p-3 bg-[#0d111c]/90 border border-white/10 text-indigo-450 hover:text-white rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 animate-bounce flex items-center justify-center backdrop-blur-md cursor-pointer"
          title="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5" />
          {unreadScrolledCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-4 h-4 shadow-md">
              {unreadScrolledCount}
            </span>
          )}
        </button>
      )}

      {/* Edit message modal/overlay */}
      {editingMessage && (
        <div className="absolute inset-x-0 bottom-0 bg-[#0e1220]/95 border-t border-white/5 p-4.5 backdrop-blur-md z-30 animate-slide-up">
          <div className="max-w-4xl mx-auto flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-extrabold">
              <Edit3 className="w-3.5 h-3.5" /> <span>Editing Message ✏️</span>
            </div>
            <button
              onClick={() => setEditingMessage(null)}
              className="text-xs text-slate-400 hover:text-white font-bold"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleSaveEdit} className="max-w-4xl mx-auto flex gap-2">
            <input
              type="text"
              value={editInputText}
              onChange={(e) => setEditInputText(e.target.value)}
              className="flex-1 glass-input rounded-2xl px-4 py-3 text-slate-200 focus:outline-none text-sm font-medium"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
            >
              Save ✨
            </button>
          </form>
        </div>
      )}

      {/* Input container */}
      <div className="p-4 bg-[#0d111c]/60 border-t border-white/5 backdrop-blur-md relative z-10">
        {/* Telegram-style Emoji Picker Popup */}
        {showEmojiPicker && (
          <>
            {/* Click-outside capture overlay */}
            <div 
              className="fixed inset-0 z-40 cursor-default" 
              onClick={() => setShowEmojiPicker(false)} 
            />
            
            {/* Emoji drawer floating panel */}
            <div className="absolute bottom-[84px] right-4 z-50 w-72 bg-[#0e1220]/98 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-xl animate-slide-up select-none">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Quick Emojis 🦄</span>
                <button 
                  type="button" 
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                {[
                  '👍', '❤️', '😂', '😮', '😢', '🔥', 
                  '🎉', '💡', '🚀', '🔮', '✨', '🦄', 
                  '👋', '💬', '💖', '👏', '🌟', '💯', 
                  '👀', '⚡', '👑', '🥳', '🤩', '🧸', 
                  '🍕', '🍺', '☕', '🎈', '🎨', '🎸', 
                  '💻', '🤝', '💎', '🌈', '🍀', '❌'
                ].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + emoji);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/2 hover:bg-white/10 border border-white/5 text-base transition-all active:scale-90 hover:scale-115"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={`Message ${partner.nickname}... 🦄`}
              className="w-full glass-input rounded-2xl py-4 pl-4 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none text-sm font-semibold shadow-inner"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-450 hover:text-white">
              <button
                type="button"
                className={`p-1 transition-all rounded-lg ${
                  showEmojiPicker ? 'bg-white/10 text-indigo-400' : 'hover:bg-white/5 text-slate-400'
                }`}
                title="Add emoji"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="w-5 h-5 cursor-pointer" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-4 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none text-white rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.96] cursor-pointer"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
