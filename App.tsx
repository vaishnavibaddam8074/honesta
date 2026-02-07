import React, { useState, useEffect } from 'react';
import { UserRole, User } from './types';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import Navbar from './components/Navbar';
import { db } from './services/db';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'dashboard'>('landing');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  useEffect(() => {
    // Warm up the database instantly
    db.init();

    const savedUser = localStorage.getItem('honesta_logged_in_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setView('dashboard');
    }
  }, []);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setView('login');
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('honesta_logged_in_user', JSON.stringify(user));
    setView('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('honesta_logged_in_user');
    setView('landing');
  };

  const goHome = () => {
    if (currentUser) setView('dashboard');
    else setView('landing');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12 flex flex-col">
      <Navbar user={currentUser} onLogout={handleLogout} onHome={goHome} />
      
      <main className="flex-grow transition-all duration-300">
        {view === 'landing' && (
          <Landing onSelectRole={handleSelectRole} />
        )}

        {view === 'login' && selectedRole && (
          <Login 
            role={selectedRole} 
            onLogin={handleLogin} 
            onSwitchToRegister={() => setView('register')} 
          />
        )}

        {view === 'register' && selectedRole && (
          <Register 
            role={selectedRole} 
            onRegister={handleLogin} 
            onSwitchToLogin={() => setView('login')} 
          />
        )}

        {view === 'dashboard' && currentUser && (
          <Dashboard user={currentUser} />
        )}
      </main>
      
      <footer className="py-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest opacity-50">
        <p>&copy; {new Date().getFullYear()} HONESTA - CMRIT Hyderabad. Proper Database Active.</p>
      </footer>
    </div>
  );
};

export default App;