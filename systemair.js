require('dotenv').config();

const { log } = require("./utils")
const { initialize } = require("./systemair-mqtt-client")
const { updateRegisters, updateDevice } = require("./systemair-service")

const http = require("http");

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

server.listen(3000, () => {
  initialize(updateDevice)
  setInterval(updateRegisters, 60000);
  log('Server running on port 3000');
});
