const dgram = require("dgram");
const { contextBridge } = require("electron");

// Create UDP networking interface
const createNetworking = (isHost, remoteIP, localPort, remotePort) => {
  const socket = dgram.createSocket("udp4");

  socket.on("error", (err) => {
    console.error(`Socket error:\n${err.stack}`);
  });

  socket.bind(localPort, () => {
    console.log(`Socket bound to port ${localPort}`);
  });

  const sendControlPacket = (isMoving, direction) => {
    const buffer = Buffer.alloc(2);
    buffer[0] = isMoving ? 1 : 0;
    buffer[1] = direction ? 1 : 0; // 1 for up, 0 for down
    socket.send(buffer, 0, buffer.length, remotePort, remoteIP);
  };

  const sendGameState = (data) => {
    // Use regular JSON for non-paddle data (ball position, game events)
    const message = Buffer.from(JSON.stringify(data));
    socket.send(message, 0, message.length, remotePort, remoteIP);
  };

  return {
    send: (data) => {
      // Check if this is a paddle control message
      if (data.type === "paddle_control") {
        sendControlPacket(data.isMoving, data.isUp);
      } else {
        sendGameState(data);
      }
    },
    onReceive: (callback) => {
      socket.on("message", (msg, rinfo) => {
        if (rinfo.address !== remoteIP) return;

        // Check if this is a control packet (2 bytes)
        if (msg.length === 2) {
          callback({
            type: "paddle_control",
            isMoving: msg[0] === 1,
            isUp: msg[1] === 1,
          });
        } else {
          // Regular game state packet
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
