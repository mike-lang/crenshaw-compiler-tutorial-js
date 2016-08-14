'use strict';


const input = require('./input'),
  error = require('./error'),
  look = input.look,
  getChar = input.getChar,
  expected = error.expected;

function isAlpha(c) {
  return !!c.match(/[a-zA-Z]/);
}
exports.isAlpha = isAlpha;

function isDigit(c) {
  return !!c.match(/\d/);
}
exports.isDigit = isDigit;

function isAlNum(c) {
  return isAlpha(c) || isDigit(c);
}
exports.isAlNum = isAlNum;

function isAddop(c) {
  return c === '+' || c === '-';
}
exports.isAddop = isAddop;

function isMulop(c) {
  return c === '*' || c === '/';
}
exports.isMulop = isMulop;

function match(x) {
  let nextChar = look();

  if (nextChar === x) {
    return getChar();
  } else {
    return expected(`'${x}'`);
  }
} 
exports.match = match;

function getName() {
  let nextChar = look();
  if (!isAlpha(nextChar)) {
    return expected('Name');
  }

  return getChar()
    .thenResolve(nextChar.toUpperCase());
}
exports.getName = getName;

function getNumber() {
  let nextChar = look();
  if (!isDigit(nextChar)) {
    return expected('Integer');
  }

  return getChar()
    .thenResolve(nextChar);
}
exports.getNumber = getNumber;
