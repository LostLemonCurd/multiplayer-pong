import { Paddle } from "./paddle.js";
import { Ball } from "./ball.js";
import { Text } from "./text.js";

export function Pong(
  canvas,
  isHost,
  remoteIP,
  localPort = 12345,
  remotePort = 12345
) {
  console.log("Welcome to PONG!", {
    isHost,
    remoteIP,
    localPort,
    remotePort,
  });
  let network = null;
  let ball = undefined;
  let text = undefined;
  const ctx = canvas.getContext("2d");

  let lastTime = Date.now() / 1000.0;

  // Left paddle
  const paddleLeft = new Paddle({
    ctx,
    down: "s",
    up: "z",
    height: canvas.height,
  });
  paddleLeft.position[0] = 0;

  // Right paddle
  const paddleRight = new Paddle({
    ctx,
    down: "ArrowDown",
    up: "ArrowUp",
    height: canvas.height,
  });
  paddleRight.position[0] = 580;

  let playersConnected = 0; // Track connections
  let gameStarted = false;
  let roundEnded = false;

  function initNetwork() {
    network = window.gameNetwork.createNetworking(
      isHost,
      remoteIP,
      localPort,
      remotePort
    );
    network.onReceive((data) => {
      // console.log('data.gameEnd', data.gameEnd);
      // console.log('gameStarted', gameStarted);
      // console.log('roundEnded', roundEnded);

      if (data.type === "join_request") {
        playersConnected++;
        network.send({ type: "join_ack" });
        if (playersConnected === 1) {
          startGame();
        }
      } else if (data.type === "join_ack") {
        console.log("Connected to host!");
        playersConnected++;
        // Initialize ball for client before game starts
        if (!isHost) {
          bothPlayersReady = true;
          createBall();
          network.send({ type: "client_ready" });
        }

        startGame();
      } else if (data.type === "client_ready" && isHost) {
        console.log("Client is ready!");
        bothPlayersReady = true;
        onBothPlayersReady(); // Créer la balle seulement à ce moment
      } else if (!gameStarted) {
        return; // Ignore game updates until properly started
      } else if (isHost) {
        // Host receives right paddle position from client
        paddleRight.position[1] = data.paddleY;
      } else if (!isHost && data.newRound && gameStarted) {
        // Le client crée une nouvelle balle lors d'une nouvelle manche
        text = undefined;
        roundEnded = false; // Réinitialiser l'état de fin de manche
        createBall();
      } else {
        // Client receives ball and left paddle positions from host
        if (data.ballPos && ball) {
          ball.position = data.ballPos;
        }
        paddleLeft.position[1] = data.paddleY;
        // Client reçoit l'information de fin de jeu
        if (data.gameEnd && gameStarted && !roundEnded) {
          ball = undefined;
          roundEnded = true; // Marquer la manche comme terminée côté client aussi
          text = new Text({
            ctx,
            text: "Gagnant: " + (data.winner === "left" ? "Gauche" : "Droit"),
          });
          text.position = [canvas.width / 2.0, canvas.height / 2.0];
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

  // Send game state
  function sendGameState() {
    if (!network) return;

    if (isHost) {
      const data = {
        ballPos: ball ? ball.position : null,
        paddleY: paddleLeft.position[1],
      };
      // console.log("Host sending:", data);
      network.send(data);
    } else {
      const data = {
        paddleY: paddleRight.position[1],
      };
      // console.log("Client sending:", data);
      network.send(data);
    }
  }

  // Create the ball
  function createBall() {
    ball = new Ball({
      ctx,
      width: canvas.width,
      height: canvas.height,
      leftPaddle: paddleLeft,
      rightPaddle: paddleRight,
      onEscape: (result) => {
        if (ball && gameStarted && !roundEnded) {
          ball = undefined;
          text = new Text({
            ctx,
            text: "Gagnant: " + (result.winner === "left" ? "Gauche" : "Droit"),
          });
          text.position = [canvas.width / 2.0, canvas.height / 2.0];
          // Si c'est l'hôte, il envoie l'information de fin de jeu au client
          if (isHost && network) {
            network.send({
              gameEnd: true,
              winner: result.winner,
            });
          }
          endGame();
        }
      },
    });
    ball.position = [canvas.width / 2.0, canvas.height / 2.0];
  }

  let bothPlayersReady = false;

  // Dans pong.js, modifier la fonction startGame:
  function startGame() {
    console.log("playersConnected", playersConnected);

    if (gameStarted) return; // Prevent multiple starts
    console.log("Starting the game!");
    gameStarted = true;

    // Ne pas créer la balle immédiatement
    requestAnimationFrame(loop);
  }

  // Ajouter un déclenchement séparé pour la création de balle
  function onBothPlayersReady() {
    if (!isHost || ball) return; // Seulement l'hôte et une seule fois

    console.log("Both players ready, creating ball!");
    createBall();
  }

  function endGame() {
    if (!gameStarted) return; // Ne pas terminer un jeu qui n'a pas commencé

    setTimeout(() => {
      text = undefined;
      roundEnded = false;
      if (isHost) {
        createBall();
        // Informer le client qu'une nouvelle manche commence
        if (network && gameStarted) {
          network.send({ newRound: true });
        }
      }
    }, 3000);
  }

  // The animation loop
  function loop() {
    const time = Date.now() / 1000.0;
    let delta = time - lastTime;
    lastTime = time;

    if (isHost) {
      paddleLeft.update(delta);
      // Ne mettre à jour la balle que si les deux joueurs sont prêts
      if (ball && bothPlayersReady) {
        ball.update(delta);
      }
    } else {
      paddleRight.update(delta);
    }

    if (text) {
      text.update(delta);
    }

    sendGameState();

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
