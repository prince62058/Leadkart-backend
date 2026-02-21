require("dotenv").config();
const http = require("http");
const app = require("./app");
const dbConfig = require("./config/dbConfig");
const { defaultResponseMessage } = require("./Message/defaultMessage");

const PORT = process.env.PORT || 9898;


// Connect to the database
dbConfig.connect();
// Create the HTTP server
const server = http.createServer(app);

// Start the server
server.listen(PORT, () => {
  console.log(defaultResponseMessage?.PORT, PORT);
});

server.setTimeout(10 * 60 * 1000);