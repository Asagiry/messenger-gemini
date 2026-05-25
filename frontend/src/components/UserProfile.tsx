import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import type { ChatTheme } from '../context/PreferencesContext';
import { Avatar, PRESET_AVATARS } from './Avatar';
import { 
  X, User, Image, FileText, Lock, Check, 
  Volume2, VolumeX, Globe, Palette, Shield, BarChart2 
} from 'lucide-react';

interface UserProfileProps {
  onClose: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { user, token, updateUser } = useAuth();
  const { 
    lang, setLang, 
    theme, setTheme, 
    soundEnabled, setSoundEnabled, 
    wallpaper, setWallpaper,
    t, getStat 
  } = usePreferences();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Active section tab: 'profile' | 'appearance' | 'security' | 'stats'
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'security' | 'stats'>('profile');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname) {
      setError(lang === 'ru' ? 'Имя пользователя обязательно 📛' : 'Nickname is required 📛');
      return;
    }

    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('/api/profile/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname, avatar_url: avatarUrl, bio, password: password || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || (lang === 'ru' ? 'Ошибка сохранения ❌' : 'Failed to update profile ❌'));
      }

      updateUser(data.user);
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      setSuccess(true);
      setPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong ⚡');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-[#0a0d18]/95 border border-white/8 rounded-[32px] shadow-2xl overflow-hidden relative backdrop-blur-2xl animate-slide-up flex flex-col md:flex-row h-[90vh] md:h-[620px]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all z-10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Sidebar tabs navigation */}
        <div className="w-full md:w-[180px] bg-black/20 border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-row md:flex-col gap-1 md:gap-1.5 overflow-x-auto md:overflow-x-visible shrink-0 select-none">
          <div className="hidden md:flex items-center gap-2 px-2 pb-4 pt-1 mb-2 border-b border-white/5">
            <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {t.settingsTitle.split(' ')[0]}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                : 'text-slate-450 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{lang === 'ru' ? 'Профиль' : 'Profile'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                : 'text-slate-450 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>{lang === 'ru' ? 'Настройки' : 'Settings'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left cursor-pointer ${
              activeTab === 'security'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                : 'text-slate-450 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{lang === 'ru' ? 'Безопасность' : 'Security'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                : 'text-slate-450 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>{lang === 'ru' ? 'Статистика' : 'Stats'}</span>
          </button>
        </div>

        {/* Form Content body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-w-0 h-full">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 rounded-2xl animate-pulse">
                <Check className="w-4 h-4" /> {lang === 'ru' ? 'Профиль успешно сохранен! 🎉' : 'Profile updated successfully! 🎉'}
              </div>
            )}

            {/* TAB: PROFILE PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-4 animate-fade-in">
                {/* Profile Picture Preview */}
                <div className="flex items-center gap-4 bg-white/2 p-4 rounded-2xl border border-white/5 shadow-inner">
                  <Avatar url={avatarUrl} name={nickname} size="xl" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{lang === 'ru' ? 'Предпросмотр аватара' : 'Avatar Preview'}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium">{t.leaveBlank}</p>
                  </div>
                </div>

                {/* Preset Avatar Picker Grid */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
                    {t.presetAvatars}
                  </label>
                  <div className="grid grid-cols-5 gap-2 p-2.5 bg-white/2 border border-white/5 rounded-2xl">
                    {Object.entries(PRESET_AVATARS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAvatarUrl(key)}
                        className={`flex items-center justify-center p-2 rounded-xl bg-gradient-to-tr ${preset.gradient} border text-xl transition-all active:scale-90 hover:brightness-110 shadow-md ${
                          avatarUrl === key 
                            ? 'border-white scale-105 ring-2 ring-indigo-500/40' 
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        {preset.emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
                    {t.nickname}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      className="w-full glass-input rounded-2xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none text-sm font-medium"
                      placeholder="nickname"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
                    {t.avatarUrl}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <Image className="w-4 h-4" />
                    </span>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="w-full glass-input rounded-2xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none text-sm font-medium"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
                    {t.bio}
                  </label>
                  <div className="relative">
                    <span className="absolute top-3 left-3.5 text-slate-500">
                      <FileText className="w-4 h-4" />
                    </span>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full glass-input rounded-2xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none text-sm font-medium resize-none"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: APPEARANCE & SYSTEM */}
            {activeTab === 'appearance' && (
              <div className="space-y-5 animate-fade-in">
                {/* Language selection */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 pl-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> <span>{lang === 'ru' ? 'Язык интерфейса' : 'Interface Language'}</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLang('ru')}
                      className={`flex-1 py-3 px-4 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        lang === 'ru'
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                          : 'bg-white/2 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>Русский 🇷🇺</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`flex-1 py-3 px-4 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        lang === 'en'
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                          : 'bg-white/2 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>English 🇬🇧</span>
                    </button>
                  </div>
                </div>

                {/* Theme Selection */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 pl-1 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> <span>{t.theme}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['dark', 'neon', 'emerald', 'ocean'] as ChatTheme[]).map((tKey) => {
                      const label = {
                        dark: t.themeDark,
                        neon: t.themeNeon,
                        emerald: t.themeEmerald,
                        ocean: t.themeOcean
                      }[tKey];
                      
                      const gradients = {
                        dark: 'from-[#080a14] to-[#0c0f1d]',
                        neon: 'from-[#16041f] to-[#250633]',
                        emerald: 'from-[#02120b] to-[#042416]',
                        ocean: 'from-[#03101b] to-[#062036]'
                      }[tKey];

                      const borderColors = {
                        dark: 'border-indigo-500/40',
                        neon: 'border-pink-500/40',
                        emerald: 'border-emerald-500/40',
                        ocean: 'border-sky-500/40'
                      }[tKey];

                      return (
                        <button
                          key={tKey}
                          type="button"
                          onClick={() => setTheme(tKey)}
                          className={`p-3.5 rounded-xl border text-left bg-gradient-to-br ${gradients} transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden ${
                            theme === tKey 
                              ? `border-white ring-2 ${borderColors}` 
                              : 'border-white/5 hover:border-white/10'
                          }`}
                        >
                          <span className="text-[11px] font-bold text-white tracking-wide block mb-1">
                            {label}
                          </span>
                          <div className="flex gap-1 mt-2.5">
                            <span className="w-3 h-3 rounded-full bg-slate-400" />
                            <span className={`w-3 h-3 rounded-full bg-gradient-to-tr ${
                              tKey === 'dark' ? 'from-indigo-500 to-purple-500' :
                              tKey === 'neon' ? 'from-pink-500 to-violet-500' :
                              tKey === 'emerald' ? 'from-emerald-400 to-teal-600' :
                              'from-sky-400 to-blue-600'
                            }`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notifications Sound Toggle */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 pl-1 flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> <span>{t.notifications}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      soundEnabled 
                        ? 'bg-indigo-500/10 border-indigo-500/35 text-indigo-400' 
                        : 'bg-white/2 border-white/5 text-slate-450 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {soundEnabled ? <Volume2 className="w-4 h-4 animate-bounce" /> : <VolumeX className="w-4 h-4" />}
                      <span>{soundEnabled ? t.soundEnabled : t.soundDisabled}</span>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                      {soundEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                {/* Chat Wallpaper Selection */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 pl-1 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" /> <span>{t.wallpaper}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['default', 'cyber', 'sunset', 'midnight', 'emerald'] as const).map((wKey) => {
                      const label = {
                        default: t.wpDefault,
                        cyber: t.wpCyber,
                        sunset: t.wpSunset,
                        midnight: t.wpMidnight,
                        emerald: t.wpEmerald
                      }[wKey];

                      const previews = {
                        default: 'bg-[#05060b]',
                        cyber: 'bg-slate-900 bg-grid-pattern',
                        sunset: 'bg-gradient-to-tr from-[#25042b] to-[#120538]',
                        midnight: 'bg-black bg-stars-pattern',
                        emerald: 'bg-[#031c10] bg-vines-pattern'
                      }[wKey];

                      return (
                        <button
                          key={wKey}
                          type="button"
                          onClick={() => setWallpaper(wKey)}
                          className={`p-3 rounded-xl border text-left ${previews} transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden h-[72px] flex flex-col justify-between ${
                            wallpaper === wKey 
                              ? 'border-white ring-2 ring-indigo-500/40 shadow-xl' 
                              : 'border-white/5 hover:border-white/10'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-white tracking-wide block bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-xs select-none">
                            {label}
                          </span>
                          <div className="flex justify-end select-none">
                            {wallpaper === wKey && (
                              <span className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center border border-white text-white text-[10px] font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SECURITY SECURITY */}
            {activeTab === 'security' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
                    {t.changePassword}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full glass-input rounded-2xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none text-sm font-medium"
                      placeholder={t.leaveBlank}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: USAGE STATS STATISTICS */}
            {activeTab === 'stats' && (
              <div className="space-y-4 animate-fade-in select-none">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider pl-1">{t.stats}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-white/2 border border-white/5 rounded-2xl shadow-inner flex flex-col justify-between h-24">
                    <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">{t.statsMessages}</span>
                    <span className="text-3xl font-extrabold font-display bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      {getStat('messages')}
                    </span>
                  </div>
                  <div className="p-4 bg-white/2 border border-white/5 rounded-2xl shadow-inner flex flex-col justify-between h-24">
                    <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">{t.statsReactions}</span>
                    <span className="text-3xl font-extrabold font-display bg-gradient-to-r from-pink-400 to-purple-450 bg-clip-text text-transparent">
                      {getStat('reactions')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          {activeTab !== 'stats' && (
            <div className="p-6 border-t border-white/5 flex gap-3 justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-2xl border border-white/5 text-slate-350 hover:bg-white/5 text-xs font-bold transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/15 disabled:opacity-50 cursor-pointer"
              >
                {loading ? '...' : t.saveChanges}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
