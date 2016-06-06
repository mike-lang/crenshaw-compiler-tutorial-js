'use strict';

const q = require('q');

const cradle = require('./cradle_c');

const getNum = cradle.getNum,
  init = cradle.init,
  look = cradle.look,
  match = cradle.match;

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
  } else {
    return getNum();
  }
}

init()
  .then(() => {
    return expression();
  })
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err.stack);
  });
