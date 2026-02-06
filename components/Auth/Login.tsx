
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
      const users = await db.getUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.role === role);

      if (user) {
        onLogin(user);
      } else {
        setError('Authentication failed. Ensure you used the correct CMRIT email and password.');
      }
    } catch (err) {
      setError('Database connection error. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl mt-12 border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
           <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Welcome Back</h2>
        <p className="text-gray-400 text-sm font-bold mt-1 uppercase tracking-widest">HONESTA SECURE GATEWAY</p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-widest px-1">Institutional Email</label>
          <input
            type="email" required
            className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
            placeholder={role === UserRole.STUDENT ? 'rollno@cmrithyderabad.edu.in' : 'name@cmritonline.ac.in'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-widest px-1">Security Password</label>
          <input
            type="password" required
            className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-black border border-red-100 text-center animate-pulse">{error}</div>}

        <button
          type="submit"
          disabled={isAuthenticating}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
        >
          {isAuthenticating ? 'Syncing...' : 'Authorize Access'}
        </button>
      </form>
      
      <div className="mt-10 pt-6 border-t border-dashed text-center">
        <button onClick={onSwitchToRegister} className="text-indigo-600 hover:text-indigo-800 text-xs font-black uppercase tracking-widest">
          No Account? Join the Network
        </button>
      </div>
    </div>
  );
};

export default Login;
