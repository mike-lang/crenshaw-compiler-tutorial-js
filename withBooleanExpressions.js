'use strict';

const cradle = require('./cradle'),
  q = require('q');

const look = cradle.look,
  expected = cradle.expected,
  getName = cradle.getName,
  getChar = cradle.getChar,
  getNum = cradle.getNum,
  init = cradle.init,
  emitLn = cradle.emitLn,
  match = cradle.match,
  isAlpha = cradle.isAlpha;


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
  function boolTermInner() {
    let nextChar = look();
    if (nextChar === '&') {
      emitLn('MOVE D0,-(SP)');
      return match('&')
        .then(() => {
          return notFactor();
        })
        .then(() => {
          emitLn('AND (SP)+,D0');
          return boolTermInner();
        });
    }
  }
  return notFactor()
    .then(() => {
      return boolTermInner();
    });
}


function boolFactor() {
  let nextChar = look();
  if (isBoolean(nextChar)) {
    return getBoolean()
      .then((myBool) => {
        if (myBool) {
          emitLn('MOVE #-1,D0')
        } else {
          emitLn('CLR D0');
        }
      });
  } else {
    return relation();
  }
}

function notFactor() {
  let nextChar = look();

  if (nextChar === '!') {
    return match('!')
      .then(() => {
        return boolFactor();
      })
      .then(() => {
        emitLn('EOR #-1,D0');
      });
  } else {
    return boolFactor();
  }
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

function isRelOp(c) {
  return c === '=' || c === '#' || c === '<' || c === '>';
}

function equals() {
  return match('=')
    .then(() => {
      return expression();
    })
    .then(() => {
      emitLn('CMP (SP)+,D0');
      emitLn('SEQ D0');
    });
}

function notEquals() {
  return match('#')
    .then(() => {
      return expression();
    })
    .then(() => {
      emitLn('CMP (SP)+,D0');
      emitLn('SNE D0');
    });
}

function less() {
  return match('<')
    .then(() => {
      return expression();
    })
    .then(() => {
      emitLn('CMP (SP)+,D0');
      emitLn('SGE D0');
    });
}

function greater() {
  return match('>')
    .then(() => {
      return expression();
    })
    .then(() => {
      emitLn('CMP (SP)+,D0');
      emitLn('SLE D0');
    });
}

function relation() {
  return expression()
    .then(() => {
      let nextChar = look();
      if (isRelOp(nextChar)) {
        emitLn('MOVE D0,-(SP)');
        let nextStep;
        switch(nextChar) {
          case '=':
            nextStep = equals;
            break;
          case '#':
            nextStep = notEquals;
            break;
          case '<':
            nextStep = less;
            break;
          case '>':
            nextStep = greater;
            break;
        }
        return nextStep()
          .then(() => {
            emitLn('TST D0');
          });
      }
    });
}

function expression() {
  let nextChar = look();
  return q()
    .then(() => {
      if (isAddOp(nextChar)) {
        emitLn('CLR D0')
      } else {
        return term();
      }
    })
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

function isAddOp(c) {
  return (c === '+' || c === '-')
}

function term() {
  return factor()
    .then(() => {
      return termTail();
    });
}

function divide() {
  return match('/')
    .then(() => {
      return factor()
    })
    .then(() => {
      emitLn('MOVE (SP)+,D1');
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
      emitLn('DIVS D1,D0');
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




init()
  .then(() => {
    return boolExpression();
  })
  .then(() => {
    emitLn('END START');
  })
  .catch((err) => {
    console.log(err.stack);
  })
