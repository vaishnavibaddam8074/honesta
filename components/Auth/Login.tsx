import React, { useState } from 'react';
import { UserRole, User } from '../../types';
import { db } from '../../services/db';

interface LoginProps {
  role: UserRole;
  onLogin: (user: User) => void;
  onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ role, onLogin, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAuthenticating(true);

    try {
      // Force a fresh fetch to ensure login data is current
      const users = await db.getUsers();
      const cleanEmail = email.toLowerCase().trim();
      const user = users.find(u => 
        u.email.toLowerCase().trim() === cleanEmail && 
        u.password === password && 
        u.role === role
      );

      if (user) {
        onLogin(user);
      } else {
        setError('Verification failed. Invalid institutional credentials.');
      }
    } catch (err) {
      setError('Network sync failure. Please check connection.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-10 rounded-[3rem] shadow-2xl mt-12 border border-gray-100 animate-in fade-in slide-in-from-bottom-8">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
           <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">CMRIT Access</h2>
        <p className="text-gray-400 text-[10px] font-black mt-2 uppercase tracking-widest leading-none">Honesta Secure Login</p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest px-2">Official Email</label>
          <input
            type="email" required
            className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-lg"
            placeholder="name@cmrit..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest px-2">Key Password</label>
          <input
            type="password" required
            className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-lg"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-5 rounded-2xl text-[10px] font-black border border-red-100 text-center uppercase tracking-widest animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isAuthenticating}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-[1.5rem] shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-tighter text-xl"
        >
          {isAuthenticating ? 'Syncing Network...' : 'Authorize Login'}
        </button>
      </form>
      
      <div className="mt-12 pt-8 border-t border-dashed border-gray-100 text-center">
        <button onClick={onSwitchToRegister} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase tracking-widest">
          New User? Join The Campus Network
        </button>
      </div>
    </div>
  );
};

export default Login;