const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/scripts/main.js',
  plugins: [
    new CleanWebpackPlugin(['dist']),
    new CopyWebpackPlugin([
      { from: './src/index.html', to: './index.html' },
      { from: './src/css/skeleton.css', to: './skeleton.css' },
      { from: './src/css/normalize.css', to: './normailze.css' },
      { from: './src/css/style.css', to: './style.css' },
      { from: './src/icons/favicon.ico', to: './favicon.ico' },
    ]),
  ],
  devtool: 'source-map',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};

