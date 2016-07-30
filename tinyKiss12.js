'use strict'

const q = require('q');

q.longStackSupport = true;

const cradle = require('./cradle');

const emitLn = cradle.emitLn,
  look = cradle.look,
  abort = cradle.abort,
  getChar = cradle.getChar,
  isDigit = cradle.isDigit,
  isAlpha = cradle.isAlpha;


const CR = '\r', 
  LF = '\n',
  TAB = '\t';

let symbolTable = {};

let labelCount = 0;

let token;
let value;

const NKW = 9,
  NKW1 = 10;

const KWList = ['IF', 'ELSE', 'ENDIF', 'WHILE',
  'ENDWHILE', 'READ', 'WRITE', 'VAR', 'END'];

const KWCode = 'xileweRWve';



function lookup(s) {
  return KWList.indexOf(s) + 1;
}

function locate(s) {
  return KWList.indexOf(s) + 1;
}

function expected(s, a) {
  abort(`"${s}" Expected, instead saw "${a}"`);
}

function scan() {
  return q()
    .then(() => {
      if (token === 'x') {
        token = KWCode[lookup(value)];
      }
    });
}

function matchString(x) {
  return q()
    .then(() => {
      if (value !== x) {
        expected(`'${x}'`, value);
      }
    })
    .then(() => {
      return next();
    });
}

function isAlNum(c) {
  return isAlpha(c) || isDigit(c);
}

function isWhite(c) {
  return c === ' ' || c === TAB 
    || c === CR || c === LF
    || c === '{';
}

function getName() {
  function gatherAlNum() {
    let nextChar = look();
    value = value + nextChar.toUpperCase();
    return getChar()
      .then(() => {
        let nextChar = look();
        if (isAlNum(nextChar)) {
          return gatherAlNum();
        }
      });
  }

  return skipWhite()
    .then(() => {
      let nextChar = look();
      if (!isAlpha(nextChar)) expected('Identifier', nextChar);
      token = 'x';
      value = '';
      return gatherAlNum();
    });
}

function match(x) {
  return newLine()
    .then(() => {
      let nextChar = look();
      if (nextChar === x) return getChar();
      else expected(`''` + x + `''`, nextChar);
    })
    .then(() => {
      return skipWhite();
    });
}

function newLabel() {
  let result = 'L' + labelCount;
  labelCount++;
  return result;
}

function postLabel(l) {
  console.log(l + ':');
}

function isOrop(c) {
  return c === '|' || c ==='~';
}

function isRelop(c) {
  return c === '=' || c === '#' || c === '<' || c === '>';
}

function isMulop(c) {
  return c === '*' || c === '/';
}

function isAddop(c) {
  return c === '+' || c === '-';
}


function getNum() {
  function getNumTail() {
    let nextChar = look();
    value = value + nextChar;
    return getChar()
      .then(() => {
        let nextChar = look();
        if (isDigit(nextChar)) {
          return getNumTail();
        }
      });
  }

  return skipWhite()
    .then(() => {
      let nextChar = look();
    
      if (!isDigit(nextChar)) {
        expected('Number', nextChar);
      }
      token = '#';
      value = '';
    
      return getNumTail();
    });

}

function getOp() {
  return skipWhite()
    .then(() => {
      let nextChar = look();
      token = nextChar;
      value = nextChar;
      return getChar();
    });

}

function next() {
  return skipWhite()
    .then(() => {
      let nextChar = look();
      if (isAlpha(nextChar)) {
        return getName();
      } else if (isDigit(nextChar)) {
        return getNum();
      } else {
        return getOp();
      }
    });
}

function init() {
  return getChar()
    .then(() => {
      return next();
    });
}

function postLabel(l) {
  console.log(l + ':');
}

function header() {
  console.log('WARMST\tEQU $A01E');
  // Probably need to use INCLUDE directive instead for
  // the assembler included in EASy68K
  // This doesn't show up in Tiny1.1
  //emitLn('LIB TINYLIB');
}

function prolog() {
  return postLabel('MAIN');
}

function epilog() {
  emitLn('DC WARMST');
  emitLn('END MAIN');
}

function main() {
  return matchString('BEGIN')
    .then(() => {
      return prolog();
    })
    .then(() => {
      return block();
    })
    .then(() => {
      return matchString('END');
    })
    .then(() => {
      return epilog();
    });
}

function topDecls() {
  function topDeclsTail() {
    let listTailCalls = 0;
    function declListTail() {
      return q()
        .then(() => {
          if (token === ',') {
            return alloc()
              .then(() => {
                return declListTail();
              });
          }
        });
    }

    return q()
      .then(() => {
        if (token === 'v') {
          return alloc()
            .then(() => {
              return declListTail();
            })
            .then(() => {
              return semi();
            })
            .then(() => {
              return topDeclsTail();
            });
        }
      });
  }

  return scan()
    .then(() => {
      return topDeclsTail();
    });
}

