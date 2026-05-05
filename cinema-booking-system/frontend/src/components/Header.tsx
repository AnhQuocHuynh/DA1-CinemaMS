import React from 'react';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  return (
    <nav className="fixed top-0 w-full z-50 glass-header shadow-sm h-16 flex justify-between items-center px-8 transition-all duration-200 ease-in-out bg-white/80 backdrop-blur-md">
      <div className="flex items-center gap-8">
        <span className="text-xl font-bold tracking-tighter text-slate-900">CinemaArchitect</span>
        <div className="hidden md:flex space-x-6">
          <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
            Movies
          </a>
          <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
            Events
          </a>
          <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
            Theaters
          </a>
          <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
            Support
          </a>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-slate-600 font-medium text-sm hover:bg-slate-100/50 px-3 py-2 rounded-md transition-all active:scale-95">
          Sign In
        </button>
        <button className="bg-primary text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95 hover:bg-blue-700">
          Book Now
        </button>
      </div>
    </nav>
  );
};
