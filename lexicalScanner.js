'use strict';

const q = require('q'),
  util = require('util');

const cradle = require('./cradle');

const isAlpha = cradle.isAlpha,
  isDigit = cradle.isDigit,
  look = cradle.look,
  getChar = cradle.getChar,
  expected = cradle.expected,
  init = cradle.init;

const CR = '\r',
  LF = '\n',
  TAB = '\t';

const KWList = [
  'IF',
  'ELSE',
  'ENDIF',
  'END'
];

// Token Types - must match array index of corresponding keyword
// in KWList
const IFSYM = 0,
  ELSESYM = 1,
  ENDIFSYM = 2,
  ENDSYM = 3,
  IDENT = 4,
  NUMBER = 5,
  OPERATOR = 6;

process.on('unhandledException', (err) => {
  console.log(err.stack);
});

function lookup(s) {
  return KWList.indexOf(s);
}

function isWhite(c) {
  return c === ' ' || c === TAB;
}

function skipWhite() {
  return q()
    .then(() => {
      let nextChar = look();
      if (isWhite(nextChar)) {
        return getChar()
          .then(() => {
            return skipWhite();
          });
      }
    });
}

function fin() {
  return q()
    .then(() => {
      let nextChar = look();
      if (nextChar === '\r') 
        return getChar();
    })
    .then(() => {
      let nextChar = look();
      if (nextChar === '\n')
        return getChar();
    });
}


function isAlNum(c) {
  return isAlpha(c) || isDigit(c);
}

function isOp(c) {
  return c === '+' || c === '-' || c === '*' || c === '/' 
    || c === '<' || c === '>' || c === ':' || c === '=';
}

function getName() {
  let whileState = {
    x:''
  };
  function getNameInner() {
    let nextChar = look();
    if (isAlNum(nextChar)) {
      whileState.x = whileState.x + nextChar.toUpperCase();
      return getChar()
        .then(() => {
          return getNameInner();
        });
    }
  }

  let nextChar = look();
  if (!isAlpha(nextChar)) {
    expected('Name');
  }
 
  return getNameInner()
    .then(() => {
      return skipWhite();
    })
    .then(() => {
      return whileState.x;
    });
}
exports.getName = getName;

function getNum() {
  let whileState = {
    x: ''
  };
  function getNumInner() {
    let nextChar = look();
    if (isDigit(nextChar)) {
      whileState.x = whileState.x + nextChar;
      return getChar()
        .then(() => {
          return getNumInner();
        });
    }
  }

  let nextChar = look();
  if (!isDigit(nextChar)) {
    expected('Integer')
  }

  return getNumInner()
    .then(() => {
      return skipWhite();
    })
    .then(() => {
      return whileState.x;
    });
}
exports.getNum = getNum;

function getOp() {
  let whileState = {
    x: ''
  };

  function getOpInner() {
    let nextChar = look();
    if (isOp(nextChar)) {
      whileState.x = whileState.x + nextChar;
      return getChar()
        .then(() => {
          return getOpInner();
        });
    }
  }

  let nextChar = look();
  if (!isOp(nextChar)) {
    expected('Operator');
  }

  return getOpInner()
    .then(() => {
      return skipWhite();
    })
    .then(() => {
      return whileState.x;
    });
}

function scan() {

  function eatCRs() {
    return q()
      .then(() => {
        let nextChar = look();
        if (nextChar === CR) {
          return fin()
            .then(() => {
              return eatCRs();
            });
        }
      });
  }

  function afterCRs() {
  
    let nextChar = look();
    if (isAlpha(nextChar)) {
      return getName()
        .then((name) => {
          let k = lookup(name),
            tokenType;
          if (k === -1) {
            tokenType = IDENT;
          } else {
            tokenType = k;
          }
          return skipWhite()
            .thenResolve({
              token: tokenType,
              value: name
            });
        });
    } else if (isDigit(nextChar)) {
      return getNum()
        .then((num) => {
          return skipWhite()
            .thenResolve({
              token: NUMBER,
              value: num
            });
        });
    } else if (isOp(nextChar)) {
      return getOp()
        .then((op) => {
          return skipWhite()
            .thenResolve({
              token: OPERATOR,
              value: op
            });
        });
    } else {
      return getChar()
        .then(() => {
          return skipWhite()
            .thenResolve({
              token: OPERATOR,
              value: nextChar
            });
        });
    }
  }

  return eatCRs()
    .then(() => {
      return afterCRs();
    });
}

function scanTokens() {
  return scan()
    .then((token) => {
      let output;
      switch (token.token) {
        case IDENT:
          output = 'Ident ';
          break;
        case NUMBER:
          output = 'Number ';
          break;
        case OPERATOR:
          output = 'Operator ';
          break;
        default:
          output = 'Keyword ';
      }
      output = output + token.value;
      console.log(output);
      if (token.token !== ENDSYM) {
        return scanTokens();
      }
    });
}

init()
  .then(() => {
    return scanTokens();
  })
  .catch((err) => {
    console.log(err.stack);
  });
