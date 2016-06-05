'use strict';

process.on('unhandledException', function(err) {
  console.log(err.stack);
});

const cradle = require('./cradle'),
  q = require('q');

const emitLn = cradle.emitLn,
  getNum = cradle.getNum,
  getName = cradle.getName,
  init = cradle.init,
  finish = cradle.finish,
  match = cradle.match,
  look = cradle.look,
  abort = cradle.abort,
  isAlpha = cradle.isAlpha;

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

function term() {
  return factor()
    .then(() => {
      return termTail();
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
          default:
            expected('Mulop');
        }
      })
      .then(() => {
        return termTail();
      });
  } else {
    return;
  }
}

function isAddOp(c) {
  return (c === '+' || c === '-')
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
          default:
            expected('Addop');
        }
      })
      .then(() => {
        return expressionTail();
      });
  } else {
    return;
  }
}

return init()
  .then(() => {
    return expression();
  })
  .then(() => {
    return finish();
  })
  .catch((err) => {
    abort(err.stack);
  });
