'use strict';

const cradle = require('./cradle');

const look = cradle.look,
  expected = cradle.expected,
  getChar = cradle.getChar,
  init = cradle.init,
  emitLn = cradle.emitLn,
  match = cradle.match;


function isBoolean(c) {
  let upperC = c.toUpperCase();
  return upperC === 'T' || upperC === 'F';
}

function getBoolean() {
  let nextChar = look();
  if (!isBoolean(nextChar)) {
    return expected('Boolean Literal');
  }

  let result = nextChar.toUpperCase() === 'T';

  return getChar()
    .thenResolve(result);
}

function boolExpression() {

  function boolExpressionInner() {
    let nextChar = look();
    if (isOrOp(nextChar)) {
      emitLn('MOVE D0,-(SP)');
      switch(nextChar) {
        case '|': 
          return boolOr()
            .then(() => {
              return boolExpressionInner();
            });
        case '~':
          return boolXor()
            .then(() => {
              return boolExpressionInner();
            });
      }
    }
  }

  return boolTerm()
    .then(() => {
      return boolExpressionInner();
    });
}

function boolTerm() {
  let nextChar = look();
  if (!isBoolean(nextChar)) return expected('Boolean Literal');
  return getBoolean()
    .then((myBool) => {
      if (myBool) {
        emitLn('MOVE #-1,D0')
      } else {
        emitLn('CLR D0');
      }
    });
}

function isOrOp(c) {
  return c === '|' || c === '~';
}

function boolOr() {
  return match('|')
    .then(() => {
      return boolTerm();
    })
    .then(() => {
      emitLn('OR (SP)+,D0');
    });
}

function boolXor() {
  return match('~')
    .then(() => {
      return boolTerm();
    })
    .then(() => {
      emitLn('EOR (SP)+,D0');
    })
}


init()
  .then(() => {
    return boolExpression();
  })
  .catch((err) => {
    console.log(err.stack);
  })
