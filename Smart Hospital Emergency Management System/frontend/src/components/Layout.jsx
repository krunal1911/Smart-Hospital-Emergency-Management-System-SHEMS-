import React from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Navbar />
      <div className="flex">
        {/* Responsive Desktop Sidebar */}
        <Sidebar />
        
        {/* Main Content Area */}
        <main className="flex-1 px-4 py-6 md:pl-72 md:pr-6 max-w-[1600px] mx-auto w-full min-h-[calc(100vh-64px)]">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
export default Layout;
