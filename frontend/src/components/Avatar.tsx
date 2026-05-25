import React from 'react';

interface AvatarProps {
  url: string | null | undefined;
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

interface PresetAvatar {
  emoji: string;
  gradient: string;
}

export const PRESET_AVATARS: Record<string, PresetAvatar> = {
  'avatar:unicorn': { emoji: '🦄', gradient: 'from-pink-500 to-indigo-500' },
  'avatar:fox': { emoji: '🦊', gradient: 'from-amber-500 to-red-500' },
  'avatar:octopus': { emoji: '🐙', gradient: 'from-cyan-500 to-blue-600' },
  'avatar:lion': { emoji: '🦁', gradient: 'from-yellow-400 to-amber-600' },
  'avatar:dragon': { emoji: '🐉', gradient: 'from-emerald-400 to-teal-700' },
  'avatar:panda': { emoji: '🐼', gradient: 'from-slate-600 to-slate-800' },
  'avatar:koala': { emoji: '🐨', gradient: 'from-zinc-400 to-zinc-650' },
  'avatar:alien': { emoji: '👽', gradient: 'from-purple-900 to-fuchsia-800' },
  'avatar:robot': { emoji: '🤖', gradient: 'from-slate-400 to-indigo-950' },
  'avatar:wizard': { emoji: '🧙', gradient: 'from-purple-800 to-indigo-900' },
  'avatar:saved': { emoji: '📁', gradient: 'from-indigo-600 to-blue-500' },
};

export const Avatar: React.FC<AvatarProps> = ({ 
  url, 
  name, 
  className = '', 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl text-sm',
    md: 'w-10 h-10 rounded-xl text-base',
    lg: 'w-11 h-11 rounded-2xl text-lg',
    xl: 'w-16 h-16 rounded-[20px] text-2xl',
  };

  const isPreset = url && url.startsWith('avatar:');
  const preset = isPreset ? PRESET_AVATARS[url as string] : null;

  if (preset) {
    return (
      <div 
        className={`flex items-center justify-center bg-gradient-to-tr ${preset.gradient} select-none border border-white/10 shadow-lg text-white ${sizeClasses[size]} ${className}`}
        title={name}
      >
        <span className="transform hover:scale-115 transition-transform duration-200">{preset.emoji}</span>
      </div>
    );
  }

  // Fallback avatar if url is empty
  const defaultUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
  const imgUrl = url || defaultUrl;

  return (
    <img
      src={imgUrl}
      alt={name}
      className={`object-cover bg-slate-800 border border-white/10 shadow-md ${sizeClasses[size]} ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = defaultUrl;
      }}
    />
  );
};
