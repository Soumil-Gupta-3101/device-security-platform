const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

const EVENTS = {
  DEVICE_UPDATED: 'device:updated',
  ALERT_CREATED: 'alert:created',
  ALERT_UPDATED: 'alert:updated',
  EVENT_CREATED: 'event:created',
};

const initSocket = (httpServer) => {
  const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      return next(new Error('not authorized, no token'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      return next(new Error('not authorized, invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id} (User: ${socket.user?.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`Socket client disconnected: ${socket.id} (User: ${socket.user?.id}) - ${reason}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocket(httpServer) first.');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO,
  EVENTS,
};
