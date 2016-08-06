'use strict';

const q = require('q');

const cradle = require('./cradle');

const look = cradle.look,
  getChar = cradle.getChar,
  abort = cradle.abort,
  isAlpha = cradle.isAlpha,
  isDigit = cradle.isDigit,
  emitLn = cradle.emitLn;


const TAB = '\t',
  CR = '\r',
  LF = '\n';

let symbolTable = {};

function isAlNum(c) {
  return isAlpha(c) || isDigit(c);
}

function isAddop(c) {
  return c === '+' || c === '-';
}

function isMulop(c) {
  return c === '*' || c === '/';
}

function isOrop(c) {
  return c === '|' || c ==='~';
}

function isRelop(c) {
  return c === '=' || c === '#' || c === '<' || c === '>';
}

function isWhite(c) {
  // Comments and line separators removed for procedures chapter
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
      if (nextChar === CR) {
        return getChar()
          .then(() => {
            let nextChar = look();
            if (nextChar === LF) {
              return getChar();
            }
          });
      }
    });
}

function match(x) {
  let nextChar = look();
  if (nextChar !== x) {
    return expected(`'${x}'`, nextChar);
  }

  return getChar()
    .then(() => {
      return skipWhite();
    });
}

function getName() {
  let nextChar = look();

  if (!isAlpha(nextChar)) {
    expected('Name', nextChar);
  }

  return getChar(() => {
    return skipWhite();
  }).thenResolve(nextChar.toUpperCase());
}

function getNum() {
  let nextChar = look();

  if (!isDigit(nextChar)) {
    expected('Integer', nextChar);
  }

  return getChar(() => {
    return skipWhite();
  }).thenResolve(nextChar);
}

function expected(s, a) {
  abort(`"${s}" Expected, instead saw "${a}"`);
}

function undefinedVar(name) {
  abort('Undefined Identifier ' + name);
}

function duplicateVar(name) {
  abort('Duplicate Identifier ' + name);
}

function typeofSymbol(symbolName) {
  return symbolTable[symbolName];
}

function inTable(name) {
  return symbolTable[name] !== undefined;
}

function checkDup(name) {
  if (inTable(name)) {
    duplicateVar(name);
  }
}

function addEntry(name, symbolType) {
  checkDup(name);

  symbolTable[name] = symbolType;
}

function checkVar(name) {
  if (!inTable(name)) {
    return undefinedVar(name);
  }

  if (typeofSymbol(name) !== 'v') {
    return abort(`${name} is not a variable`);
  }
}

function postLabel(l) {
  console.log(l + ':');
}

// Load a variable to primary register
function loadVar(name) {
  checkVar(name);
  emitLn(`MOVE ${name}(PC),D0`);
}

// Store primary register to variable
function storeVar(name) {
  checkVar(name);
  emitLn(`LEA ${name}(PC),A0`);
  emitLn('MOVE D0,(A0)');
}

function init() {
  return getChar()
    .then(() => {
      return skipWhite();
    });
}

function expression() {
  return getName()
    .then((name) => {
      return loadVar(name);
    });
}

function assignment() {
  return getName()
    .then((name) => {
      return match('=')
        .then(() => {
          return expression();
        })
        .then(() => {
          return storeVar(name);
        });
    });
}

function doBlock() {
  let nextChar = look();

  if (nextChar !== 'e') {
    return assignment()
      .then(() => {
        return fin();
      })
      .then(() => {
        return doBlock();
      });
  }
}

function beginBlock() {
  return match('b')
    .then(() => {
      return fin();
    })
    .then(() => {
      return doBlock();
    })
    .then(() => {
      return match('e');
    })
    .then(() => {
      return fin();
    });
}

function alloc(name) {
  if (inTable(name)) {
    duplicateVar(name);
  }

  symbolTable[name] = 'v';
  console.log(`${name}:\tDC 0`);
}

function decl() {
  return match('v')
    .then(() => {
      return getName();
    })
    .then((name) => {
      return alloc(name);
    });
}

function topDecls() {
  let nextChar = look();
  if (nextChar !== 'b') {
    return q()
      .then(() => {
        switch(nextChar) {
          case 'v': return decl();
          default: abort(`Unrecognized Keyword ${nextChar}`);
        }
      })
      .then(() => {
        return fin();
      })
      .then(() => {
        return topDecls();
      });
  }
}

init()
  .then(() => {
    return topDecls();
  })
  .then(() => {
    return beginBlock();
  })
  .catch((err) => {
    console.log(err);
  });
