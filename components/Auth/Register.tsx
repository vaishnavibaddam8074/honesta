
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
      setError(`Only ${role === UserRole.STUDENT ? 'CMRIT Student (@cmrithyderabad.edu.in)' : 'CMRIT Faculty (@cmritonline.ac.in)'} emails are allowed.`);
      return;
    }

    if (formData.phoneNumber.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
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
      if (existingUsers.some(u => u.email === newUser.email)) {
        setError('This email is already registered on the HONESTA network.');
        return;
      }

      await db.saveUser(newUser);
      onRegister(newUser);
    } catch (err) {
      setError('Connection failure. Try again later.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl mt-12 border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Join Honesta</h2>
        <p className="text-gray-400 text-xs font-bold mt-1 uppercase tracking-widest">Global CMRIT Database Registration</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest px-1">Full Name</label>
          <input
            type="text" required
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
            placeholder="Official Name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest px-1">Mobile Number (Accountability)</label>
          <input
            type="tel" required pattern="[0-9]{10}"
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
            placeholder="10-digit phone"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g,'') })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest px-1">Institutional Email</label>
          <input
            type="email" required
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
            placeholder="hallticket@cmrithyderabad.edu.in"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest px-1">Create Access Password</label>
          <input
            type="password" required
            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
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
          {isRegistering ? 'Creating Account...' : 'Register & Sync'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-dashed text-center">
        <button onClick={onSwitchToLogin} className="text-indigo-600 hover:text-indigo-800 text-xs font-black uppercase tracking-widest">
          Already a Member? Sign In
        </button>
      </div>
    </div>
  );
};

export default Register;
