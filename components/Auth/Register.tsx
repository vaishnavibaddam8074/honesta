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
    const email = formData.email.toLowerCase();
    if (role === UserRole.STUDENT) {
      return /^[0-9a-z]+@cmrithyderabad\.edu\.in$/.test(email);
    } else {
      return /^[a-zA-Z0-9._%+-]+@cmritonline\.ac\.in$/.test(email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateEmail()) {
      setError(`Only ${role === UserRole.STUDENT ? 'Student (@cmrithyderabad.edu.in)' : 'Faculty (@cmritonline.ac.in)'} emails allowed.`);
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
        email: formData.email.toLowerCase(),
        password: formData.emailPassword, 
        role
      };

      const existingUsers = await db.getUsers();
      if (existingUsers.some(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
        setError('Email already exists on the HONESTA network.');
        return;
      }

      // Sync to cloud and WAIT for confirmation
      await db.saveUser(newUser);
      
      // Final verification check
      const verifyUsers = await db.getUsers();
      if (verifyUsers.some(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
        onRegister(newUser);
      } else {
        throw new Error("Cloud verification failed. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || 'Connection failure. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl mt-12 border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Join Network</h2>
        <p className="text-gray-400 text-xs font-bold mt-1 uppercase tracking-widest">Global CMRIT Database Registration</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest px-1">Official Full Name</label>
          <input
            type="text" required
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold"
            placeholder="Official Name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest px-1">Mobile Contact</label>
          <input
            type="tel" required pattern="[0-9]{10}"
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold"
            placeholder="10-digit phone"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g,'') })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest px-1">Institutional Email</label>
          <input
            type="email" required
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold"
            placeholder=""
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest px-1">Create Access Password</label>
          <input
            type="password" required
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold"
            placeholder="••••••••"
            value={formData.emailPassword}
            onChange={(e) => setFormData({ ...formData, emailPassword: e.target.value })}
          />
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-black border border-red-100 text-center">{error}</div>}

        <button
          type="submit"
          disabled={isRegistering}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
        >
          {isRegistering ? 'Syncing to Cloud...' : 'Register & Sync'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-dashed text-center">
        <button onClick={onSwitchToLogin} className="text-indigo-600 hover:text-indigo-800 text-xs font-black uppercase tracking-widest">
          Sign In Instead
        </button>
      </div>
    </div>
  );
};

export default Register;