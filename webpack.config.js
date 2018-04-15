
const path = require('path');

module.exports = {
  mode:'development',
  entry: './index.jsx',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  module:{
      rules:[
          {
            test: /.(js|jsx)$/,
            loader: "babel-loader"
          }

      ]
  },
  resolve:{
      extensions:['.jsx','.js']
  },
  devtool:"source-map"
};