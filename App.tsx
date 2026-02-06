
import React, { useState, useEffect } from 'react';
import { UserRole, User } from './types';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'dashboard'>('landing');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  useEffect(() => {
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
    <div className="min-h-screen bg-gray-50 pb-12">
      <Navbar user={currentUser} onLogout={handleLogout} onHome={goHome} />
      
      <main className="transition-all duration-300">
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
      
      {/* Footer Branding */}
      <footer className="mt-auto py-8 text-center text-gray-400 text-sm">
        <p>&copy; {new Date().getFullYear()} HONESTA - CMRIT Hyderabad. Built for Trust.</p>
      </footer>
    </div>
  );
};

export default App;
