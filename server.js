const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('클라이언트가 연결되었습니다.');

    socket.on('join', (roomId) => {
      socket.join(roomId);
      console.log(`클라이언트가 ${roomId} 방에 참여했습니다.`);
    });

    socket.on('message', (message) => {
      const roomId = Array.from(socket.rooms)[1]; // 첫 번째는 socket.id
      io.to(roomId).emit('message', message);
    });

    socket.on('disconnect', () => {
      console.log('클라이언트가 연결을 종료했습니다.');
    });
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});