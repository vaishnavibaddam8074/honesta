
import React from 'react';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onHome: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onHome }) => {
  return (
    <nav className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center cursor-pointer" onClick={onHome}>
            <span className="text-2xl font-bold tracking-wider">HONESTA</span>
            <span className="ml-2 px-2 py-0.5 bg-white text-indigo-700 rounded text-xs font-bold uppercase">CMRIT</span>
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="hidden sm:inline-block text-sm opacity-90">Hi, {user.fullName}</span>
              <button
                onClick={onLogout}
                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-md text-sm font-medium transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
