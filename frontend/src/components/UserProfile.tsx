import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Image, FileText, Lock, Check } from 'lucide-react';

interface UserProfileProps {
  onClose: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { user, token, updateUser } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname) {
      setError('Nickname is required 📛');
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
        throw new Error(data.error || 'Failed to update profile ❌');
      }

      updateUser(data.user);
      if (data.token) {
        localStorage.setItem('token', data.token); // update token in storage if nickname/payload modified jwt
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
      <div className="w-full max-w-lg bg-[#0e1220]/90 border border-white/5 rounded-[28px] shadow-2xl overflow-hidden relative backdrop-blur-xl animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 border-b border-white/5 bg-white/2">
          <h3 className="text-xl font-extrabold font-display text-white flex items-center gap-2">
            <span>Edit Profile</span>
            <span className="text-base">⚙️</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">Customize your public presence in Web Messenger</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs rounded-2xl flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 rounded-2xl animate-pulse">
              <Check className="w-4 h-4" /> Profile updated successfully! 🎉
            </div>
          )}

          {/* Profile Picture Preview */}
          <div className="flex items-center gap-4 bg-white/2 p-4 rounded-2xl border border-white/5 shadow-inner">
            <img
              src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={nickname}
              className="w-16 h-16 rounded-[20px] object-cover bg-slate-800 border border-white/10 shadow-lg shadow-black/30"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
              }}
            />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Avatar Preview</h4>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">Changes apply immediately on saving</p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              Nickname
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                className="w-full glass-input rounded-2xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none text-sm font-medium"
                placeholder="nickname"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              Avatar Image URL
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Image className="w-4 h-4" />
              </span>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full glass-input rounded-2xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-650 focus:outline-none text-sm font-medium"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              Bio
            </label>
            <div className="relative">
              <span className="absolute top-3 left-3.5 text-slate-500">
                <FileText className="w-4 h-4" />
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full glass-input rounded-2xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-650 focus:outline-none text-sm font-medium resize-none"
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              Change Password (optional)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input rounded-2xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-650 focus:outline-none text-sm font-medium"
                placeholder="Leave blank to keep current"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl border border-white/5 text-slate-350 hover:bg-white/5 text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/15 disabled:opacity-50"
            >
              {loading ? 'Saving... 🔄' : 'Save Changes ✨'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
