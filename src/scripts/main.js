const Viva = require('./vivagraph');
const WebglUtils = require('./webgl-utils');
const Sample = require('./sample');

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
  const _addNodes = (nodes, hash, type) => {
    const test = type === 'input' ? 'output' : 'input';
    nodes.forEach((node) => {
      const addr = type === 'input' ? node.prev_out.addr + type + hash : node.addr + type + hash;
      const matchedNodes = App.findMatchingNodes(addr, hash, type, test);
      if (!matchedNodes.length) {
        App.addNode(addr, { type, hash });
        App.addLink(hash, addr);
      } else {
        matchedNodes.forEach((matchedNode) => {
          App.addLink(hash, matchedNode.id);
          App.setTypeMixed(matchedNode);
        });
      }
    });
  };
  const _buildNodesAndLinks = (tx) => {
    const { inputs, out, hash } = tx.x;
    // Add node for transaction
    App.addNode(hash, { type: 'tx' });
    _addNodes(inputs, hash, 'input');
    _addNodes(out, hash, 'output');
  };

  const _getLinkedNodeIds = (node, nodeIds) => {
    if (!nodeIds.length) {
      nodeIds.push(node.id);
    }

    const { links } = node;
    let linkedId = '';
    links.forEach((link) => {
      if (node.data.type !== 'tx') {
        linkedId = link.fromId;
      } else {
        linkedId = link.toId;
      }
      if (nodeIds.indexOf(linkedId) === -1) {
        nodeIds.push(linkedId);
        _getLinkedNodeIds(App.getNode(linkedId), nodeIds);
      }
    });
    return nodeIds;
  };

  const _isBoring = (nodeIds) => {
    let txCount = 0;
    nodeIds.forEach((id) => {
      if (id.indexOf('input') === -1 && id.indexOf('output') === -1) {
        txCount++;
      }
    });
    if (txCount > 2 || nodeIds.length > 4) {
      return false;
    } return true;
  };


  const handleMessage = (message) => {
    const tx = JSON.parse(message.data);
    if (tx.op === 'utx') {
      _buildNodesAndLinks(tx);
    }
  };


  return {
    handleMessage,
  };
}());

const App = (function () {
  const NODE_LIMIT = 50;
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
      tx: () => WebglUtils.getTxNodeColor(),
      input: () => WebglUtils.getInputNodeColor(),
      output: () => WebglUtils.getOutputNodeColor(),
      mixed: () => WebglUtils.getMixedNodeColor(),
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
  graphics.link(() => Viva.Graph.View.webglLine(WebglUtils.getLinkColor()));
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


  const _getLinkedNodeIds = (node, nodeIds) => {
    if (!nodeIds.length) {
      nodeIds.push(node.id);
    }

    const { links } = node;
    let linkedId = '';
    links.forEach((link) => {
      if (node.data.type !== 'tx') {
        linkedId = link.fromId;
      } else {
        linkedId = link.toId;
      }
      if (nodeIds.indexOf(linkedId) === -1) {
        nodeIds.push(linkedId);
        _getLinkedNodeIds(App.getNode(linkedId), nodeIds);
      }
    });
    return nodeIds;
  };

  events.mouseEnter((node) => {
    const ids = _getLinkedNodeIds(node, []);
    ids.forEach((id, index) => {
      console.log(index);
      graph.removeNode(id);
    });
  });

  const startGraph = () => {
    renderer.run();
    while (renderer.getTransform().scale > INITIAL_ZOOM) {
      renderer.zoomOut();
    }
    SocketUtils.startSocket(TransactionUtils.handleMessage);
  };

  const loadSamples = () => {
    renderer.run();
    while (renderer.getTransform().scale > INITIAL_ZOOM) {
      renderer.zoomOut();
    }
    const { txs } = Sample;
    for (let i = 0; i < txs.length; i++) {
      TransactionUtils.handleMessage(({ data: JSON.stringify(txs[i]) }));
    }
  };

  const addNode = (hash, data) => {
    graph.addNode(hash, data);
  };

  const addLink = (source, target) => {
    graph.addLink(source, target);
  };

  const setTypeMixed = (node) => {
    const nodeUI = graphics.getNodeUI(node.id);
    nodeUI.color = WebglUtils.getMixedNodeColor();
    renderer.rerender();
  };

  const findMatchingNodes = (id, hash, type, test) => graph.getNodesWithId(id, hash, type, test);

  const getNodeCount = () => graph.getNodeCount();

  const getNodeLimit = () => NODE_LIMIT;

  const getNode = nodeId => graph.getNode(nodeId);

  const getAllNodes = () => graph.getAllNodes();

  const removeNode = id => graph.removeNode(id);

  return {
    startGraph,
    loadSamples,
    addNode,
    addLink,
    setTypeMixed,
    findMatchingNodes,
    getNodeCount,
    getNodeLimit,
    getNode,
    getAllNodes,
    removeNode,
  };
}());

App.startGraph();
