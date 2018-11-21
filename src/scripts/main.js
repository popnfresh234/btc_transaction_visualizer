const Viva = require('./vivagraph');
const WebglUtils = require('./webgl-utils');
const uuidv4 = require('uuid/v4');
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

    socket.onerror = (event) => {
      console.log(event);
    };
  };
  return {
    startSocket,
  };
}());

/* eslint-disable no-use-before-define */
const TransactionUtils = (function () {
  const _addNodes = (nodes, hash, type) => {
    const test = type === 'input' ? 'output' : 'input';
    nodes.forEach((node) => {
      let addr = null;
      const addrLookup = {
        input: () => (node.prev_out.addr ? node.prev_out.addr + type + uuidv4() + hash : null),
        output: () => (node.addr ? node.addr + type + uuidv4() + hash : null),
      };

      const fn = addrLookup[type];
      if (fn) addr = fn();
      if (addr) {
        const matchedNodes = App.findMatchingNodes(addr, hash, type, test);
        if (!matchedNodes.length) {
          App.addNode(addr, { type, hash, timestamp: new Date().getTime() });
          App.addLink(hash, addr);
        } else {
          matchedNodes.forEach((matchedNode) => {
            App.addLink(hash, matchedNode.id);
            App.setType(matchedNode, 'mixed');
          });
        }
      }
    });
    App.updateInfo('node-count', App.getNodeCount());
  };

  const _buildNodesAndLinks = (tx) => {
    const { inputs, out, hash } = tx.x;
    // Add node for transaction
    App.addNode(hash, { type: 'tx', timestamp: new Date().getTime() });
    _addNodes(inputs, hash, 'input');
    _addNodes(out, hash, 'output');
  };


  const _isBoring = (nodeIds) => {
    let txCount = 0;
    // End early if 4 or more nodes
    if (nodeIds.length > 4) {
      return false;
    }
    for (let i = 0; i < nodeIds.length; i++) {
      const id = nodeIds[i];
      if (id.indexOf('input') === -1 && id.indexOf('output') === -1) {
        txCount++;
      }
    }
    if (txCount > 2) {
      return false;
    }
    return true;
  };


  const handleMessage = (message) => {
    const tx = JSON.parse(message.data);
    if (tx.op === 'utx') {
      _buildNodesAndLinks(tx);
    }
    while (App.getNodeCount() > App.getNodeLimit()) {
      App.forEachNode((node) => {
        const timeSinceCreated = new Date().getTime() - node.data.timestamp;
        if (timeSinceCreated > App.getStaleNodeTime() && !node.data.interesting) {
          const linkedToInteresting = App.checkForInterestingLinks(node);
          if (!linkedToInteresting) {
            App.removeNode(node.id);
          }
        }
      });
    }
  };


  return {
    handleMessage,
  };
}());
  /* eslint-enable no-use-before-define */


const App = (function () {
  const NODE_LIMIT = 10000;
  const STALE_NODE_TIME = 60000 * 9; // 10 min
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


  const graph = Viva.Graph.graph();
  const layout = Viva.Graph.Layout.forceDirected(graph, FORCE_CONFIG);
  const graphics = Viva.Graph.View.webglGraphics(GRAPHICS_OPTIONS);
  const circleNode = WebglUtils.buildCircleNodeShader();
  graphics.setNodeProgram(circleNode);
  graphics.node(node => new _WebglCircle(50 * SCALE_COEFFICIENT, App.getNodeColor(node)));
  graphics.link(() => Viva.Graph.View.webglLine(WebglUtils.getLinkColor()));
  const renderer = Viva.Graph.View.renderer(
    graph,
    {
      layout,
      graphics,
      renderLinks: true,
      container: document.getElementById('graph-container'),
      prerender: true,
    },
  );


  const _getLinkedNodeIds = (node, nodeIds) => {
    if (!nodeIds.length) {
      nodeIds.push(node.id);
    }

    const { links } = node;
    let linkedId = '';
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (node.data.type !== 'tx') {
        linkedId = link.fromId;
      } else {
        linkedId = link.toId;
      }
      if (nodeIds.indexOf(linkedId) === -1) {
        nodeIds.push(linkedId);
        _getLinkedNodeIds(App.getNode(linkedId), nodeIds);
      }
    }
    return nodeIds;
  };

  const setInteresting = (node) => {
    const interestingNode = node;
    if (interestingNode.data) {
      interestingNode.data.interesting = !interestingNode.data.interesting;
      App.setType(node, node.data.type);
    }
  };

  const _markNodesInteresting = (node) => {
    const linkedNodeIds = _getLinkedNodeIds(node, []);
    for (let i = 0; i < linkedNodeIds.length; i++) {
      const interestingNode = App.getNode(linkedNodeIds[i]);
      setInteresting(interestingNode);
    }
  };

  const checkForInterestingLinks = (node) => {
    const linkedNodeIds = _getLinkedNodeIds(node, []);
    for (let i = 0; i < linkedNodeIds.length; i++) {
      const testNode = App.getNode(linkedNodeIds[i]);
      if (testNode.data.interesting) {
        return true;
      }
    }
    return false;
  };

  const events = Viva.Graph.webglInputEvents(graphics, graph);
  events.dblClick((node) => {
    _markNodesInteresting(node);
  });

  events.mouseEnter((node) => {
    console.log(node.data);
  });

  const updateInfo = (target, value) => {
    document.getElementById(target).innerHTML = value;
  };

  const startGraph = () => {
    const startTime = Date.now();
    setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      updateInfo('elapsed-time', elapsedTime);
    }, 100);
    renderer.run();
    while (renderer.getTransform().scale > INITIAL_ZOOM) {
      renderer.zoomOut();
    }
    updateInfo('stale-node-time', STALE_NODE_TIME);
    updateInfo('node-limit', NODE_LIMIT);
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

  const getNodeColor = (node) => {
    const colorMap = {
      tx: () => WebglUtils.getTxNodeColor(),
      input: () => WebglUtils.getInputNodeColor(),
      output: () => WebglUtils.getOutputNodeColor(),
      mixed: () => WebglUtils.getMixedNodeColor(),
    };
    if (node.data.interesting) {
      return WebglUtils.getUnknownNodeColor();
    }
    if (node.data && colorMap[node.data.type]) {
      return colorMap[node.data.type]();
    } return WebglUtils.getUnknownNodeColor();
  };

  const setType = (node, type) => {
    const updatedNode = node;
    updatedNode.data.type = type;
    const nodeUI = graphics.getNodeUI(node.id);
    nodeUI.color = getNodeColor(updatedNode);
    renderer.rerender();
  };


  const findMatchingNodes = (id, hash, type, test) => graph.getNodesWithId(id, hash, type, test);

  const getNodeCount = () => graph.getNodeCount();

  const getNodeLimit = () => NODE_LIMIT;

  const getStaleNodeTime = () => STALE_NODE_TIME;

  const getNode = nodeId => graph.getNode(nodeId);

  const getAllNodes = () => graph.getAllNodes();

  const removeNode = id => graph.removeNode(id);

  const forEachNode = callback => graph.forEachNode(callback);

  const removeLink = link => graph.removeLink(link);

  return {
    startGraph,
    loadSamples,
    addNode,
    addLink,
    getNodeColor,
    setType,
    setInteresting,
    checkForInterestingLinks,
    findMatchingNodes,
    getNodeCount,
    getNodeLimit,
    getStaleNodeTime,
    getNode,
    getAllNodes,
    removeNode,
    forEachNode,
    removeLink,
    updateInfo,
  };
}());

App.startGraph();
