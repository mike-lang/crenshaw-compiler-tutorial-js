'use strict';

const q = require('q');

const cradle = require('./cradle_c');

const getNum = cradle.getNum,
  init = cradle.init,
  look = cradle.look,
  match = cradle.match,
  table = cradle.table,
  isAlpha = cradle.isAlpha,
  getName = cradle.getName,
  getChar = cradle.getChar,
  read = cradle.read;

const CR = '\r';

process.on('unhandledException', function(err) {
  console.log(err.stack);
});



function isAddOp(c) {
  return c === '+' || c === '-';
}

function expressionInner(value) {
  let nextChar = look();
  return q()
    .then(() => {
      if (isAddOp(nextChar)) {
        return q()
          .then(() => {
            switch(nextChar) {
              case '+':
                return match('+')
                  .then(() => {
                    return term();
                  })
                  .then((num) => {
                    return value + num;
                  });
              case '-':
                return match('-')
                  .then(() => {
                    return term();
                  })
                  .then((num) => {
                    return value - num;
                  });
            }
          })
          .then((result) => {
            return expressionInner(result);
          });
      } else {
        return value;
      } 
    });
}

function expression() {
  let nextChar = look();
  let value;
  return q()
    .then(() => {
      if (isAddOp(nextChar)) {
        return 0;
      } else {
        return term();
      }
    })
    .then((value) => {
      return expressionInner(value);
    })
}

function termInner(value) {
  let nextChar = look();
  return q()
    .then(() => {
      if (nextChar === '*' || nextChar === '/') {
        return q() 
          .then(() => {
            switch(nextChar) {
              case '*':
                return match('*')
                  .then(() => {
                    return factor();
                  })
                  .then((num) => {
                    return value * num;
                  });
              case '/':
                return match('/')
                  .then(() => {
                    return factor();
                  })
                  .then((num) => {
                    return Math.floor(value / num);
                  })
            }
          })
          .then((result) => {
            return termInner(result);
          });
        } else {
          return value;
        }
    });
}

function term() {
  let value;
  return factor()
    .then((value) => {
      return termInner(value);
    });
}

function factor() {
  let nextChar = look();
  if (nextChar === '(') {
    return match('(')
      .then(() => {
        return expression();
      })
      .then((value) => {
        return match(')')
          .thenResolve(value);
      });
  } else if (isAlpha(nextChar)) {
    return getName()
      .then((name) => {
        return table[name];
      });
  } else {
    return getNum();
  }
}

function assignment() {
  return getName() 
    .then((name) => {
      return match('=')
        .then(() => {
          return expression();
        })
        .then((value) => {
          table[name] = value;
        });
    });
}

function newLine() {
  let nextChar = look();
  if (nextChar === CR) {
    return getChar();
  }
}

function mainLoop() {
  let nextChar = look();
  if (nextChar === '.') return;

  return q()
    .then(() => {
      switch(nextChar) {
        case '?': 
          return input();
        case '!':
          return output();
        default:
          return assignment()
      }
    })
    .then(() => {
      return newLine();
    })
    .then(() => {
      return mainLoop();
    });
}

function input() {
  return match('?')
    .then(() => {
      return getName()
    })
    .then((name) => {
      let nextChar = look();
      if (nextChar === CR) return q('');
      return read()
        .then((i) => {
          table[name] = parseInt(nextChar + i, 10);
        })
        .then(() => {
          return getChar();
        });
    });
}

function output() {
  return match('!')
    .then(() => {
      return getName()
        .then((name) => {
          console.log(table[name]);
        });
    });
}

init()
  .then(() => {
    return mainLoop();
  })
  .then((result) => {
//    console.log(`table['A']: ${table['A']}`);
  })
  .catch((err) => {
    console.log(err.stack);
  });
