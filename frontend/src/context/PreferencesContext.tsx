import React, { createContext, useContext, useState, useEffect } from 'react';

export type ChatTheme = 'dark' | 'neon' | 'emerald' | 'ocean';
export type ChatWallpaper = 'default' | 'cyber' | 'sunset' | 'midnight' | 'emerald';
export type AppLang = 'en' | 'ru';

export const translations = {
  en: {
    searchPlaceholder: "Search users... 🔎",
    activeChats: "Recent Chats",
    userDirectory: "User Directory",
    searchResults: "Search Results",
    showActiveChats: "Show Active Chats",
    showUserDirectory: "Show User Directory",
    noActiveChats: "No active chats 💬",
    browseDirectory: "Browse Directory ✨",
    startConversation: "Start Your Conversation",
    chooseDialog: "Choose an active dialog from the sidebar, search for contacts, or browse the directory to message friends.",
    editProfile: "Profile & Settings",
    settingsTitle: "Telegram Settings ⚙️",
    saveChanges: "Save Changes ✨",
    cancel: "Cancel",
    nickname: "Nickname",
    bio: "Biography (O себе)",
    avatarUrl: "Avatar Image URL",
    changePassword: "Change Password (optional)",
    leaveBlank: "Leave blank to keep current",
    presetAvatars: "Choose a Preset Avatar 🦄",
    statusActive: "Active 👋",
    online: "online",
    offline: "offline",
    lastSeen: "last seen",
    writing: "is writing",
    emptyHistory: "Start the conversation 👋",
    sayHello: "Say hello to make a connection!",
    editMsg: "Editing Message ✏️",
    save: "Save ✨",
    deleteMsg: "Delete message?",
    deleteConfirmText: "Do you want to delete this message just for you, or for both of you?",
    deleteForMe: "Delete for me",
    deleteForBoth: "Delete for both",
    savedMessages: "Saved Messages 📁",
    savedMessagesSub: "Your personal cloud notes",
    searchMessages: "Search messages...",
    noMatchingMsgs: "No matching messages 🔍",
    theme: "Chat Theme 🎨",
    themeDark: "Classic Dark 🌌",
    themeNeon: "Neon Violet 🦄",
    themeEmerald: "Emerald Obsidian 🍀",
    themeOcean: "Deep Ocean 🌊",
    notifications: "Sound Notifications 🔊",
    soundEnabled: "Enabled",
    soundDisabled: "Disabled",
    manualStatus: "Status Emojis 🎭",
    statusCoding: "Coding 💻",
    statusWorking: "Working 💼",
    statusCoffee: "Coffee Break ☕",
    statusGaming: "Gaming 🎮",
    statusRelaxing: "Relaxing 🍹",
    statusDND: "DND ⛔",
    statusNone: "No emoji status ❌",
    logout: "Logout",
    stats: "Usage Stats 📊",
    statsMessages: "Messages sent",
    statsReactions: "Reactions clicked",
    loginTitle: "Sign In",
    loginSubtitle: "Welcome back! Let's chat 👋",
    registerTitle: "Create Account",
    registerSubtitle: "Join Web Messenger today ✨",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    nicknameLabel: "Unique Nickname",
    signInBtn: "Sign In",
    signUpBtn: "Sign Up",
    newToApp: "New to Web Messenger?",
    alreadyHaveAccount: "Already have an account?",
    creatingAccount: "Creating account...",
    signingIn: "Signing in...",
    folderAll: "All",
    folderPersonal: "Personal",
    folderSaved: "Saved",
    folderOnline: "Online",
    pinChat: "Pin",
    unpinChat: "Unpin",
    voiceMessage: "Voice Message",
    recording: "Recording",
    callTitle: "Voice Call",
    calling: "Calling...",
    callActive: "Call Active",
    callEnded: "Call Ended",
    chatSettings: "Chat Settings ⚙️",
    wallpaper: "Chat Wallpaper 🖼️",
    wpDefault: "Default Space",
    wpCyber: "Cyber Grid",
    wpSunset: "Sunset Glow",
    wpMidnight: "Midnight Stars",
    wpEmerald: "Emerald Obsidian",
    stickers: "Stickers",
    emojis: "Emojis",
    forgotPasswordLink: "Forgot Password? 🔑",
    recoveryTitle: "Password Recovery",
    recoverySubtitle: "Reset your password securely",
    getRecoveryTokenBtn: "Get Reset Token",
    resetPasswordBtn: "Reset Password",
    resetTokenLabel: "Reset Token",
    newPasswordLabel: "New Password",
    confirmPasswordLabel: "Confirm New Password",
    backToLogin: "Back to Login",
    exportChat: "Export Chat",
    importChat: "Import Chat",
    exportTitle: "Export Chat History",
    importTitle: "Import Chat History",
    exportDesc: "Copy this base64 backup string to save your conversation:",
    importDesc: "Paste a base64 backup string to restore messages:",
    copySuccess: "Copied to clipboard! 📋",
    importSuccess: "Chat history successfully restored! 🎉",
    importError: "Failed to import: invalid data format ❌",
  },
  ru: {
    searchPlaceholder: "Поиск пользователей... 🔎",
    activeChats: "Недавние чаты",
    userDirectory: "Все пользователи",
    searchResults: "Результаты поиска",
    showActiveChats: "Показать активные чаты",
    showUserDirectory: "Показать список контактов",
    noActiveChats: "Нет активных чатов 💬",
    browseDirectory: "Открыть контакты ✨",
    startConversation: "Начните общение",
    chooseDialog: "Выберите диалог из списка слева, найдите собеседника в поиске или откройте контакты, чтобы написать привет.",
    editProfile: "Настройки профиля",
    settingsTitle: "Настройки Telegram ⚙️",
    saveChanges: "Сохранить изменения ✨",
    cancel: "Отмена",
    nickname: "Имя пользователя",
    bio: "О себе (биография)",
    avatarUrl: "Ссылка на изображение аватара",
    changePassword: "Сменить пароль (опционально)",
    leaveBlank: "Оставьте пустым, чтобы не менять",
    presetAvatars: "Выберите готовый аватар 🦄",
    statusActive: "В сети 👋",
    online: "в сети",
    offline: "не в сети",
    lastSeen: "был(а) в сети",
    writing: "пишет сообщение",
    emptyHistory: "Начните диалог 👋",
    sayHello: "Напишите привет, чтобы начать общение!",
    editMsg: "Редактирование сообщения ✏️",
    save: "Сохранить ✨",
    deleteMsg: "Удалить сообщение?",
    deleteConfirmText: "Вы действительно хотите удалить это сообщение для себя или для всех?",
    deleteForMe: "Удалить у себя",
    deleteForBoth: "Удалить у всех",
    savedMessages: "Избранное 📁",
    savedMessagesSub: "Ваше личное облако для заметок",
    searchMessages: "Поиск по сообщениям...",
    noMatchingMsgs: "Сообщения не найдены 🔍",
    theme: "Тема чата 🎨",
    themeDark: "Классический темный 🌌",
    themeNeon: "Неоновый фиолетовый 🦄",
    themeEmerald: "Изумрудный обсидиан 🍀",
    themeOcean: "Глубокий океан 🌊",
    notifications: "Звуковые уведомления 🔊",
    soundEnabled: "Включены",
    soundDisabled: "Выключены",
    manualStatus: "Статус-эмодзи 🎭",
    statusCoding: "Пишу код 💻",
    statusWorking: "Работаю 💼",
    statusCoffee: "Пью кофе ☕",
    statusGaming: "Играю 🎮",
    statusRelaxing: "Отдыхаю 🍹",
    statusDND: "Не беспокоить ⛔",
    statusNone: "Без эмодзи-статуса ❌",
    logout: "Выйти",
    stats: "Статистика использования 📊",
    statsMessages: "Отправлено сообщений",
    statsReactions: "Нажато реакций",
    loginTitle: "Вход в систему",
    loginSubtitle: "С возвращением! Давайте общаться 👋",
    registerTitle: "Регистрация",
    registerSubtitle: "Присоединяйтесь к мессенджеру ✨",
    emailLabel: "Электронная почта (Email)",
    passwordLabel: "Пароль",
    nicknameLabel: "Уникальный никнейм",
    signInBtn: "Войти",
    signUpBtn: "Зарегистрироваться",
    newToApp: "Впервые здесь?",
    alreadyHaveAccount: "Уже есть аккаунт?",
    creatingAccount: "Создание аккаунта...",
    signingIn: "Выполняется вход...",
    folderAll: "Все",
    folderPersonal: "Личные",
    folderSaved: "Избранное",
    folderOnline: "В сети",
    pinChat: "Закрепить",
    unpinChat: "Открепить",
    voiceMessage: "Голосовое сообщение",
    recording: "Запись",
    callTitle: "Голосовой звонок",
    calling: "Звонок...",
    callActive: "В эфире",
    callEnded: "Звонок завершен",
    chatSettings: "Настройки чатов ⚙️",
    wallpaper: "Обои чатов 🖼️",
    wpDefault: "Космический темный",
    wpCyber: "Кибер-сетка",
    wpSunset: "Закатный градиент",
    wpMidnight: "Звездная ночь",
    wpEmerald: "Изумрудная пыль",
    stickers: "Стикеры",
    emojis: "Эмодзи",
    forgotPasswordLink: "Забыли пароль? 🔑",
    recoveryTitle: "Восстановление пароля",
    recoverySubtitle: "Безопасный сброс вашего пароля",
    getRecoveryTokenBtn: "Получить токен сброса",
    resetPasswordBtn: "Сбросить пароль",
    resetTokenLabel: "Токен сброса",
    newPasswordLabel: "Новый пароль",
    confirmPasswordLabel: "Подтвердите новый пароль",
    backToLogin: "Вернуться ко входу",
    exportChat: "Экспорт чата",
    importChat: "Импорт чата",
    exportTitle: "Экспорт истории чата",
    importTitle: "Импорт истории чата",
    exportDesc: "Скопируйте эту base64-строку для сохранения чата:",
    importDesc: "Вставьте base64-строку бэкапа для восстановления сообщений:",
    copySuccess: "Скопировано в буфер обмена! 📋",
    importSuccess: "История чата успешно восстановлена! 🎉",
    importError: "Ошибка импорта: неверный формат данных ❌",
  }
};

