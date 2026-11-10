require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./sockets');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

const startServer = async () => {
  try {
    // Connect to database before listening for requests
    await connectDB();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
