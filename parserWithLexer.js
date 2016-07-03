'use strict';

const q = require('q'),
  util = require('util');

const cradle = require('./cradle');

const isAlpha = cradle.isAlpha,
  isDigit = cradle.isDigit,
  look = cradle.look,
  getChar = cradle.getChar,
  expected = cradle.expected,
  init = cradle.init,
  emitLn = cradle.emitLn;

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

function getName() {

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

  return eatCRs()
    .then(() => {
      let nextChar = look();
      if (!isAlpha(nextChar)) {
        expected('Name');
      }
      return getNameInner();
    })
    .then(() => {
      return skipWhite();
    })
    .then(() => {
      return whileState.x;
    });
}


function getNum() {
  let scanResult = {
    value: ''
  };
  function getNumInner() {
    let nextChar = look();
    if (isDigit(nextChar)) {
      scanResult.value = scanResult.value + nextChar;
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
      scanResult.token = NUMBER;
      return scanResult;
    });
}

function scan() {
  return getName()
    .then((name) => {
      return {
        token: lookup(name),
        value: name
      }
    });
}

function matchString(s, tokenValue) {
  if ( s !== tokenValue) {
    expected(`'${s}'`);
  }
}

function newLabel() {
  let result = 'L' + labelCount;
  labelCount++;
  return result;
}

function postLabel(l) {
  console.log(l + ':');
}

function ident() {
  return getName()
    .then((name) => {
      let nextChar = look();
      if (nextChar === '(') {
        return match('(')
          .then(() => {
            return match(')');
          })
          .then(() => {
            emitLn('BSR ' + name);
          });
      } else {
        emitLn('MOVE ' + name + '(PC),D0');
      }
    });
}

function factor() {
  let nextChar = look();
  if (nextChar === '(') {
    return match('(')
      .then(() => {
        return expression();
      })
      .then(() => {
        return match(')');
      });
  } else if (isAlpha(nextChar)) {
    return ident();
  } else {
    return getNum()
      .then((num) => {
        emitLn('MOVE #' + num + ',D0');
      });
  }
}

function isAddOp(c) {
  return (c === '+' || c === '-')
}

function signedFactor() {
  let nextChar = look(),
    isSigned = nextChar === '-';

  return q()
    .then(() => {
      if (isAddOp(nextChar)) {
        return getChar()
          .then(() => {
            return skipWhite();
          });
      }
    })
    .then(() => {
      return factor();
    })
    .then(() => {
      if (isSigned) {
        emitLn('NEG D0');
      }
    });
  
}

function multiply() {
  return match('*')
    .then(() => {
      return factor()
    })
    .then(() => {
      emitLn('MULS (SP)+,D0');
    });
}

function divide() {
  return match('/')
    .then(() => {
      return factor()
    })
    .then(() => {
      emitLn('MOVE (SP)+,D1');
      emitLn('EXT.L D0');
      emitLn('DIVS D1,D0');
    });
}

function termTail() {
  let nextChar = look();
  if (nextChar === '*' || nextChar === '/') {
    emitLn('MOVE D0,-(SP)');
    return q()
      .then(() => {
        let nextChar = look();
        switch(nextChar) {
          case '*':
            return multiply();
          case '/':
            return divide();
        }
      })
      .then(() => {
        return termTail();
      });
  } else {
    return;
  }
}

function term() {
  return factor()
    .then(() => {
      return termTail();
    });
}

function firstTerm() {
  return signedFactor()
    .then(() => {
      return termTail();
    });
}

function add() {
  return match('+')
    .then(() => {
      return term();
    })
    .then(() => {
      emitLn('ADD (SP)+,D0');
    });
}

function subtract() {
  return match('-')
    .then(() => {
      return term()
    })
    .then(() => {
      emitLn('SUB (SP)+,D0');
      emitLn('NEG D0');
    });
}

function expression() {
  return firstTerm()
    .then(() => {
      return expressionTail();
    });
}

function expressionTail() {
  let nextChar = look();
  if (isAddOp(nextChar)) {
    emitLn('MOVE D0,-(SP)');
    return q()
      .then(() => {
        let nextChar = look();
        switch(nextChar) {
          case '+':
            return add();
          case '-':
            return subtract();
        }
      })
      .then(() => {
        return expressionTail();
      });
  } else {
    return;
  }
}

function condition() {
  emitLn('Condition');
}

function doIf(loopExitLabel) {
  let label1, label2;

  return match('i')
    .then(() => {
      label1 = newLabel();
      label2 = label1;
      return boolExpression();
    })
    .then(() => {
      emitLn('BEQ ' + label1);
      return block();
    })
    .then(() => {
      let nextChar = look();
      if (nextChar === 'l') {
        return match('l')
          .then(() => {
            label2 = newLabel();
            emitLn('BRA ' + label2);
            postLabel(label1);
            return block(loopExitLabel);
          });
      }
    }).then(() => {
      return match('e');
    })
    .then(() => {
      postLabel(label2);
    });
}

function assignment() {
  // Somewhere we need to generate DS directives
  // for this to work with the EASy68K assembler.
  // Leaving this as an exercise for now to collect variables
  // and collect generated code in a buffer so that
  // the appropriate header with symbol definitions
  // is put before the code in the results emitted
  // on stdout
  return getName()
    .then((name) => {
      return match('=')
        .then(() => {
          return boolExpression()
            .then(() => {
              emitLn('LEA ' + name + '(PC),A0');
              emitLn('MOVE D0,(A0)');
            });
        });
    });
}

function block(exitLabel) {
  function continueBlock() {
    return fin()
      .then(() => {
        return block(exitLabel);
      })
  };
  return q()
    .then(() => {
      const scanResult = scan();
      if (scanResult.token !== ENDIF && scanResult.token !== ELSE && scanResult.token !== END) {
        return fin()
          .then(() => {
            switch(c) {
              case 'i': 
                return doIf(exitLabel)
                  .then(continueBlock);
              default:
                return assignment()
                  .then(continueBlock);
            }
          });
      }
    });
}

function doProgram() {
  return block()
    .then((
}

