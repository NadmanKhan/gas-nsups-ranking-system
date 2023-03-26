const path = require('path');
const GasPlugin = require("gas-webpack-plugin");

module.exports = {
  mode: 'production',
  entry: {
    main: path.resolve(__dirname, 'src', 'main.ts'),
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
      },
    ],
  },
  plugins: [
    new GasPlugin(),
  ],
};