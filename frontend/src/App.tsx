import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Dashboard } from './components/Dashboard';

function App() {
  const { token, loading } = useAuth();
  const [screen, setScreen] = useState<'login' | 'register'>('login');

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-semibold animate-pulse text-indigo-400">Loading Web Messenger...</span>
        </div>
      </div>
    );
  }

  if (!token) {
    if (screen === 'register') {
      return <Register onNavigateToLogin={() => setScreen('login')} />;
    }
    return <Login onNavigateToRegister={() => setScreen('register')} />;
  }

  return <Dashboard />;
}

export default App;
