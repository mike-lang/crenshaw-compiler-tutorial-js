'use strict';

const input = require('./input'),
  error = require('./error'),
  expected = error.expected,
  look = input.look,
  getChar = input.getChar;

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
  function gatherAlNum() {
    let nextChar = look();
    if (isAlNum(nextChar)) {
      n = n + nextChar.toUpperCase();
      return getChar()
        .then(() => {
          return gatherAlNum();
        });
    }
  }

  let n = '',
    nextChar = look();

  if (!isAlpha(nextChar)) {
    return expected('Name');
  }

  return gatherAlNum()
    .then(() => {
      return n;
    });
}
exports.getName = getName;

function getNumber() {
  function gatherDigits() {
    let nextChar = look();

    if (isDigit(nextChar)) {
      n = n + nextChar;
      return getChar()
        .then(() => {
          return gatherDigits();
        });
    }
  }

  let n = '',
    nextChar = look();

  if (!isDigit(nextChar)) {
    return expected('Integer');
  }

  return gatherDigits()
    .then(() => {
      return n;
    });
}
exports.getNumber = getNumber;
