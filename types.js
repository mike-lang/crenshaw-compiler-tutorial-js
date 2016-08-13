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
let base;

function dumpTable() {
  let symbolNames = Object.getOwnPropertyNames(symbolTable);

  symbolNames.forEach((name) => {
    console.log(`${name} ${symbolTable[name]}`);
  });
}

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
  function accumulateDigits() {
    let nextChar = look();

    if (isDigit(nextChar)) {
      value = 10 * value + parseInt(nextChar, 10);
      return getChar()
        .then(() => {
          return accumulateDigits();
        });
    }

  }
  let nextChar = look();

  if (!isDigit(nextChar)) {
    expected('Integer', nextChar);
  }
  let value = 0;

  return accumulateDigits(() => {
    return skipWhite()
      .thenResolve(value);
  });
}

function loadNum(n) {
  let valType;
  if (Math.abs(n) <= 127) {
    valType = 'B';
  } else if (Math.abs(n) <= 32767) {
    valType = 'W';
  } else {
    valType = 'L';
  }

  loadConst(n, valType);
  return valType;
}

function loadConst(n, valType) {
  move(valType, `#${n}`, 'D0');
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
  let offset = 8 + 2 * (base - n);
  emitLn(`MOVE ${offset}(A6),D0`);
}

function storeParam(n) {
  let offset = 8 + 2 * (base - n);
  emitLn(`MOVE D0,${offset}(A6)`);
}

function push(size) {
  move(size, 'D0', '-(SP)');
}

function postLabel(l) {
  console.log(l + ':');
}

function isVarType(c) {
  return c === 'B' || c === 'W' || c === 'L';
}

function getVarType(name) {
  let varType = typeofSymbol(name);

  if (!isVarType(varType)) {
    abort(`Identifier ${name} is not a variable`);
  }

  return varType;
}

function move(size, source, dest) {
  emitLn(`MOVE.${size} ${source},${dest}`);
}

// Load a variable to primary register
function loadVar(name, varType) {
  move(varType, name + '(PC)', 'D0');
}

function load(name) {
  let varType = getVarType(name);
  loadVar(name, varType);
  return varType;
}

// Convert the type of the value stored in register reg
function convert(source, dest, reg) {
  if (source !== dest) {
    if (source === 'B') {
      emitLn(`AND.W #$FF,${reg}`);
    }
    if (dest === 'L') {
      emitLn(`EXT.L ${reg}`);
    }
  }
}

function promote(sourceType, destType, reg) {
  let resultType = sourceType;

  if (sourceType !== destType) {
    if (sourceType === 'B' || ((sourceType === 'W') && (destType === 'L'))) {
      convert(sourceType, destType, reg);
      resultType = destType;
    }
  }

  return resultType;

}

function sameType(sourceType, destType) {
  let valType = promote(sourceType, destType, 'D7');
  return promote(destType, valType, 'D0');
}

function popAdd(stackType, regType) {
  pop(stackType);
  let resultType = sameType(stackType, regType);
  genAdd(resultType);
  return resultType;
}

function popSub(stackType, regType) {
  pop(stackType);
  let resultType = sameType(stackType, regType);
  genSub(resultType);
  return resultType;
}

function genAdd(size) {
  emitLn(`ADD.${size} D7,D0`);
}

function getSub(size) {
  emitLn(`SUB.${size} D7,D0`);
  emitLn(`NEG.${size} D0`);
}

function factor() {
  let nextChar = look();

  if (nextChar = '(') {
    return match('(')
      .then(() => {
        return expression();
      })
      .then((expressionType) => {
        return match(')')
          .thenResolve(expressionType);
      });
  } else if (isAlpha(nextChar)) {
    return getName()
      .then((name) => {
        return load(name);
      });
  } else {
    return getNum()
      .then((num) => {
        return loadNum(num);
      });
  }
}

function multiply(firstType) {
  return match('*')
    .then(() => {
      return factor();
    })
    .then((factorType) => {
      return popMul(firstType, factorType);
    });
}

function divide(firstType) {
  return match('/')
    .then(() => {
      return factor();
    })
    .then((factorType) => {
      return popDiv(firstType, factorType);
    });
}

// Store primary register to variable
function storeVar(name, varType) {
  emitLn(`LEA ${name}(PC),A0`);
  move(varType, 'D0', '(A0)');
}

function store(name, sourceType) {
  let destType = getVarType(name);
  convert(sourceType, destType);
  storeVar(name, destType);
}

function init() {
  return getChar()
    .then(() => {
      return skipWhite();
    });
}

