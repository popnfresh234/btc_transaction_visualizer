const Viva = require('./vivagraph');
const WebglUtils = require('./webgl-utils');

const SocketUtils = (function () {
  const socket = new WebSocket('wss://ws.blockchain.info/inv');
  const startSocket = (callback) => {
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ op: 'unconfirmed_sub' }));
    });
    socket.onmessage = (event) => {
      callback(event);
    };
  };
  return {
    startSocket,
  };
}());


const TransactionUtils = (function () {
  const handleMessage = (message) => {
    const tx = JSON.parse(event.data);
    if (tx.op === 'utx') {
      console.log(tx.x);
    }
  };
  return {
    handleMessage,
  };
}());

const App = (function () {
  const SCALE_COEFFICIENT = 4;
  const INITIAL_ZOOM = 0.04;
  const FORCE_CONFIG = {
    springLength: 80 * SCALE_COEFFICIENT,
    springCoeff: 0.0002,
    dragCoeff: 0.009,
    gravity: -30 * SCALE_COEFFICIENT,
    theta: 0.7,
  };

  const GRAPHICS_OPTIONS = {
    clearColor: true,
    clearColorValue: {
      r: 0.0078,
      g: 0,
      b: 0.2471,
      a: 1,
    },
  };

  function _WebglCircle(size, color) {
    this.size = size;
    this.color = color;
  }

  function _getNodeColor(node) {
    const colorMap = {
      1: () => WebglUtils.getTxNodeColor(),
      2: () => WebglUtils.getInputNodeColor(),
      3: () => WebglUtils.getOutputNodeColor(),
      4: () => WebglUtils.getMixedNodeColor(),
    };
    if (node.data && colorMap[node.data.type]) {
      return colorMap[node.data.type]();
    } return WebglUtils.getUnknownNodeColor();
  }

  const graph = Viva.Graph.graph();
  const layout = Viva.Graph.Layout.forceDirected(graph, FORCE_CONFIG);
  const graphics = Viva.Graph.View.webglGraphics(GRAPHICS_OPTIONS);
  const circleNode = WebglUtils.buildCircleNodeShader();
  graphics.setNodeProgram(circleNode);
  graphics.node(node => new _WebglCircle(50 * SCALE_COEFFICIENT, _getNodeColor(node)));
  graphics.link(link => Viva.Graph.View.webglLine(WebglUtils.getLinkColor()));
  const renderer = Viva.Graph.View.renderer(
    graph,
    {
      layout,
      graphics,
      renderLinks: true,
      prerender: true,
    },
  );
  const events = Viva.Graph.webglInputEvents(graphics, graph);
  events.mouseEnter((node) => {
    console.log(node);
  });

  const startGraph = () => {
    renderer.run();
    while (renderer.getTransform().scale > INITIAL_ZOOM) {
      renderer.zoomOut();
      SocketUtils.startSocket(TransactionUtils.handleMessage);
    }
  };

  const addNode = (hash, typeNumber) => {
    graph.addNode(hash, { type: typeNumber });
  };
  return {
    startGraph,
    getGraph,
  };
}());

App.startGraph();

