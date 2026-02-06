
import React from 'react';
import { UserRole } from '../types';

interface LandingProps {
  onSelectRole: (role: UserRole) => void;
}

const Landing: React.FC<LandingProps> = ({ onSelectRole }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-indigo-900 mb-4">HONESTA</h1>
        <p className="text-lg text-gray-600">Secure Lost & Found for CMRIT Community</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        <button
          onClick={() => onSelectRole(UserRole.STUDENT)}
          className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition border-2 border-transparent hover:border-indigo-500"
        >
          <div className="w-16 h-16 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4.465-7.167L12 9.5l4.465-2.667L12 4.167 7.535 6.833z"/></svg>
          </div>
          <span className="text-xl font-bold text-gray-800">I am a Student</span>
          <p className="text-sm text-gray-500 mt-2 text-center">Login with Roll No & Email</p>
        </button>

        <button
          onClick={() => onSelectRole(UserRole.FACULTY)}
          className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition border-2 border-transparent hover:border-indigo-500"
        >
          <div className="w-16 h-16 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <span className="text-xl font-bold text-gray-800">I am Faculty</span>
          <p className="text-sm text-gray-500 mt-2 text-center">Login with Institutional Email</p>
        </button>
      </div>
    </div>
  );
};

export default Landing;
