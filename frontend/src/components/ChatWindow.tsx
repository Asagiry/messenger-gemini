import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Send, Edit3, Trash2, Sparkles, Smile } from 'lucide-react';

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  updated_at: string;
}

interface ChatWindowProps {
  partner: User;
  typingStatus: boolean;
  onBack: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ partner, typingStatus, onBack }) => {
  const { user, token } = useAuth();
  const { sendJson, subscribe } = useWebSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editInputText, setEditInputText] = useState('');
  const [deleteConfirmMsgId, setDeleteConfirmMsgId] = useState<number | null>(null);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [isTypingState, setIsTypingState] = useState(false);

  const LIMIT = 50;

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

        // If it's initial load, replace messages. If we're scrolling up, prepend messages.
        if (initial) {
          setMessages(data);
          setOffset(data.length);
          // Scroll to bottom after state update
          setTimeout(scrollToBottom, 50);
        } else {
          // Prepend messages and maintain scroll position
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
    fetchMessages(true);

    // Send read status update via WebSocket
    sendJson({ type: 'read_messages', senderId: partner.id });
  }, [partner.id]);

  // 2. Subscribe to WebSocket events
  useEffect(() => {
    // New message handler
    const unsubscribeNew = subscribe('new_message', (payload) => {
      const msg: Message = payload.message;
      if (msg.sender_id === partner.id) {
        setMessages((prev) => [...prev, msg]);
        setOffset((o) => o + 1);
        setTimeout(scrollToBottom, 50);

        // Mark as read immediately since chat window is open
        sendJson({ type: 'read_messages', senderId: partner.id });
      }
    });

    // Message sent confirmation handler
    const unsubscribeSentConfirm = subscribe('message_sent_confirm', (payload) => {
      const msg: Message = payload.message;
      if (msg.receiver_id === partner.id) {
        setMessages((prev) => [...prev, msg]);
        setOffset((o) => o + 1);
        setTimeout(scrollToBottom, 50);
      }
    });

    // Message edited handler
    const unsubscribeEdit = subscribe('message_edited', (payload) => {
      const edited: Message = payload.message;
      if (edited.sender_id === partner.id) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === edited.id ? edited : msg))
        );
      }
    });

    // Message edited confirm handler
    const unsubscribeEditConfirm = subscribe('message_edited_confirm', (payload) => {
      const edited: Message = payload.message;
      if (edited.receiver_id === partner.id) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === edited.id ? edited : msg))
        );
        setEditingMessage(null);
      }
    });

    // Message deleted handler
    const unsubscribeDelete = subscribe('message_deleted', (payload) => {
      const { messageId } = payload;
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setOffset((o) => Math.max(0, o - 1));
    });

    // Message deleted confirm handler
    const unsubscribeDeleteConfirm = subscribe('message_deleted_confirm', (payload) => {
      const { messageId } = payload;
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setOffset((o) => Math.max(0, o - 1));
      setDeleteConfirmMsgId(null);
    });

    // Messages read confirm handler (partner read our messages)
    const unsubscribeRead = subscribe('messages_read', (payload) => {
      const { receiverId } = payload;
      if (receiverId === partner.id) {
        setMessages((prev) =>
          prev.map((msg) => (msg.sender_id === user?.id ? { ...msg, status: 'read' } : msg))
        );
      }
    });

    return () => {
      unsubscribeNew();
      unsubscribeSentConfirm();
      unsubscribeEdit();
      unsubscribeEditConfirm();
      unsubscribeDelete();
      unsubscribeDeleteConfirm();
      unsubscribeRead();
    };
  }, [partner.id, user?.id]);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (container && container.scrollTop <= 10 && !loadingMore && hasMore) {
      fetchMessages(false);
    }
  };

  // Typing indicator trigger
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

    // Send via WebSocket
    sendJson({
      type: 'send_message',
      receiverId: partner.id,
      content: inputText.trim(),
    });

    setInputText('');

    // Cancel typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTypingState(false);
    sendJson({ type: 'typing', receiverId: partner.id, isTyping: false });
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

  return (
    <div className="flex flex-col h-full bg-slate-950/40 relative">
      {/* Chat header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl mr-1 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="relative">
            <img
              src={partner.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={partner.nickname}
              className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-800"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
              }}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                partner.presence_status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            />
          </div>

          <div>
            <h3 className="font-bold text-white text-sm leading-tight">{partner.nickname}</h3>
            <p className="text-xs text-slate-400">
              {partner.presence_status === 'online' ? (
                <span className="text-emerald-400 font-medium">online</span>
              ) : (
                <span>
                  offline
                  {partner.last_seen && ` • last seen ${new Date(partner.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              )}
            </p>
          </div>
        </div>

        {partner.bio && (
          <div className="hidden lg:block max-w-xs text-right">
            <p className="text-xs text-slate-400 line-clamp-1 italic">"{partner.bio}"</p>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-indigo-400 animate-pulse">Loading previous messages...</span>
          </div>
        )}

        {messages.length === 0 && !loadingMore && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-3xl mb-4 border border-indigo-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300">No messages yet</p>
            <p className="text-xs text-slate-500 mt-1">Start chatting to begin the conversation.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} group`}
            >
              {!isMe && (
                <img
                  src={partner.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={partner.nickname}
                  className="w-7 h-7 rounded-lg object-cover bg-slate-800 mb-1 border border-slate-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                  }}
                />
              )}

              <div className="max-w-[70%] relative">
                {/* Bubble content */}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm relative shadow-md ${
                    isMe
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800/80 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-all pr-4">{msg.content}</p>
                  
                  {/* Status, Date, Edited state */}
                  <div className="flex items-center justify-end gap-1 mt-1.5 text-[9px] text-slate-300/60 select-none">
                    {msg.updated_at !== msg.created_at && (
                      <span className="italic mr-1 text-[8px]">edited</span>
                    )}
                    <span>{formatTime(msg.created_at)}</span>
                    {isMe && (
                      <span className="ml-1">
                        {msg.status === 'read' ? (
                          <span className="text-indigo-200 font-bold">✓✓</span>
                        ) : msg.status === 'delivered' ? (
                          <span>✓✓</span>
                        ) : (
                          <span>✓</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hover actions */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 z-20 ${
                    isMe ? 'right-full mr-2 flex-row-reverse' : 'left-full ml-2'
                  }`}
                >
                  {isMe && (
                    <button
                      onClick={() => handleStartEdit(msg)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-all shadow-lg"
                      title="Edit message"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => setDeleteConfirmMsgId(msg.id)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-all shadow-lg"
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Message delete confirmation dialog */}
              {deleteConfirmMsgId === msg.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
                  <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl relative">
                    <h4 className="text-sm font-bold text-white mb-2">Delete message?</h4>
                    <p className="text-xs text-slate-400 mb-5">
                      {isMe
                        ? 'Do you want to delete this message just for you, or for both of you?'
                        : 'This message will be deleted only for you.'}
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setDeleteConfirmMsgId(null)}
                        className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-750 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id, 'me')}
                        className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-800 text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        Delete for me
                      </button>
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id, 'both')}
                          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/15"
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
            <img
              src={partner.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={partner.nickname}
              className="w-7 h-7 rounded-lg object-cover bg-slate-800 mb-1 border border-slate-800"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
              }}
            />
            <div className="px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl rounded-bl-none text-xs flex items-center gap-1.5">
              <span>{partner.nickname} is typing</span>
              <span className="flex gap-0.5 items-center justify-center mt-1">
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Edit message modal/overlay */}
      {editingMessage && (
        <div className="absolute inset-x-0 bottom-0 bg-slate-900/90 border-t border-slate-800 p-4 backdrop-blur-md z-30 animate-slide-up">
          <div className="max-w-4xl mx-auto flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
              <Edit3 className="w-3.5 h-3.5" /> Editing Message
            </div>
            <button
              onClick={() => setEditingMessage(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleSaveEdit} className="max-w-4xl mx-auto flex gap-2">
            <input
              type="text"
              value={editInputText}
              onChange={(e) => setEditInputText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/10"
            >
              Save
            </button>
          </form>
        </div>
      )}

      {/* Input container */}
      <div className="p-4 bg-slate-900/60 border-t border-slate-850/60 backdrop-blur-md relative z-10">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={`Message ${partner.nickname}...`}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-3.5 pl-4 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm shadow-inner"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-500">
              <button
                type="button"
                className="p-1 hover:text-slate-300 transition-colors"
                title="Add emoji (standard keyboard)"
                onClick={() => setInputText(prev => prev + '😊')}
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
