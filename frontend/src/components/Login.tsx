import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { Mail, Lock } from 'lucide-react';
import { ParticleBackground } from './ParticleBackground';

interface LoginProps {
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const { t, lang, setLang } = usePreferences();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(lang === 'ru' ? 'Пожалуйста, заполните все поля 🔍' : 'Please fill in all fields 🔍');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || (lang === 'ru' ? 'Неверный логин или пароль ❌' : 'Login failed ❌'));
      }

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || (lang === 'ru' ? 'Что-то пошло не так ⚡' : 'Something went wrong ⚡'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#05060b] px-4 relative overflow-hidden">
      <ParticleBackground />

      {/* Floating Language Bar Selector */}
      <div className="absolute top-6 right-6 z-20 flex gap-1.5 bg-[#0e1220]/75 border border-white/5 p-1 rounded-xl backdrop-blur-md select-none">
        <button
          onClick={() => setLang('ru')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            lang === 'ru' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          RU
        </button>
        <button
          onClick={() => setLang('en')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            lang === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          EN
        </button>
      </div>

      {/* Dynamic Animated Background Circles */}
      <div className="absolute top-10 left-10 w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-indigo-600/10 to-violet-600/10 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute -bottom-20 -right-20 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-fuchsia-600/10 to-indigo-600/10 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />

      {/* Floating Glassmorphic Blobs */}
      <div className="absolute top-[20%] right-[15%] w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md animate-float" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-[20%] left-[10%] w-24 h-24 rounded-full bg-purple-500/5 border border-purple-500/15 backdrop-blur-md animate-float" style={{ animationDelay: '2s', animationDuration: '8s' }} />
      <div className="absolute top-[65%] right-[8%] w-12 h-12 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/10 backdrop-blur-md animate-float" style={{ animationDelay: '4s', animationDuration: '5s' }} />

      <div className="w-full max-w-[440px] glass-panel p-9 rounded-[32px] shadow-2xl relative z-10 border border-white/5 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-[22px] flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-white/10 mb-4 transform hover:rotate-12 transition-transform duration-300">
            <span className="text-3xl select-none">💬</span>
          </div>
          <h2 className="text-3xl font-extrabold font-display bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent tracking-tight text-center">
            {lang === 'ru' ? 'Web Мессенджер' : 'Web Messenger'}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-2 flex items-center gap-1.5">
            {t.loginSubtitle}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-2xl flex items-center gap-2 animate-pulse">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              {t.emailLabel}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass-input rounded-2xl py-3.5 pl-11 pr-4 text-slate-200 placeholder-slate-650 focus:outline-none text-sm font-medium"
                placeholder="hello@world.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input rounded-2xl py-3.5 pl-11 pr-4 text-slate-200 placeholder-slate-650 focus:outline-none text-sm font-medium"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full shimmer-button bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:brightness-110 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-xl shadow-indigo-650/20 transition-all disabled:opacity-50 disabled:pointer-events-none mt-4 text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>{t.signingIn}</span>
            ) : (
              <>
                <span>{t.signInBtn}</span>
                <span className="text-base">🚀</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500 border-t border-white/5 pt-6 font-medium">
          {t.newToApp}{' '}
          <button
            onClick={onNavigateToRegister}
            className="text-indigo-400 font-bold hover:underline hover:text-indigo-300 transition-colors ml-1 cursor-pointer"
          >
            {t.signUpBtn} ✨
          </button>
        </div>
      </div>
    </div>
  );
};