interface PreferencesContextType {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  theme: ChatTheme;
  setTheme: (theme: ChatTheme) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  wallpaper: ChatWallpaper;
  setWallpaper: (wallpaper: ChatWallpaper) => void;
  t: typeof translations['en'];
  incrementStat: (statType: 'messages' | 'reactions') => void;
  getStat: (statType: 'messages' | 'reactions') => number;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLang>('ru'); // default to Russian
  const [theme, setThemeState] = useState<ChatTheme>('dark');
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const [wallpaper, setWallpaperState] = useState<ChatWallpaper>('default');

  useEffect(() => {
    const savedLang = localStorage.getItem('pref_lang') as AppLang;
    const savedTheme = localStorage.getItem('pref_theme') as ChatTheme;
    const savedSound = localStorage.getItem('pref_sound');
    const savedWallpaper = localStorage.getItem('pref_wallpaper') as ChatWallpaper;

    if (savedLang) setLangState(savedLang);
    if (savedTheme) {
      setThemeState(savedTheme);
      applyThemeClass(savedTheme);
    } else {
      applyThemeClass('dark');
    }
    if (savedSound !== null) setSoundEnabledState(savedSound === 'true');
    if (savedWallpaper) setWallpaperState(savedWallpaper);
  }, []);

  const applyThemeClass = (newTheme: ChatTheme) => {
    document.body.classList.remove('theme-dark', 'theme-neon', 'theme-emerald', 'theme-ocean');
    document.body.classList.add(`theme-${newTheme}`);
  };

