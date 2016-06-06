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
                    return getNum();
                  })
                  .then((num) => {
                    return value + num;
                  });
              case '-':
                return match('-')
                  .then(() => {
                    return getNum();
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
        return getNum();
      }
    })
    .then((value) => {
      return expressionInner(value);
    })
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
