import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'info', onClose, duration = 4500 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const getStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-success-500/10 border-success-500/20 text-success-600 dark:text-success-400';
      case 'error':
        return 'bg-emergency-500/10 border-emergency-500/20 text-emergency-600 dark:text-emergency-500';
      case 'info':
      default:
        return 'bg-primary-500/10 border-primary-500/20 text-primary-600 dark:text-primary-400';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-success-600 dark:text-success-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-emergency-600 dark:text-emergency-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
    }
  };

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 glass ${getStyle()}`}>
      {getIcon()}
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
export default Toast;
