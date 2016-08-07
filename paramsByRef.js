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

let paramsTable = {};
let numParams = 0;

function clearParams() {
  paramsTable = {};
  numParams = 0;
}

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
  if (isParam(symbolName)) {
    return 'f';
  }
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

function paramNumber(n) {
  return paramsTable[n];
}

function isParam(n) {
  return paramsTable[n] !== undefined;
}

function addParam(name) {
  if (isParam(name)) {
    return duplicateVar(name);
  }

  numParams++;
  paramsTable[name] = numParams;
}

function loadParam(n) {
  let offset = 8 + 4 * (numParams - n);
  emitLn(`MOVE.L ${offset}(A6),A0`);
  emitLn('MOVE (A0),D0');
}

function storeParam(n) {
  let offset = 8 + 4 * (numParams - n);
  emitLn(`MOVE.L ${offset}(A6),A0`);
  emitLn('MOVE D0,(A0)');
}

function push() {
  emitLn('MOVE D0,-(SP)');
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
      if (isParam(name)) {
        return loadParam(paramNumber(name));
      }
      return loadVar(name);
    });
}

function assignOrProc() {
  return getName((name) => {
    switch (typeofSymbol(name)) {
      case undefined: return undefinedVar(name);
      case 'v': return assignment(name);
      case 'f': return assignment(name);
      case 'p': return callProc(name);
      default: abort(`Identifier ${name} cannot be used here`);
    }
  });
}

function assignment(name) {
  return match('=')
    .then(() => {
      return expression();
    })
    .then(() => {
      if (isParam(name)) {
        return storeParam(paramNumber(name));
      }
      return storeVar(name);
    });
}

function callProc(name) {
  return paramList()
    .then((numParams) => {
      return call(name)
        .then(() => {
          return cleanStack(numParams);
        });
    });
}

function cleanStack(n) {
  if (n > 0) {
    emitLn(`ADD #${n},SP`);
  }
}

function call(name) {
  emitLn(`BSR ${name}`);
}

function formalList() {
  function paramListTail() {
    let nextChar = look();
    if (nextChar === ',') {
      return match(',')
        .then(() => {
          return formalParam();
        })
        .then(() => {
          return paramListTail();
        });
    }
  }
  return match('(')
    .then(() => {
      let nextChar = look();
      if (nextChar !== ')') {
        return formalParam()
          .then(() => {
            return paramListTail();
          });
      }
    })
    .then(() => {
      return match(')');
    });
}

function doBlock() {
  let nextChar = look();

  if (nextChar !== 'e') {
    return q() 
      .then(() => {
        return assignOrProc();
      })
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
  return q() 
    .then(() => {
      let nextChar = look();
      if (nextChar !== '.') {
        return q()
          .then(() => {
            switch(nextChar) {
              case 'v': return decl();
              case 'p': return doProc();
              case 'P': return doMain();
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
    });
}

function formalParam() {
  return getName()
    .then((name) => {
      return addParam(name);
    });
}

function param() {
  return getName()
    .then((name) => {
      emitLn(`PEA ${name}(PC)`);
    });
}

function paramList() {
  function paramListTail() {
    return match(',') 
      .then(() => {
        return param();
      })
      .then(() => {
        n++;
      });
  }

  let n = 0;
  return match('(')
    .then(() => {
      let nextChar = look();
      if (nextChar !== ')') {
        return param()
          .then(() => {
            n++;
            return paramListTail();
          });
      }
    })
    .then(() => {
      return match(')');
    })
    .then(() => {
      return 4 * n;
    });
}

function procProlog(procName) {
  postLabel(procName);
  emitLn('LINK A6,#0');
}

function procEpilog() {
  emitLn('UNLK A6');
  emitLn('RTS');
}

function doProc() {
  return match('p')
    .then(() => {
      return getName();
    })
    .then((name) => {
      return formalList()
        .then(() => {
          return fin();
        })
        .then(() => {
          if (inTable(name)) {
            duplicateVar(name);
          }
          symbolTable[name] = 'p';
          return procProlog(name);
        })
        .then(() => {
          return beginBlock();
        })
        .then(() => {
          return procEpilog();
        })
        .then(() => {
          return clearParams();
        });
    });
    
}

function returnStatement() {
  emitLn('RTS');
}

function doMain() {
  return match('p')
    .then(() => {
      return getName();
    })
    .then((name) => {
      return fin()
        .then(() => {
          if (inTable(name)) {
            duplicateVar(name);
          }
        });
    })
    .then(() => {
      return prolog();
    })
    .then(() => {
      return beginBlock();
    });
}

init()
  .then(() => {
    return topDecls();
  })
  .then(() => {
    return epilog();
  })
  .catch((err) => {
    console.log(err);
  });
