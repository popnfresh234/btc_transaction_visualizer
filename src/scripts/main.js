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
  const _buildLinks = (links, hash, nodes) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      // Handle input case
      node.prev_out && links.push({
        source: node.prev_out.addr,
        target: hash,
        hash,
        type: 2,
      });
      // Handle ouptut case
      node.addr && links.push({
        source: hash,
        target: node.addr,
        hash,
        type: 3,
      });
    }
  };

  const _buildNodesFromLinks = (links) => {
    const typeLookup = {
      2: link => (
        {
          addr: link.source,
          data: { type: 2, hash: link.hash },
          source: link.hash,
          target: link.source,
        }
      ),
      3: link => (
        {
          addr: link.target,
          data: { type: 3, hash: link.hash },
          source: link.target,
          target: link.hash,
        }

      ),
    };

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const fn = typeLookup[link.type];
      const node = fn && fn(link);
      App.addNode(node.addr, node.data);
      App.addLink(node.source, node.target);
    }
  };

  const handleMessage = (message) => {
    const links = [];
    const tx = JSON.parse(message.data);
    if (tx.op === 'utx') {
      const { inputs, out, hash } = tx.x;
      // Add transaction node
      App.addNode(hash, { type: 1 });
      // Loop over inputs, create links
      _buildLinks(links, hash, inputs);
      _buildLinks(links, hash, out);
      _buildNodesFromLinks(links);
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

  const _getNodeColor = (node) => {
    const colorMap = {
      1: () => WebglUtils.getTxNodeColor(),
      2: () => WebglUtils.getInputNodeColor(),
      3: () => WebglUtils.getOutputNodeColor(),
      4: () => WebglUtils.getMixedNodeColor(),
    };
    if (node.data && colorMap[node.data.type]) {
      return colorMap[node.data.type]();
    } return WebglUtils.getUnknownNodeColor();
  };

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

  const addNode = (hash, data) => {
    graph.addNode(hash, data);
  };

  const addLink = (source, target) => {
    graph.addLink(source, target);
  };

  return {
    startGraph,
    addNode,
    addLink,
  };
}());

App.startGraph();

