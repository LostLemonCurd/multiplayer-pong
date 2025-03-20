const dgram = require("dgram");
const { contextBridge } = require("electron");

// Create UDP networking interface
const createNetworking = (isHost, remoteIP, localPort, remotePort) => {
  const socket = dgram.createSocket("udp4");

  socket.on("error", (err) => {
    console.error(`Socket error:\n${err.stack}`);
  });

  // Ensure the socket is properly bound
  socket.bind(localPort, () => {
    console.log(`Socket bound to port ${localPort}`);
  });

  return {
    send: (data) => {
      const message = Buffer.from(JSON.stringify(data));
      socket.send(message, 0, message.length, remotePort, remoteIP, (err) => {
        if (err) console.error(`Error sending UDP packet: ${err.message}`);
      });
    },
    onReceive: (callback) => {
      socket.on("message", (msg, rinfo) => {
        // Optional: filter messages only from the expected remote IP
        if (rinfo.address === remoteIP) {
          const data = JSON.parse(msg.toString());
          callback(data);
        }
      });
    },
  };
};

// Expose to renderer process
contextBridge.exposeInMainWorld("gameNetwork", {
  createNetworking,
});
