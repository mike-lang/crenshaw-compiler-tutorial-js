'use strict';

const output = require('./output'),
  emitLn = output.emitLn;

function loadConstant(n) {
  emitLn(`MOVE #${n},D0`);
}
exports.loadConstant = loadConstant;

function loadVariable(name) {
  emitLn(`MOVE ${name}(PC),D0`);
}
exports.loadVariable = loadVariable;
