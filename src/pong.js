import { Paddle } from "./paddle.js";
import { Ball } from "./ball.js";
import { Text } from "./text.js";

export function Pong(canvas, isHost, remoteIP, PORT = 12345) {
  console.log("Welcome to PONG!", {
    isHost,
    remoteIP,
    PORT,
  });
  let network = null;
  let ball = undefined;
  let text = undefined;
  const ctx = canvas.getContext("2d");

  let lastTime = Date.now() / 1000.0;
  let playersConnected = 0;
  let gameStarted = false;

  function sendPaddleControl(isMoving, isUp) {
    if (!network) return;
    network.send({
      type: "paddle_control",
      isMoving: isMoving,
      isUp: isUp,
    });
  }

  // Left paddle
  const paddleLeft = new Paddle({
    ctx,
    down: "s",
    up: "z",
    height: canvas.height,
    onMove: (isMoving, isUp) => {
      if (!isHost) return; // Only host controls left paddle
      sendPaddleControl(isMoving, isUp);
    },
  });
  paddleLeft.position[0] = 0;

  // Right paddle
  const paddleRight = new Paddle({
    ctx,
    down: "ArrowDown",
    up: "ArrowUp",
    height: canvas.height,
    onMove: (isMoving, isUp) => {
      if (isHost) return; // Only client controls right paddle
      sendPaddleControl(isMoving, isUp);
    },
  });
  paddleRight.position[0] = 580;

  function initNetwork() {
    network = window.gameNetwork.createNetworking(isHost, remoteIP, PORT, PORT);

    network.onReceive((data) => {
      if (data.type === "join_request") {
        console.log("Client connected!");
        playersConnected++;
        network.send({ type: "join_ack" });
        if (playersConnected === 1) {
          startGame();
        }
      } else if (data.type === "join_ack") {
        console.log("Connected to host!");
        playersConnected++;
        startGame();
      } else if (!gameStarted) {
        return; // Ignore game updates until properly started
      } else if (data.type === "paddle_control") {
        // Handle paddle movement with binary protocol
        if (isHost) {
          // Host updates right paddle based on client input
          paddleRight.speed = data.isMoving ? (data.isUp ? -250 : 250) : 0;
        } else {
          // Client updates left paddle based on host input
          paddleLeft.speed = data.isMoving ? (data.isUp ? -250 : 250) : 0;
        }
      } else {
        // Handle ball position updates (host to client only)
        if (!isHost && data.ballPos && ball) {
          ball.position = data.ballPos;
        }
      }
    });

    if (isHost) {
      console.log("Waiting for client to connect...");
    } else {
      console.log("Requesting to join game...");
      network.send({ type: "join_request" });
    }
  }

  // Send game state (only ball position from host to client)
  function sendGameState() {
    if (!network || !gameStarted || !isHost || !ball) return;

    network.send({
      type: "game_state",
      ballPos: ball.position,
    });
  }

  // ... createBall, endGame functions remain unchanged ...

  function startGame() {
    if (gameStarted) return;
    console.log("Starting the game!");
    gameStarted = true;

    if (isHost) {
      createBall();
    }

    requestAnimationFrame(loop);
  }

  function loop() {
    const time = Date.now() / 1000.0;
    let delta = time - lastTime;
    lastTime = time;

    // Update paddles based on local controls
    if (isHost) {
      paddleLeft.update(delta);
      if (ball) {
        ball.update(delta);
      }
    } else {
      paddleRight.update(delta);
    }

    if (text) {
      text.update(delta);
    }

    // Send only necessary updates
    if (isHost) {
      sendGameState(); // Only host sends ball position
    }

    // Draw everything
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paddleLeft.draw();
    paddleRight.draw();
    if (ball) {
      ball.draw();
    }
    if (text) {
      text.draw();
    }

    requestAnimationFrame(loop);
  }

  initNetwork();
}