function decl() {
  function varlistTail() {
    let nextChar = look();
    if (nextChar === ',') {
      return match(',')
        .then(() => {
          return getName();
        })
        .then(() => {
          return alloc(value);
        })
        .then(() => {
          return varlistTail();
        });
    }
  }

  return getName()
    .then(() => {
      return alloc(value);
    })
    .then(() => {
      return varlistTail();
    });

}

// Allocate storage for a static variable
function allocate(name, val) {
  console.log(`${name}:\tDC ${val}`);
}

function alloc(name) {

  return next()
    .then(() => {
      if (token !== 'x') {
        expected('Variable Name');
      }
    })
    .then(() => {
      checkDup(value);
      return addEntry(value, 'v');
    })
    .then(() => {
      return allocate(value, '0');
    })
    .then(() => {
      return next();
    });

}

function inTable(name) {
  return symbolTable[name] !== undefined;
}

function checkTable(name) {
  if (!inTable(name)) {
    undefinedVar(name);
  }
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

function assignment() {
  return q()
    .then(() => {
      checkTable(value);
      let name = value;
      return next()
        .then(() => {
          return matchString('=');
        })
        .then(() => {
          return boolExpression();
        })
        .then(() => {
          return store(name);
        });
    });
}

function block() {
  function blockTail() {
    if (!(token === 'e' || token === 'l')) {
      return q()
        .then(() => {
          switch(token) {
            case 'i': return doIf();
            case 'w': return doWhile();
            case 'R': return doRead();
            case 'W': return doWrite();
            case 'x': return assignment();
          }
        })
        .then(() => {
          return semi();
        })
        .then(() => {
          return scan();
        })
        .then(() => {
          return blockTail();
        });
    }
  }

  return scan()
    .then(() => {
      return blockTail();
    });
}

// Clears the primary register
function clear() {
  emitLn('CLR D0');
}

// Negates the primary register
function negate() {
  emitLn('NEG D0');
}

// Load a constant value to primary register
function loadConst(n) {
  emitLn(`MOVE #${n},D0`);
}

// Load a variable to primary register
function loadVar(name) {
  if (!inTable(name)) {
    undefinedVar(name);
  } 
  emitLn(`MOVE ${name}(PC),D0`);
}

// Push primary register onto stack
function push() {
  emitLn('MOVE D0,-(SP)');
}

// Add top of stack to primary register
function popAdd() {
  emitLn('ADD (SP)+,D0');
}

// Subtract primary register from top of stack
function popSub() {
  emitLn('SUB (SP)+,D0');
  emitLn('NEG D0');
}

// Multiply top of stack by primary register
function popMul() {
  emitLn('MULS (SP)+,D0');
}

// Divide top of stack by primary register
function popDiv() {
  emitLn('MOVE (SP)+,D7');
  emitLn('EXT.L D7');
  emitLn('DIVS D0,D7');
  emitLn('MOVE D7,D0');
}

// Store primary register to variable
function store(name) {
  emitLn(`LEA ${name}(PC),A0`);
  emitLn('MOVE D0,(A0)');
}

// Complement the primary register
function notIt() {
  emitLn('NOT D0');
}

// AND top of stack with primary register
function popAnd() {
  emitLn('AND (SP)+,D0');
}

// OR top of stack with primary register
function popOr() {
  emitLn('OR (SP)+,D0');
}

// XOR top of stack with primary register
function popXor() {
  emitLn('EOR (SP)+,D0');
}

// Compare top of stack with primary register
function popCompare() {
  emitLn('CMP (SP)+,D0');
}

// Set D0 if compare was =
function setEqual() {
  emitLn('SEQ D0');
  emitLn('EXT D0');
}

// Set D0 if Compare was !=
function setNEqual() {
  emitLn('SNE D0');
  emitLn('EXT D0');
}

// Set D0 if compare was >
function setGreater() {
  emitLn('SLT D0');
  emitLn('EXT D0');
}

// Set D0 if compare was <
function setLess() {
  emitLn('SGT D0');
  emitLn('EXT D0');
}

// Branch unconditional
function branch(l) {
  emitLn('BRA ' + l);
}

// Branch false
function branchFalse(l) {
  emitLn('TST D0');
  emitLn('BEQ ' + l);
}

// Set D0 if compare was <=
function setLessOrEqual() {
  emitLn('SGE D0');
  emitLn('EXT D0');
}

// Set D0 if compare was >=
function setGreaterOrEqual() {
  emitLn('SLE D0');
  emitLn('EXT D0');
}

// Read variable to primary register
function readIt() {
  emitLn('BSR READ');
  store(value);
}

// Write from primary register
function writeIt() {
  emitLn('BSR WRITE');
}

function equals() {
  return nextExpression()
    .then(() => {
      return setEqual();
    });
}

function notEquals() {
  return nextExpression()
    .then(() => {
      return setNEqual();
    });
}

function less() {
  return next()
    .then(() => {
      switch(token) {
        case '=': return lessOrEqual();
        case '>': return notEquals();
        default:
          return compareExpression()
            .then(() => {
              return setLess();
            });
      }
    });
}

function lessOrEqual() {
  return nextExpression()
    .then(() => {
      return setLessOrEqual();
    });
}

function greater() {
  return next()
    .then(() => {
      if (token === '=') {
        return nextExpression()
          .then(() => {
            return setGreaterOrEqual();
          });
      } else {
        return compareExpression()
          .then(() => {
            return setGreater();
          });
      }
    });
}

function relation() {
  return expression()
    .then(() => {
      if (isRelop(token)) {
        return q()
          .then(() => {
            return push();
          })
          .then(() => {
            switch(token) {
              case '=': return equals();
              case '<': return less();
              case '>': return greater();
            }
          })
      }
    });
}

function notFactor() {
  if (token === '!') {
    return next()
      .then(() => {
        return relation();
      })
      .then(() => {
        return notIt();
      });
  } else {
    return relation();
  }
}

function boolTerm() {
  function boolTermTail() {
    if (token === '&') {
      return q()
        .then(() => {
          return push();
        })
        .then(() => {
          return next();
        })
        .then(() => {
          return notFactor();
        })
        .then(() => {
          return popAnd();
        })
        .then(() => {
          return boolTermTail();
        });
    }
  }

  return notFactor()
    .then(() => {
      return boolTermTail();
    });
}

function boolOr() {
  return next()
    .then(() => {
      return boolTerm();
    })
    .then(() => {
      return popOr();
    });
}

function boolXor() {
  return next()
    .then(() => {
      return boolTerm();
    })
    .then(() => {
      return popXor();
    });
}

function boolExpression() {
  function boolExpressionTail() {
    if (isOrop(token)) {
      return q()
        .then(() => {
          return push();
        })
        .then(() => {
          switch(token) {
            case '|': return boolOr();
            case '~': return boolXor();
          }
        })
        .then(() => {
          return boolExpressionTail();
        });
    }
  }

  return boolTerm()
    .then(() => {
      return boolExpressionTail();
    });
}

function undefinedVar(name) {
  abort('Undefined Identifier ' + name);
}

function duplicateVar(name) {
  abort('Duplicate Identifier ' + name);
}

function checkIdent() {
  if (token !== 'x') {
    expected('Identifier', token);
  }
}

function factor() {
  if (token === '(') {
    return next()
      .then(() => {
        return boolExpression();
      })
      .then(() => {
        return matchString(')');
      });
  } else {
    return q()
      .then(() => {
        if (token === 'x') {
          return loadVar(value);
        } else if (token === '#') {
          return loadConst(value);
        } else {
          expected('Math Factor');
        }
      })
      .then(() => {
        return next();
      });
  }
}

function negFactor() {
  return match('-')
    .then(() => {
      let nextChar = look();
      if (isDigit(nextChar)) {
        return getNum()
          .then((number) => {
            return loadConst(number * -1);
          });
      } else {
        return factor()
          .then(() => {
            return negate();
          });
      }
    });
}

function firstFactor() {
  let nextChar = look();
  switch(nextChar) {
    case '+':
      return match('+')
        .then(() => {
          return factor();
        });
    case '-':
      return negFactor();
    default:
      return factor();
  }
}

function multiply() {
  return next()
    .then(() => {
      return factor();
    })
    .then(() => {
      return popMul();
    });
}

function divide() {
  return next()
    .then(() => {
      return factor();
    })
    .then(() => {
      return popDiv();
    });
}

function term1() {
  return q()
    .then(() => {
      if (isMulop(token)) {
        return q()
          .then(() => {
            return push();
          })
          .then(() => {
            switch(token) {
              case '*': return multiply();
              case '/': return divide();
            }
          })
          .then(() => {
            return term1();
          });
      }
    });
}

function term() {
  return factor()
    .then(() => {
      return term1();
    });
}

function firstTerm() {
  return firstFactor()
    .then(() => {
      return term1();
    });
}

function add() {
  return next()
    .then(() => {
      return term();
    })
    .then(() => {
      return popAdd();
    });
}

function subtract() {
  return next()
    .then(() => {
      return term();
    })
    .then(() => {
      return popSub();
    });
}

function expression() {
  function expressionTail() {
    if (isAddop(token)) {
      return q()
        .then(() => {
          return push();
        })
        .then(() => {
          switch(token) {
            case '+': return add();
            case '-': return subtract();
          }
        })
        .then(() => {
          return expressionTail();
        });
    }
  }

  return q()
    .then(() => {
      if (isAddop(token)) {
        return clear();
      } else {
        return term();
      }
    })
    .then(() => {
      return expressionTail();
    });
}

function compareExpression() {
  return expression()
    .then(() => {
      return popCompare();
    });
}

function nextExpression() {
  return next()
    .then(() => {
      return compareExpression();
    });
}

function doIf() {
  let label1, label2;
  return next()
    .then(() => {
      boolExpression()
    })
    .then(() => {
      label1 = newLabel();
      label2 = label1;
      return branchFalse(label1);
    })
    .then(() => {
      return next();
    })
    .then(() => {
      return block();
    })
    .then(() => {
      if (token === 'l') {
        return q()
          .then(() => {
            label2 = newLabel();
            return branch(label2);
          })
          .then(() => {
            return postLabel(label1);
          })
          .then(() => {
            return block();
          });
      }
    })
    .then(() => {
      return postLabel(label2);
    })
    .then(() => {
      return matchString('ENDIF');
    });
}

function doWhile() {
  let label1, label2;
  return q()
    .then(() => {
      return next();
    }).then(() => {
      label1 = newLabel();
      label2 = newLabel();
      return postLabel(label1);
    })
    .then(() => {
      return boolExpression();
    })
    .then(() => {
      return branchFalse(label2);
    })
    .then(() => {
      return block();
    })
    .then(() => {
      return matchString('ENDWHILE');
    })
    .then(() => {
      return branch(label1);
    })
    .then(() => {
      return postLabel(label2);
    });
}

function readVar() {
  checkIdent();
  checkTable(value);
  return readIt(value)
    .then(() => {
      return next();
    });
}

function doRead() {
  function varListTail() {
    if (token === ',') {
      return next()
        .then(() => {
          return readVar();
        })
        .then(() => {
          return varListTail();
        });
    }
  }

  return next()
    .then(() => {
      return matchString('(');
    })
    .then(() => {
      return readVar();
    })
    .then(() => {
      return varListTail();
    })
    .then(() => {
      return matchString(')');
    });
}

function doWrite() {
  function writeListTail() {
    if (token === ',') {
      return next()
        .then(() => {
          return expression();
        })
        .then(() => {
          return writeIt();
        })
        .then(() => {
          return writeListTail();
        });
    }
  }
  return next()
    .then(() => {
      return matchString('(');
    })
    .then(() => {
      return expression();
    })
    .then(() => {
      return writeIt();
    })
    .then(() => {
      return writeListTail();
    })
    .then(() => {
      return matchString(')');
    });
}

function skipWhite() {
  return q()
    .then(() => {
      let nextChar = look();
      if (isWhite(nextChar)) {
        return q()
          .then(() => {
            if (nextChar === '{') {
              return skipComment();
            } else {
              return getChar();
            }
          })
          .then(() => {
            return skipWhite();
          });
      }
    });
}

function skipComment() {
  function skipUntilCloseBrace() {
    let nextChar = look();
    if (nextChar !== '}') {
      return getChar()
        .then(() => {
          let nextChar = look();
          if (nextChar === '{') {
            return skipComment();
          }
        })
        .then(() => {
          return skipUntilCloseBrace();
        });
    }
  }

  return skipUntilCloseBrace()
    .then(() => {
      return getChar();
    });

}

function newLine() {
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
          })
          .then(() => {
            return skipWhite();
          })
          .then(() => {
            return newLine();
          });
      } else {
        if (nextChar === LF) {
          return getChar()
            .then(() => {
              return skipWhite();
            })
            .then(() => {
              return newLine();
            });
        }
      }
    });
}

function semi() {
  if (token === ';') {
    return next();
  }
}

init()
  .then(() => {
    return matchString('PROGRAM');
  })
  .then(() => {
    return semi();
  })
  .then(() => {
    return header();
  })
  .then(() => {
    return topDecls();
  })
  .then(() => {
    return matchString('BEGIN');
  })
  .then(() => {
    return prolog();
  })
  .then(() => {
    return block();
  })
  .then(() => {
    return matchString('END');
  })
  .then(() => {
    return epilog();
  })
  .catch((err) => {
    console.log(err.stack);
  });

process.on('uncaughtException', function(err) {
  console.log(err.stack);
});