  const setLang = (newLang: AppLang) => {
    localStorage.setItem('pref_lang', newLang);
    setLangState(newLang);
  };

  const setTheme = (newTheme: ChatTheme) => {
    localStorage.setItem('pref_theme', newTheme);
    setThemeState(newTheme);
    applyThemeClass(newTheme);
  };

  const setSoundEnabled = (enabled: boolean) => {
    localStorage.setItem('pref_sound', enabled ? 'true' : 'false');
    setSoundEnabledState(enabled);
  };

  const setWallpaper = (newWallpaper: ChatWallpaper) => {
    localStorage.setItem('pref_wallpaper', newWallpaper);
    setWallpaperState(newWallpaper);
  };

  const incrementStat = (statType: 'messages' | 'reactions') => {
    const key = `stat_${statType}`;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (current + 1).toString());
  };

  const getStat = (statType: 'messages' | 'reactions'): number => {
    const key = `stat_${statType}`;
    return parseInt(localStorage.getItem(key) || '0', 10);
  };

  const t = translations[lang];

  return (
    <PreferencesContext.Provider value={{
      lang,
      setLang,
      theme,
      setTheme,
      soundEnabled,
      setSoundEnabled,
      wallpaper,
      setWallpaper,
      t,
      incrementStat,
      getStat
    }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