function term() {
  function termTail(firstType) {
    return q()
      .then(() => {
        let nextChar = look();
        if (isMulop(nextChar)) {
          push(firstType);
          switch(nextChar) {
            case '*': return multiply(firstType);
            case '/': return divide(firstType);
          }
        } else {
          return firstType;
        }
      })
      .then((termType) => {
        return termTail(termType);
      })
  }
  return factor()
    .then((factorType) => {
      return termTail(factorType);
    });
}

function genMult() {
  emitLn('MULS D7,D0');
}

function genLongMult() {
  emitLn('JSR MUL32');
}

function popMul(stackType, regType) {
  pop(stackType);
  let resultType = sameType(stackType, regType);
  convert(resultType, 'W', 'D7');
  convert(resultType, 'W', 'D0');

  if (resultType === 'L') {
    genLongMult();
  } else {
    genMult();
  }

  if (resultType === 'B') {
    return 'W';
  } else {
    return 'L';
  }
}

function popDiv(stackType, regType) {
  pop(stackType);
  convert(stackType, 'L', 'D7');

  if (stackType === 'L' || regType === 'L') {
    convert(regType, 'L', 'D0');
    genLongDiv();
    return 'L';
  } else {
    convert(regType, 'W', 'D0');
    genDiv();
    return stackType;
  }
}

function genDiv() {
  emitLn('DIVS D0,D7');
  move('W', 'D7', 'D0');
}

function genLongDiv() {
  emitLn('JSR DIV32');
}

function expression() {

  function expressionTail(termType) {
    let nextChar = look();

    if (isAddop(nextChar)) {
      return q()
        .then(() => {
          push(termType);
          switch(nextChar) {
            case '+': return add(termType);
            case '-': return subtract(termType);
          }
        })
        .then((nextTermType) => {
          return expressionTail(nextTermType);
        });
    }
  }

  return q()
    .then(() => {
      let nextChar = look();

      if (isAddop(nextChar)) {
        return unop();
      } else {
        return term();
      }
    })
    .then((termType) => {
      return expressionTail(termType);
    })
    .then((expressionType) => {
      return expressionType;
    });
}

function add(valType) {
  return match('+')
    .then(() => {
      return term();
    })
    .then((termType) => {
      return popAdd(valType, termType);
    });
}

function subtract(valType) {
  return match('-')
    .then(() => {
      return term();
    })
    .then((termType) => {
      return popSub(valType, termType);
    });
}

function pop(size) {
  move(size, '(SP)+', 'D7');
}

function unop() {
  clear();
  return 'W';
}

// Clears the primary register
function clear() {
  emitLn('CLR D0');
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

function assignment() {
  return getName()
    .then((name) => {
      return match('=')
        .then(() => {
          return expression();
        })
        .then((expressionResultType) => {
          return store(name, expressionResultType);
        });
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
    })
    .then(() => {
      return fin();
    })
    .then(() => {
      base = numParams;
      numParams = numParams + 4;
    });
}

function locDecl() {
  return match('v')
    .then(() => {
      return getName();
    })
    .then((name) => {
      return addParam(name);
    })
    .then(() => {
      return fin();
    });
}

function locDecls() {
  function locDeclsTail() {
    let nextChar = look();
    if (nextChar === 'v') {
      return locDecl()
        .then(() => {
          n++;
        })
        .then(() => {
          return locDeclsTail();
        });
    }
  }
  let n = 0;

  return locDeclsTail()
    .then(() => {
      return n;
    });

}

function block() {
  let nextChar = look();

  if (nextChar !== '.') {
    return assignment()
      .then(() => {
        return fin();
      })
      .then(() => {
        return block();
      });
  }
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

function alloc(name, varType) {
  addEntry(name, varType);
  allocVar(name, varType);
}

function allocVar(name, varType) {
  console.log(`${name}:\tDC.${varType} 0`);
}

function decl() {
  return getName()
    .then((varType) => {
      return getName()
        .then((name) => {
          return alloc(name, varType);
        });
    });
}

function topDecls() {
  return q() 
    .then(() => {
      let nextChar = look();
      if (nextChar !== 'B') {
        return q()
          .then(() => {
            switch(nextChar) {
              case 'b': 
              case 'w':
              case 'l':
                return decl();
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
  return expression()
    .then(() => {
      return push();
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
      return 2 * n;
    });
}

function procProlog(procName, numLocalWords) {
  postLabel(procName);
  emitLn(`LINK A6,#${-2 * numLocalWords}`);
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
      if (inTable(name)) {
        return duplicateVar(name);
      }
      symbolTable[name] = 'p';
      return formalList()
        .then(() => {
          return locDecls();
        })
        .then((numLocalWords) => {
          return procProlog(name, numLocalWords);
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
    return match('B');
  })
  .then(() => {
    return fin();
  })
  .then(() => {
    return block();
  })
  .then(() => {
    return dumpTable();
  })
  .catch((err) => {
    console.log(err);
  });
