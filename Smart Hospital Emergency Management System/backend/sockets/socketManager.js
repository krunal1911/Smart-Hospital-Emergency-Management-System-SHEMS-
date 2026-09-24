import { Server } from 'socket.io';

let io;

export const getIO = () => io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for easy local connection
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // User joins a personal room for notifications
    socket.on('join', ({ userId, role }) => {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room user_${userId} (Role: ${role})`);
    });

    // Hospital joins its department room for booking alerts
    socket.on('join_hospital', ({ hospitalId }) => {
      socket.join(`hospital_${hospitalId}`);
      console.log(`Hospital ${hospitalId} joined room hospital_${hospitalId}`);
    });

    // Client (Patient, Hospital, Driver) joins active tracking stream room
    socket.on('join_emergency', ({ emergencyId }) => {
      socket.join(`emergency_${emergencyId}`);
      console.log(`Socket ${socket.id} joined tracking room: emergency_${emergencyId}`);
    });

    // Ambulance staff / hospital staff joins an EmergencyCase tracking room
    socket.on('join_emergency_case', ({ caseId }) => {
      socket.join(`case_${caseId}`);
      socket.join(`case:${caseId}`);
      console.log(`Socket ${socket.id} joined emergency case room: case_${caseId}`);
    });

    socket.on('join_case', ({ caseId }) => {
      socket.join(`case_${caseId}`);
      socket.join(`case:${caseId}`);
      console.log(`Socket ${socket.id} joined case room: case_${caseId}`);
    });

    socket.on('leave_emergency_case', ({ caseId }) => {
      socket.leave(`case_${caseId}`);
      socket.leave(`case:${caseId}`);
      console.log(`Socket left emergency case room: case_${caseId}`);
    });

    // Driver pushes GPS location, broadcast to patient and hospital
    socket.on('update_gps_location', ({ emergencyId, lat, lng, distance, eta, status }) => {
      socket.to(`emergency_${emergencyId}`).emit('gps_location_updated', {
        lat,
        lng,
        distance,
        eta,
        status,
      });
    });

    // Ride state updates
    socket.on('ride_status_changed', ({ emergencyId, status, eta, distance }) => {
      io.to(`emergency_${emergencyId}`).emit('ride_status_updated', {
        status,
        eta,
        distance,
      });
      console.log(`Emergency ${emergencyId} status transitioned to: ${status}`);
    });

    socket.on('leave_emergency', ({ emergencyId }) => {
      socket.leave(`emergency_${emergencyId}`);
      console.log(`Socket left tracking room: emergency_${emergencyId}`);
    });

    // Driver joins personal driver room for emergency broadcasts
    socket.on('join_driver', ({ driverId }) => {
      socket.join(`driver_${driverId}`);
      console.log(`Driver ${driverId} joined room driver_${driverId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Send real-time notification to a specific user
export const sendRealtimeNotification = (recipientId, notification) => {
  if (io) {
    io.to(`user_${recipientId}`).emit('notification', notification);
    console.log(`Sent realtime notification to user_${recipientId}`);
  }
};

// Send real-time booking alert to a hospital
export const emitToHospital = (hospitalId, event, data) => {
  if (io) {
    io.to(`hospital_${hospitalId}`).emit(event, data);
    console.log(`Sent alert (${event}) to hospital_${hospitalId}`);
  }
};

// Send real-time updates inside the emergency tracking room
export const emitToEmergencyRoom = (emergencyId, event, data) => {
  if (io) {
    io.to(`emergency_${emergencyId}`).emit(event, data);
    console.log(`Dispatched event (${event}) to emergency room ${emergencyId}`);
  }
};

// Send real-time updates inside an EmergencyCase tracking room
export const emitToEmergencyCaseRoom = (caseId, event, data) => {
  if (io) {
    io.to(`case_${caseId}`).emit(event, data);
    console.log(`Dispatched event (${event}) to emergency case room ${caseId}`);
  }
};

// Concurrent Multi-Driver Broadcast (Top 4 Nearest Drivers)
export const broadcastEmergencyToDrivers = (driverUserIds = [], dispatchData) => {
  if (!io || !driverUserIds.length) return;
  driverUserIds.forEach((driverId) => {
    io.to(`driver_${driverId}`).emit('new_emergency_dispatch_broadcast', dispatchData);
    io.to(`user_${driverId}`).emit('new_emergency_dispatch_broadcast', dispatchData);
    console.log(`Broadcasted emergency SOS ${dispatchData.caseNumber} to driver_${driverId}`);
  });
};

// First-Responder Acceptance Lock Notification (Dismisses popups on other candidate drivers)
export const notifyDriversCaseClaimed = (driverUserIds = [], claimingDriverUserId, claimingDriverName, vehicleNumber, caseNumber) => {
  if (!io || !driverUserIds.length) return;
  driverUserIds.forEach((driverId) => {
    if (String(driverId) !== String(claimingDriverUserId)) {
      io.to(`driver_${driverId}`).emit('case_claimed_by_other', {
        caseNumber,
        claimedByDriverName: claimingDriverName,
        vehicleNumber,
        message: `Case ${caseNumber} was accepted by ${claimingDriverName} (${vehicleNumber}). Returning to standby.`,
      });
      io.to(`user_${driverId}`).emit('case_claimed_by_other', {
        caseNumber,
        claimedByDriverName: claimingDriverName,
        vehicleNumber,
        message: `Case ${caseNumber} was accepted by ${claimingDriverName} (${vehicleNumber}). Returning to standby.`,
      });
    }
  });
};
