import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { usePreferences } from '../context/PreferencesContext';
import { Avatar } from './Avatar';
import { 
  Send, Edit3, Trash2, Sparkles, Smile, ArrowLeft, Search, X, ChevronDown, 
  Mic, Play, Pause, Phone, PhoneOff, MicOff, Volume2, Download, Upload
} from 'lucide-react';

const STICKERS = [
  { id: 'cat_hello', emoji: '🐱', label: 'Привет!' },
  { id: 'dog_love', emoji: '🐶', label: 'Люблю!' },
  { id: 'bear_hug', emoji: '🧸', label: 'Обнимаю' },
  { id: 'fire_hot', emoji: '🔥', label: 'Мощь!' },
  { id: 'party_dance', emoji: '🥳', label: 'Туса!' },
  { id: 'brain_genius', emoji: '🧠', label: 'Гений!' },
  { id: 'cool_glass', emoji: '😎', label: 'Крутой' },
  { id: 'sleep_zz', emoji: '😴', label: 'Сплю...' },
  { id: 'unicorn_magic', emoji: '🦄', label: 'Магия' },
  { id: 'sad_cry', emoji: '😭', label: 'Рыдаю' },
  { id: 'rocket_go', emoji: '🚀', label: 'Взлетаем!' },
  { id: 'money_rich', emoji: '💸', label: 'Богач' }
];

