'use strict';

const codeGen = require('./codeGen'),
  scanner = require('./scanner'),
  input = require('./input'),
  errorModule = require('./error'),
  look = input.look,
  isDigit = scanner.isDigit,
  isAlpha = scanner.isAlpha,
  getName = scanner.getName,
  getNumber = scanner.getNumber,
  loadConstant = codeGen.loadConstant,
  loadVariable = codeGen.loadVariable,
  error = errorModule.error;

function factor() {
  let nextChar = look();

  if (isDigit(nextChar)) {
    return getNumber()
      .then((number) => {
        return loadConstant(number);
      });
  } else if (isAlpha(nextChar)) {
    return getName()
      .then((name) => {
        return loadVariable(name);
      });
  } else {
    return error(`Unrecognized character ${nextChar}`);
  }
}
exports.factor = factor;
