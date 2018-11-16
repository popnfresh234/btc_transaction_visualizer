# BTC Transaction Visualizer

[You can view this project here](https://popnfresh234.github.io/btc_transaction_visualizer//)

This project listens to the [blockchain.com web socket](https://www.blockchain.com/api/api_websocket) and uses the [VivaGraphJS](https://github.com/anvaka/VivaGraphJS) graphing library to display these transactions with a force directed graph.  The [uuid library](https://www.npmjs.com/package/uuid) is used to ensure that each node has a unique name.  Once 10,000 nodes have been drawn on the graph any node older than 9 minutes is removed in order to keep performance at a reasonable level.

![Mandelbrot Image](https://github.com/popnfresh234/btc_transaction_visualizer/blob/master/docs/screen_shot.png)

### Getting started

Clone the project
```
git clone https://github.com/popnfresh234/btc_transaction_visualizer
```

Install required node modules
```
npm install
```
Start the webpack development server to run the project locally
```
npm start
```
To build the project for distribution
```
npm run build
```