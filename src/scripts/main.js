const vivagraph = require('./vivagraph');

const App = (function () {
  const callbackFunction = (tx) => {
    console.log(tx);
  };

  return {
    callbackFunction,
  };
}());

const SocketUtils = (function () {
  const socket = new WebSocket('wss://ws.blockchain.info/inv');

  const startSocket = (callback) => {
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ op: 'unconfirmed_sub' }));
    });
    socket.onmessage = (event) => {
      const tx = JSON.parse(event.data);
      callback(tx);
    };
  };
  return {
    startSocket,
  };
}());

SocketUtils.startSocket(App.callbackFunction);

