'use strict';

const input = require('./input'),
  output = require('./output'),
  error = require('./error'),
  scanner = require('./scanner'),
  parser = require('./parser'),
  factor = parser.factor;

input.init()
  .then(() => {
    return factor();
  })
  .catch((err) => {
    console.log(err.stack);
  });
