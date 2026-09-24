import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Bell, Sun, Moon, LogOut, User, Activity, Check } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { notifications, removeNotification, markAsRead } = useSocket();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (document.documentElement.classList.contains('dark')) return 'dark';
    return 'light';
  });

  const toggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Branding */}
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary-600 animate-pulse dark:text-primary-400" />
          <span className="font-sans text-xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent dark:from-primary-400 dark:to-indigo-400">
            SHEMS Dashboard
          </span>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          {/* Notifications Center */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emergency-600 text-[10px] font-medium text-white ring-2 ring-white dark:ring-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-slate-50 px-4 py-2 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Live Notifications</h3>
                  <span className="text-xs text-slate-400">{notifications.length} total</span>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">No recent notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={`group relative flex flex-col gap-1 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                          !notif.read ? 'bg-primary-50/50 dark:bg-primary-950/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className={`text-sm font-semibold ${
                            notif.type === 'emergency' 
                              ? 'text-emergency-600 dark:text-emergency-500' 
                              : 'text-slate-800 dark:text-slate-200'
                          }`}>
                            {notif.title}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notif.id);
                            }}
                            className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            Dismiss
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{notif.message}</p>
                        <span className="text-[10px] text-slate-400">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Summary */}
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-slate-800">
            <div className="flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.name}</span>
              <span className="text-xs capitalize text-slate-400 font-medium">{user?.role}</span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emergency-600 dark:hover:bg-slate-800"
              title="Log Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
export default Navbar;
