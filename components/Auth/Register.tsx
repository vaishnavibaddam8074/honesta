import React, { useState } from 'react';
import { UserRole, User } from '../../types';
import { db } from '../../services/db';

interface RegisterProps {
  role: UserRole;
  onRegister: (user: User) => void;
  onSwitchToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ role, onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    emailPassword: ''
  });
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const validateEmail = () => {
    const email = formData.email.toLowerCase().trim();
    if (role === UserRole.STUDENT) {
      return /^[0-9a-z.]+@cmrithyderabad\.edu\.in$/.test(email);
    } else {
      return /^[a-zA-Z0-9._%+-]+@cmritonline\.ac\.in$/.test(email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateEmail()) {
      setError(`Invalid. Use ${role === UserRole.STUDENT ? '@cmrithyderabad.edu.in' : '@cmritonline.ac.in'}`);
      return;
    }

    if (formData.phoneNumber.length < 10) {
      setError("Enter 10-digit mobile number.");
      return;
    }

    setIsRegistering(true);
    try {
      const newUser: User = {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        id: formData.email.split('@')[0].toUpperCase(),
        email: formData.email.toLowerCase().trim(),
        password: formData.emailPassword, 
        role
      };

      const existingUsers = await db.getUsers();
      if (existingUsers.some(u => u.email.toLowerCase().trim() === newUser.email)) {
        setError('This email is already registered.');
        setIsRegistering(false);
        return;
      }

      // Sync to cloud and WAIT for confirmation before moving to dashboard
      await db.saveUser(newUser);
      onRegister(newUser);
    } catch (err: any) {
      setError('Registration sync failed. Check your network.');
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-10 rounded-[3rem] shadow-2xl mt-12 border border-gray-100 animate-in fade-in slide-in-from-bottom-8">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Join Honesta</h2>
        <p className="text-gray-400 text-[10px] font-black mt-2 uppercase tracking-widest leading-none">Global CMRIT Database Registration</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest px-2">Official Full Name</label>
          <input
            type="text" required
            className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-lg"
            placeholder="Official Name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest px-2">Mobile Contact</label>
          <input
            type="tel" required pattern="[0-9]{10}"
            className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-lg"
            placeholder="10-digit phone"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g,'') })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest px-2">Institutional Email</label>
          <input
            type="email" required
            className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-lg"
            placeholder="name@cmrit..."
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest px-2">Access Password</label>
          <input
            type="password" required
            className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-lg"
            placeholder="••••••••"
            value={formData.emailPassword}
            onChange={(e) => setFormData({ ...formData, emailPassword: e.target.value })}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-5 rounded-2xl text-[10px] font-black border border-red-100 text-center uppercase tracking-widest">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isRegistering}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-[1.5rem] shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-tighter text-xl"
        >
          {isRegistering ? 'Syncing to Cloud...' : 'Register & Join'}
        </button>
      </form>

      <div className="mt-12 pt-8 border-t border-dashed border-gray-100 text-center">
        <button onClick={onSwitchToLogin} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase tracking-widest">
          Already a Member? Sign In
        </button>
      </div>
    </div>
  );
};

export default Register;