import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let newSocket;

    if (user) {
      // Connect to Socket.IO server (through Vite reverse proxy)
      newSocket = io(window.location.origin, {
        transports: ['websocket'],
      });

      newSocket.on('connect', () => {
        console.log('Socket.IO connection established.');
        
        // Use _id (MongoDB) or id — whichever exists
        const userId = user._id || user.id;
        
        // Register user into their personal room
        newSocket.emit('join', { userId, role: user.role });

        // If user is a hospital, join the hospital room as well
        if (user.role === 'hospital') {
          newSocket.emit('join_hospital', { hospitalId: userId });
        }

        // If user is a driver, join the driver room for real-time SOS broadcasts
        if (user.role === 'driver') {
          newSocket.emit('join_driver', { driverId: userId });
        }

        console.log(`[Socket] Joined rooms as user_${userId} (role: ${user.role})`);
      });

      // Listen for incoming notifications
      newSocket.on('notification', (notif) => {
        console.log('Realtime notification received:', notif);
        
        // Play notification sound
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
          audio.volume = 0.5;
          audio.play();
        } catch (e) {
          // Ignore audio play block policy
        }

        // Add to active notifications stack
        setNotifications((prev) => [
          {
            id: Math.random().toString(),
            title: notif.title,
            message: notif.message,
            type: notif.type || 'system',
            timestamp: new Date(),
            read: false,
          },
          ...prev,
        ]);
      });

      setSocket(newSocket);
    } else {
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
      setNotifications([]);
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [user]);

  // Actions
  const clearNotifications = () => setNotifications([]);
  
  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        notifications,
        clearNotifications,
        markAsRead,
        removeNotification,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
export default SocketContext;
