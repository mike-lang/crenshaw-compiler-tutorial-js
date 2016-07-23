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
  'ENDWHILE', 'VAR', 'BEGIN', 'END', 'PROGRAM'];

const KWCode = 'xilewevbep';



function lookup(s) {
  return KWList.indexOf(s) + 1;
}


function expected(s, a) {
  abort(`"${s}" Expected, instead saw "${a}"`);
}

function scan() {
  return getName()
    .then(() => {
      token = KWCode[lookup(value)];
    });
}

function matchString(x) {
  return q()
    .then(() => {
      if (value !== x) {
        expected(`'${x}'`, value);
      }
    });
}

function isAlNum(c) {
  return isAlpha(c) || isDigit(c);
}

function isWhite(c) {
  return c === ' ' || c === TAB;
}

function getName() {
  function gatherAlNum() {
    let nextChar = look();
    if (isAlNum(nextChar)) {
      value = value + nextChar.toUpperCase();
      return getChar()
        .then(() => {
          return gatherAlNum();
        });
    }
  }

  return newLine()
    .then(() => {
      let nextChar = look();
      if (!isAlpha(nextChar)) expected('Name', nextChar);
      value = '';
      return gatherAlNum();
    })
    .then(() => {
      return skipWhite();
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
  function getNumTail(value) {
    let nextChar = look();
    if (isDigit(nextChar)) {
      value = 10 * value + parseInt(nextChar, 10);
      return getChar()
        .then(() => {
          return getNumTail(value);
        });
    } else {
      return value;
    }
  }
  return newLine()
    .then(() => {
      let nextChar = look();
    
      if (!isDigit(nextChar)) {
        expected('Integer', nextChar);
      }
    
      return getNumTail(0);
    })
    .then((number) => {
      return skipWhite()
        .thenResolve(number);
    });

}


function init() {
  return getChar()
    .then(() => {
      return scan();
    });
}

function postLabel(l) {
  console.log(l + ':');
}


function prog() {
  return matchString('PROGRAM')
    .then(() => {
      return header();
    })
    .then(() => {
      return topDecls();
    })
    .then(() => {
      return main();
    })
    .then(() => {
      return match('.');
    });
}

function header() {
  console.log('WARMST\tEQU $A01E');
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
    if (token !== 'b') {
      return q()
        .then(() => {
          switch(token) {
            case 'v': return decl();
            default: abort('Unrecognized Keyword ' + value);
          }
        })
        .then(() => {
          return scan();
        })
        .then(() => {
          return topDeclsTail();
        });
    }
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

function alloc(name) {
  function emitCode(initialValue) {
    console.log(`${name}:\tDC ${initialValue}`);
  }

  if (inTable(name)) {
    abort('Duplicate Variable Name ' + name);
  }

  addEntry(name, 'v');

  let isNegative = false;

  symbolTable[name] = 'v';

  return q()
    .then(() => {
      let nextChar = look();
      if (nextChar === '=') {
        return match('=')
          .then(() => {
            let nextChar = look();
            if (nextChar === '-') {
              isNegative = true;
              return match('-');
            }
          }).then(() => {
            return getNum();
          })
          .then((num) => {
            emitCode(num * (isNegative ? -1 : 1));
          });
      } else {
        emitCode(0);
      }
    });

}

function inTable(name) {
  return symbolTable[name] !== undefined;
}

function addEntry(name, symbolType) {
  if (inTable(name)) {
    abort('Duplicate Identifier ' + name);
  }

  symbolTable[name] = symbolType;
}

function assignment() {
  return q()
    .then(() => {
      let name = value;
      return match('=')
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
            default: return assignment();
          }
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
  if (!inTable(name)) {
    undefinedVar(name);
  }
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

function equals() {
  return match('=')
    .then(() => {
      return expression();
    })
    .then(() => {
      return popCompare();
    })
    .then(() => {
      return setEqual();
    });
}

function notEquals() {
  return match('#')
    .then(() => {
      return expression();
    })
    .then(() => {
      return popCompare();
    })
    .then(() => {
      return setNEqual();
    });
}

function less() {
  return match('<')
    .then(() => {
      return expression();
    })
    .then(() => {
      return popCompare();
    })
    .then(() => {
      return setLess();
    });
}

function greater() {
  return match('>')
    .then(() => {
      return expression();
    })
    .then(() => {
      return popCompare();
    })
    .then(() => {
      return setGreater();
    });
}

function relation() {
  return expression()
    .then(() => {
      let nextChar = look();
      if (isRelop(nextChar)) {
        return q()
          .then(() => {
            return push();
          })
          .then(() => {
            switch(nextChar) {
              case '=': return equals();
              case '#': return notEquals();
              case '<': return less();
              case '>': return greater();
            }
          })
      }
    })
}

function notFactor() {
  let nextChar = look();
  if (nextChar === '!') {
    return match('!')
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
    let nextChar = look();
    if (nextChar === '&') {
      return q()
        .then(() => {
          return push();
        })
        .then(() => {
          return match('&');
        })
        .then(() => {
          return notFactor();
        })
        .then(() => {
          return popAnd();
        })
        .then(() => {
          return newLine();
        })
        .then(() => {
          return boolTermTail();
        });
    }
  }

  return newLine()
    .then(() => {
      return notFactor();
    })
    .then(() => {
      return boolTermTail();
    });
}

function boolOr() {
  return match('|')
    .then(() => {
      return boolTerm();
    })
    .then(() => {
      return popOr();
    });
}

function boolXor() {
  return match('~')
    .then(() => {
      return boolTerm();
    })
    .then(() => {
      return popXor();
    });
}

function boolExpression() {
  function boolExpressionTail() {
    let nextChar = look();
    if (isOrop(nextChar)) {
      return q()
        .then(() => {
          return push();
        })
        .then(() => {
          switch(nextChar) {
            case '|': return boolOr();
            case '~': return boolXor();
          }
        })
        .then(() => {
          return newLine();
        })
        .then(() => {
          return boolExpressionTail();
        });
    }
  }

  return newLine()
    .then(() => {
      return boolTerm();
    })
    .then(() => {
      return boolExpressionTail();
    });
}

function undefinedVar(name) {
  abort('Undefined Identifier ' + name);
}

function factor() {
  let nextChar = look();
  if (nextChar === '(') {
    return match('(')
      .then(() => {
        return boolExpression();
      })
      .then(() => {
        return match(')');
      });
  } else if (isAlpha(nextChar)) {
    return getName()
      .then(() => {
        return loadVar(value);
      });
  } else {
    return getNum()
      .then((number) => {
        return loadConst(number);
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
  return match('*')
    .then(() => {
      return factor();
    })
    .then(() => {
      return popMul();
    });
}

function divide() {
  return match('/')
    .then(() => {
      return factor();
    })
    .then(() => {
      return popDiv();
    });
}

function term1() {
  return newLine()
    .then(() => {
      let nextChar = look();
      if (isMulop(nextChar)) {
        return q()
          .then(() => {
            return push();
          })
          .then(() => {
            let nextChar = look();
            switch(nextChar) {
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
  return match('+')
    .then(() => {
      return term();
    })
    .then(() => {
      return popAdd();
    });
}

function subtract() {
  return match('-')
    .then(() => {
      return term();
    })
    .then(() => {
      return popSub();
    });
}

function expression() {
  function expressionTail() {
    let nextChar = look();
    if (isAddop(nextChar)) {
      return q()
        .then(() => {
          return push();
        })
        .then(() => {
          let nextChar = look();
          switch(nextChar) {
            case '+': return add();
            case '-': return subtract();
          }
        })
        .then(() => {
          return newLine();
        })
        .then(() => {
          return expressionTail();
        });
    }
  }

  return newLine()
    .then(() => {
      return firstTerm();
    })
    .then(() => {
      return expressionTail();
    });
}

function doIf() {
  let label1, label2;
  return boolExpression()
    .then(() => {
      label1 = newLabel();
      label2 = label1;
      return branchFalse(label1);
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

init()
  .then(() => {
    return prog();
  })
  .then(() => {
    let nextChar = look();
    if (nextChar !== CR) {
      abort(`Unexpected data after '.'`);
    }
  })
  .catch((err) => {
    console.log(err.stack);
  });


process.on('uncaughtException', function(err) {
  console.log(err.stack);
});