let callAudioInterval: any = null;
const playCallRingTone = (type: 'ring' | 'disconnect') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    const ctx = new AudioContextClass();
    
    if (type === 'ring') {
      const playTone = () => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.2);
        osc2.stop(ctx.currentTime + 1.2);
      };
      
      playTone();
      callAudioInterval = setInterval(playTone, 2000);
      return () => {
        clearInterval(callAudioInterval);
        ctx.close();
      };
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(240, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => ctx.close(), 350);
      return null;
    }
  } catch (e) {
    return null;
  }
};

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
const playChimeSound = (type: 'sent' | 'received', soundEnabled: boolean) => {
  if (!soundEnabled) return;
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
  const { t, lang, soundEnabled, incrementStat, wallpaper } = usePreferences();

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

  // Voice recording simulation state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);

  // Simulated Voice Message player state (messageId -> { playing, progress })
  const [voicePlayback, setVoicePlayback] = useState<Record<number, { playing: boolean; progress: number }>>({});
  const playbackTimersRef = useRef<Record<number, number>>({});

  // Calling state
  const [activeCallState, setActiveCallState] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<number | null>(null);
  const callRingCleanupRef = useRef<(() => void) | null>(null);

  // Current tab in Emoji Drawer: 'emojis' | 'stickers'
  const [drawerTab, setDrawerTab] = useState<'emojis' | 'stickers'>('emojis');

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Export/Import states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importString, setImportString] = useState('');
  const [exportString, setExportString] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [isTypingState, setIsTypingState] = useState(false);

  // Compute export string when modal opens
  useEffect(() => {
    if (showExportModal) {
      try {
        const jsonStr = JSON.stringify(messages);
        const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
        setExportString(base64);
      } catch (e) {
        console.error('Failed to export chat:', e);
        setExportString('');
      }
    }
  }, [showExportModal, messages]);

  const handleImportChat = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportSuccess('');

    if (!importString.trim()) {
      setImportError(lang === 'ru' ? 'Введите строку бэкапа 🔍' : 'Please enter a backup string 🔍');
      return;
    }

    try {
      const decodedJson = decodeURIComponent(escape(atob(importString.trim())));
      const parsed = JSON.parse(decodedJson);

      if (!Array.isArray(parsed)) {
        throw new Error('Not an array');
      }

      for (const msg of parsed) {
        if (
          typeof msg !== 'object' || 
          msg === null ||
          typeof msg.content !== 'string' ||
          typeof msg.sender_id !== 'number' ||
          typeof msg.receiver_id !== 'number'
        ) {
          throw new Error('Invalid message structure');
        }
      }

      setMessages(parsed);
      setImportSuccess(t.importSuccess);
      setImportString('');
      
      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess('');
      }, 1500);

    } catch (err) {
      setImportError(t.importError);
    }
  };

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
          playChimeSound('received', soundEnabled);
        } else {
          setTimeout(scrollToBottom, 50);
          playChimeSound('received', soundEnabled);
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
        playChimeSound('sent', soundEnabled);
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
  }, [partner.id, user?.id, soundEnabled]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (callRingCleanupRef.current) callRingCleanupRef.current();
      Object.values(playbackTimersRef.current).forEach(clearInterval);
    };
  }, []);

  // Voice recording simulation functions
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopAndSendVoice = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    const finalDuration = recordingTime || 1;
    setIsRecording(false);
    setRecordingTime(0);
    
    sendJson({
      type: 'send_message',
      receiverId: partner.id,
      content: `[voice:${finalDuration}]`,
    });
    incrementStat('messages');
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  // Simulated voice note player functions
  const toggleVoicePlayback = (messageId: number, duration: number) => {
    setVoicePlayback((prev) => {
      const current = prev[messageId] || { playing: false, progress: 0 };
      const isPlaying = current.playing;

      if (isPlaying) {
        if (playbackTimersRef.current[messageId]) {
          clearInterval(playbackTimersRef.current[messageId]);
        }
        return {
          ...prev,
          [messageId]: { ...current, playing: false }
        };
      } else {
        if (playbackTimersRef.current[messageId]) {
          clearInterval(playbackTimersRef.current[messageId]);
        }

        const interval = window.setInterval(() => {
          setVoicePlayback((prevStates) => {
            const state = prevStates[messageId] || { playing: true, progress: 0 };
            const nextProgress = state.progress + (100 / (duration * 10));
            
            if (nextProgress >= 100) {
              clearInterval(playbackTimersRef.current[messageId]);
              return {
                ...prevStates,
                [messageId]: { playing: false, progress: 0 }
              };
            }

            return {
              ...prevStates,
              [messageId]: { playing: true, progress: nextProgress }
            };
          });
        }, 100);

        playbackTimersRef.current[messageId] = interval;

        return {
          ...prev,
          [messageId]: { playing: true, progress: current.progress >= 99 ? 0 : current.progress }
        };
      }
    });
  };

  // Calling simulation functions
  const startCall = () => {
    setActiveCallState('calling');
    setCallDuration(0);
    
    const cleanup = playCallRingTone('ring');
    callRingCleanupRef.current = cleanup ? cleanup : null;

    setTimeout(() => {
      setActiveCallState((current) => {
        if (current === 'calling') {
          if (callRingCleanupRef.current) {
            callRingCleanupRef.current();
            callRingCleanupRef.current = null;
          }
          callTimerRef.current = window.setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
          return 'connected';
        }
        return current;
      });
    }, 3000);
  };

  const endCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (callRingCleanupRef.current) {
      callRingCleanupRef.current();
      callRingCleanupRef.current = null;
    }

    playCallRingTone('disconnect');
    
    const finalDuration = callDuration;
    setActiveCallState('ended');

    const formatDurationStr = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };
    
    sendJson({
      type: 'send_message',
      receiverId: partner.id,
      content: lang === 'ru' 
        ? `📞 Голосовой звонок завершен. Продолжительность: ${formatDurationStr(finalDuration)}` 
        : `📞 Voice call ended. Duration: ${formatDurationStr(finalDuration)}`,
    });
    incrementStat('messages');

    setTimeout(() => {
      setActiveCallState('idle');
      setCallDuration(0);
    }, 1500);
  };

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
    incrementStat('messages');

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
    incrementStat('reactions');
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
                <h3 className="font-extrabold text-white text-sm leading-tight tracking-wide truncate">
                  {partner.id === user?.id ? t.savedMessages : partner.nickname}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                  {partner.id === user?.id ? (
                    <span className="opacity-80">{t.savedMessagesSub}</span>
                  ) : partner.presence_status === 'online' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      {t.online} <span className="animate-ping w-1 h-1 bg-emerald-450 rounded-full" />
                    </span>
                  ) : (
                    <span className="opacity-80">
                      {t.offline}
                      {partner.last_seen && ` • ${t.lastSeen} ${new Date(partner.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
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
                placeholder={t.searchMessages}
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
          {partner.bio && !showSearchInput && partner.id !== user?.id && (
            <div className="hidden lg:block max-w-[200px] xl:max-w-[280px] text-right mr-2">
              <p className="text-[10px] text-slate-400 font-semibold line-clamp-1 italic text-indigo-200/80">
                💬 "{partner.bio}"
              </p>
            </div>
          )}
          
          {partner.id !== user?.id && !showSearchInput && (
            <button
              onClick={startCall}
              className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 hover:text-white hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Start call"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {/* Export button */}
          {!showSearchInput && (
            <button
              onClick={() => setShowExportModal(true)}
              className="p-2 rounded-xl bg-white/2 border border-white/5 text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title={t.exportChat}
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Import button */}
          {!showSearchInput && (
            <button
              onClick={() => setShowImportModal(true)}
              className="p-2 rounded-xl bg-white/2 border border-white/5 text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title={t.importChat}
            >
              <Upload className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              if (showSearchInput) {
                setChatSearchQuery('');
              }
              setShowSearchInput(!showSearchInput);
            }}
            className={`p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              showSearchInput 
                ? 'bg-indigo-650/20 border-indigo-500/35 text-indigo-300' 
                : 'bg-white/2 border-white/5 text-slate-400 hover:text-white'
            }`}
            title={t.searchMessages}
          >
            {showSearchInput ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-6 space-y-4 bg-gradient-to-b from-transparent via-[#060810]/20 to-[#060810]/50 relative transition-all duration-300 ${
          wallpaper === 'cyber' ? 'bg-grid-pattern' :
          wallpaper === 'sunset' ? 'bg-sunset-pattern' :
          wallpaper === 'midnight' ? 'bg-stars-pattern' :
          wallpaper === 'emerald' ? 'bg-vines-pattern' : ''
        }`}
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
              {chatSearchQuery ? t.noMatchingMsgs : t.emptyHistory}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-[240px]">
              {chatSearchQuery ? t.noMatchingMsgs : (partner.id === user?.id ? t.savedMessagesSub : t.sayHello)}
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
                {/* Bubble content */}
                {(() => {
                  const isSticker = msg.content.startsWith('[sticker:') && msg.content.endsWith(']');
                  const isVoice = msg.content.startsWith('[voice:') && msg.content.endsWith(']');

                  if (isSticker) {
                    const stickerId = msg.content.substring(9, msg.content.length - 1);
                    const sticker = STICKERS.find((s) => s.id === stickerId) || { emoji: '✨', label: 'Стикер' };

                    return (
                      <div className="flex flex-col items-center justify-center p-2 animate-emoji-pop select-none">
                        <span className="text-7xl transition-transform hover:scale-120 duration-200">{sticker.emoji}</span>
                        <span className="text-[10px] text-slate-500 font-bold bg-white/5 border border-white/5 px-2 py-0.5 rounded-full mt-2">
                          {sticker.label}
                        </span>
                        
                        <div className="flex items-center justify-end gap-1.5 mt-2.5 text-[8.5px] text-slate-550 select-none font-bold">
                          <span>{formatTime(msg.created_at)}</span>
                          {isMe && (
                            <span className="text-[10px]">
                              {msg.status === 'read' ? (
                                <span className="text-emerald-450">✓✓</span>
                              ) : msg.status === 'delivered' ? (
                                <span className="text-indigo-400">✓✓</span>
                              ) : (
                                <span className="text-slate-500">✓</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (isVoice) {
                    const duration = parseInt(msg.content.substring(7, msg.content.length - 1), 10) || 5;
                    const pbState = voicePlayback[msg.id] || { playing: false, progress: 0 };
                    
                    const formatDurationStr = (sec: number) => {
                      const m = Math.floor(sec / 60);
                      const s = sec % 60;
                      return `${m}:${s < 10 ? '0' : ''}${s}`;
                    };

                    const currentSeconds = Math.round((pbState.progress / 100) * duration);

                    return (
                      <div
                        className={`px-4 py-3 rounded-2xl text-[13px] md:text-[13.5px] leading-relaxed relative shadow-lg ${
                          isMe
                            ? 'bubble-sent text-white rounded-br-none'
                            : 'bubble-received rounded-bl-none'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 pr-2.5 min-w-[200px] md:min-w-[230px]">
                          <button
                            type="button"
                            onClick={() => toggleVoicePlayback(msg.id, duration)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md shrink-0 cursor-pointer ${
                              isMe ? 'bg-white text-[#6366f1]' : 'bg-[#6366f1] text-white'
                            }`}
                          >
                            {pbState.playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                          </button>

                          <div className="flex-1">
                            <div className="flex items-center gap-1 h-7">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
                                const barProgress = bar * 10;
                                const isActive = pbState.progress >= barProgress;
                                const activeClass = isActive 
                                  ? (isMe ? 'bg-white' : 'bg-indigo-400') 
                                  : (isMe ? 'bg-white/35' : 'bg-slate-700');
                                
                                return (
                                  <span
                                    key={bar}
                                    className={`w-[3px] rounded-full transition-all ${activeClass} ${
                                      pbState.playing && isActive ? `voice-wave-bar animate-wave-${(bar % 5) + 1}` : ''
                                    }`}
                                    style={{
                                      height: `${10 + Math.sin(bar * 0.8) * 10}px`
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <div className="flex justify-between items-center mt-1 text-[9px] font-bold opacity-75">
                              <span>{pbState.playing ? formatDurationStr(currentSeconds) : t.voiceMessage}</span>
                              <span>{formatDurationStr(duration)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 mt-2 text-[9px] text-white/50 select-none font-bold">
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
                    );
                  }

                  return (
                    <div
                      className={`px-4 py-3 rounded-2xl text-[13px] md:text-[13.5px] leading-relaxed relative shadow-lg ${
                        isMe
                          ? 'bubble-sent text-white rounded-br-none'
                          : 'bubble-received rounded-bl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-all pr-4 font-medium">{msg.content}</p>
                      
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

                      <div className="flex items-center justify-end gap-1.5 mt-2 text-[9px] text-white/50 select-none font-bold">
                        {msg.updated_at !== msg.created_at && (
                          <span className="italic opacity-85 text-[8px] bg-white/10 px-1 py-0.5 rounded">{lang === 'ru' ? 'изменено' : 'edited'}</span>
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
                  );
                })()}

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
                      className="p-1.5 bg-slate-900/90 hover:bg-indigo-650 border border-white/5 rounded-lg text-slate-400 hover:text-white transition-all shadow-xl active:scale-90 cursor-pointer"
                      title="Edit message"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => setDeleteConfirmMsgId(msg.id)}
                    className="p-1.5 bg-slate-900/90 hover:bg-rose-900/40 border border-white/5 rounded-lg text-slate-400 hover:text-rose-450 transition-all shadow-xl active:scale-90 cursor-pointer"
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
                      <span>{t.deleteMsg}</span>
                      <span>🗑️</span>
                    </h4>
                    <p className="text-xs text-slate-400 mb-5 leading-relaxed font-medium">
                      {isMe ? t.deleteConfirmText : (lang === 'ru' ? 'Это сообщение будет удалено только из вашей истории.' : 'This message will be deleted only for your history.')}
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setDeleteConfirmMsgId(null)}
                        className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 transition-all cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id, 'me')}
                        className="px-4 py-2.5 text-xs font-bold rounded-xl border border-white/5 text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                      >
                        {t.deleteForMe}
                      </button>
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id, 'both')}
                          className="px-4 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:brightness-110 text-white transition-all shadow-md shadow-rose-600/15 cursor-pointer"
                        >
                          {t.deleteForBoth}
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
              <span>{partner.nickname} {t.writing}</span>
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

      {/* Edit message banner overlay */}
      {editingMessage && (
        <div className="absolute inset-x-0 bottom-0 bg-[#0e1220]/95 border-t border-white/5 p-4.5 backdrop-blur-md z-30 animate-slide-up">
          <div className="max-w-4xl mx-auto flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-extrabold">
              <Edit3 className="w-3.5 h-3.5" /> <span>{t.editMsg}</span>
            </div>
            <button
              onClick={() => setEditingMessage(null)}
              className="text-xs text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              {t.cancel}
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
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/10 active:scale-95 cursor-pointer"
            >
              {t.save}
            </button>
          </form>
        </div>
      )}

      {/* Input container */}
      <div className="p-4 bg-[#0d111c]/60 border-t border-white/5 backdrop-blur-md relative z-10">
        {/* Telegram-style Emoji / Sticker Picker Popup */}
        {showEmojiPicker && (
          <>
            <div 
              className="fixed inset-0 z-40 cursor-default" 
              onClick={() => setShowEmojiPicker(false)} 
            />
            
            <div className="absolute bottom-[84px] right-4 z-50 w-72 bg-[#0e1220]/98 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-xl animate-slide-up select-none">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 gap-2">
                <div className="flex gap-1 bg-white/2 p-0.5 rounded-lg border border-white/5 select-none shrink-0">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('emojis')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      drawerTab === 'emojis' ? 'bg-indigo-650 text-white' : 'text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    {t.emojis}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab('stickers')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      drawerTab === 'stickers' ? 'bg-indigo-650 text-white' : 'text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    {t.stickers}
                  </button>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {drawerTab === 'emojis' ? (
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
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/2 hover:bg-white/10 border border-white/5 text-base transition-all active:scale-90 hover:scale-115 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {STICKERS.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => {
                        sendJson({
                          type: 'send_message',
                          receiverId: partner.id,
                          content: `[sticker:${sticker.id}]`,
                        });
                        incrementStat('messages');
                        setShowEmojiPicker(false);
                      }}
                      className="h-14 flex flex-col items-center justify-center rounded-xl bg-white/2 hover:bg-white/10 border border-white/5 transition-all active:scale-90 hover:scale-110 p-1 cursor-pointer"
                      title={sticker.label}
                    >
                      <span className="text-2xl select-none">{sticker.emoji}</span>
                      <span className="text-[7.5px] text-slate-400 truncate w-full text-center mt-1 leading-none font-bold">
                        {sticker.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          {isRecording ? (
            <div className="flex-1 flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-2xl py-3 px-4 animate-pulse">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                <span className="text-rose-455 font-extrabold text-xs tracking-wider uppercase">{t.recording}</span>
                <span className="text-white text-xs font-bold font-mono">
                  {Math.floor(recordingTime / 60)}:{recordingTime % 60 < 10 ? '0' : ''}{recordingTime % 60}
                </span>
                
                <div className="flex items-end gap-0.5 h-4 ml-1 select-none">
                  <span className="voice-wave-bar animate-wave-1 h-3 text-rose-400" />
                  <span className="voice-wave-bar animate-wave-2 h-4 text-rose-400" />
                  <span className="voice-wave-bar animate-wave-3 h-2 text-rose-400" />
                  <span className="voice-wave-bar animate-wave-4 h-3 text-rose-400" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-3.5 py-1.5 text-[10px] font-bold rounded-lg border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={stopAndSendVoice}
                  className="px-3.5 py-1.5 text-[10px] font-bold rounded-lg bg-rose-600 hover:brightness-110 text-white transition-all shadow-md cursor-pointer"
                >
                  {lang === 'ru' ? 'Отправить' : 'Send'}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder={`${partner.id === user?.id ? t.savedMessages : `${t.writing.split(' ')[0]} ${partner.nickname}...`}`}
                className="w-full glass-input rounded-2xl py-4 pl-4 pr-12 text-slate-200 placeholder-slate-505 focus:outline-none text-sm font-semibold shadow-inner"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-450 hover:text-white">
                <button
                  type="button"
                  className={`p-1 transition-all rounded-lg cursor-pointer ${
                    showEmojiPicker ? 'bg-white/10 text-indigo-400' : 'hover:bg-white/5 text-slate-450'
                  }`}
                  title="Add emoji"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {!isRecording && (
            <>
              {inputText.trim() ? (
                <button
                  type="submit"
                  className="p-4 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:brightness-110 text-white rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.96] cursor-pointer"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-4 bg-white/2 hover:bg-white/5 border border-white/5 text-indigo-400 hover:text-white rounded-2xl transition-all active:scale-[0.96] cursor-pointer"
                  title="Record voice note"
                >
                  <Mic className="w-4.5 h-4.5" />
                </button>
              )}
            </>
          )}
        </form>
      </div>
      {/* Calling Simulation Modal Overlay */}
      {activeCallState !== 'idle' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950/85 backdrop-blur-xl p-8 select-none animate-fade-in text-white">
          <div className="text-center mt-12">
            <h4 className="text-indigo-400 font-bold uppercase tracking-widest text-[11px] mb-2">{t.callTitle}</h4>
            <h3 className="text-3xl font-extrabold tracking-wide">{partner.nickname}</h3>
            <p className="text-xs text-slate-400 font-medium mt-2 animate-pulse">
              {activeCallState === 'calling' && t.calling}
              {activeCallState === 'connected' && `${lang === 'ru' ? 'Разговор:' : 'Active:'} ${Math.floor(callDuration / 60)}:${callDuration % 60 < 10 ? '0' : ''}${callDuration % 60}`}
              {activeCallState === 'ended' && t.callEnded}
            </p>
          </div>

          <div className="relative my-8 flex items-center justify-center">
            <div className={`w-32 h-32 rounded-full absolute bg-indigo-500/10 blur-xl ${activeCallState === 'calling' ? 'scale-150 animate-ping' : ''}`} />
            <div className={`w-36 h-36 rounded-full border border-indigo-500/15 flex items-center justify-center ${activeCallState === 'calling' ? 'call-ring-pulse' : ''}`}>
              <Avatar url={partner.avatar_url} name={partner.nickname} size="xl" className="rounded-full shadow-2xl ring-4 ring-indigo-500/20" />
            </div>
          </div>

          <div className="mb-12 flex flex-col items-center gap-6">
            {activeCallState === 'connected' && (
              <div className="flex gap-8 justify-center mb-2">
                <button type="button" className="p-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 text-slate-350 transition-all hover:scale-105 active:scale-95 cursor-pointer">
                  <MicOff className="w-5 h-5" />
                </button>
                <button type="button" className="p-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 text-slate-355 transition-all hover:scale-105 active:scale-95 cursor-pointer">
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            )}
            
            <button
              type="button"
              onClick={endCall}
              className="p-5 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-full hover:brightness-110 shadow-2xl shadow-rose-600/35 transition-all hover:scale-110 active:scale-90 flex items-center justify-center cursor-pointer"
            >
              <PhoneOff className="w-6 h-6 rotate-135" />
            </button>
          </div>
        </div>
      )}

      {/* Export Chat Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121624] border border-white/5 p-6 rounded-[24px] shadow-2xl relative animate-slide-up">
            <button
              onClick={() => {
                setShowExportModal(false);
                setCopyStatus(false);
              }}
              className="absolute top-4 right-4 text-slate-450 hover:text-white p-1 rounded hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
              <span>{t.exportTitle}</span>
              <span>📤</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed font-medium">
              {t.exportDesc}
            </p>
            <textarea
              readOnly
              value={exportString}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              className="w-full h-32 bg-[#0a0d16] border border-white/5 rounded-xl p-3 text-xs text-indigo-200 focus:outline-none font-mono resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setCopyStatus(false);
                }}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportString);
                  setCopyStatus(true);
                  setTimeout(() => setCopyStatus(false), 2000);
                }}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {copyStatus ? (
                  <span>{lang === 'ru' ? 'Скопировано! 📋' : 'Copied! 📋'}</span>
                ) : (
                  <span>{lang === 'ru' ? 'Копировать 📋' : 'Copy 📋'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Chat Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121624] border border-white/5 p-6 rounded-[24px] shadow-2xl relative animate-slide-up">
            <button
              onClick={() => {
                setShowImportModal(false);
                setImportError('');
                setImportSuccess('');
                setImportString('');
              }}
              className="absolute top-4 right-4 text-slate-450 hover:text-white p-1 rounded hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
              <span>{t.importTitle}</span>
              <span>📥</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed font-medium">
              {t.importDesc}
            </p>

            {importError && (
              <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-455 text-[11px] rounded-xl font-bold animate-pulse">
                {importError}
              </div>
            )}

            {importSuccess && (
              <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-[11px] rounded-xl font-bold animate-pulse">
                {importSuccess}
              </div>
            )}

            <form onSubmit={handleImportChat}>
              <textarea
                value={importString}
                onChange={(e) => setImportString(e.target.value)}
                placeholder="ey..."
                className="w-full h-32 bg-[#0a0d16] border border-white/5 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono resize-none mb-4 focus:border-indigo-500/30"
                required
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportError('');
                    setImportSuccess('');
                    setImportString('');
                  }}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 transition-all cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
                >
                  {lang === 'ru' ? 'Импортировать 🚀' : 'Import 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
