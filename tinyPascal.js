'use strict';

const cradle = require('./cradle');

const match = cradle.match,
  getName = cradle.getName,
  emitLn = cradle.emitLn,
  look = cradle.look;


function prog() {
  let name;
  return match('p')
    .then(() => {
      return getName();
    })
    .then((n) => {
      name = n;
      return prolog(name);
    })
    .then(() => {
      return doBlock();
    })
    .then(() => {
      return match('.');
    })
    .then(() => {
      return epilog(name);
    });
}

function prolog() {
  emitLn('WARMST EQU $A01E');
}

function epilog(name) {
  emitLn('DC WARMST');
  emitLn('END ' + name);
}

function postLabel(l) {
  console.log(l + ':');
}

function doBlock(name) {
  return declarations()
    .then(() => {
      return postLabel(name);
    })
    .then(() => {
      return statements();
    });
}

function declarations() {
  let nextChar = look();

  if (nextChar === 'l' || nextChar === 'c' || nextChar === 't' 
      || nextChar === 'v' || nextChar === 'p' || nextChar === 'f') {
    return q()
      .then(() => {
        switch(nextChar) {
          case 'l':
            return labels();
          case 'c':
            return constants();
          case 't':
            return types();
          case 'v':
            return variables();
          case 'p':
            return doProcedure();
          case 'f':
            return doFunction();
        }
      })
      .then(() => {
        return declarations();
      });
  }
}

function labels() {
  return match('l');
}

function constants() {
  return match('c');
}

function types() {
  return match('t');
}

function variables() {
  return match('v');
}

function doProcedure() {
  return match('p');
}

function doFunction() {
  return match('f');
}

function statements() {
  function statementsInner() {
    let nextChar = look();
    if (nextChar !== 'e') {
      return getChar()
        .then(() => {
          return statementsInner();
        });
    }
  }
  return match('b')
    .then(() => {
      return statementsInner();
    })
    .then(() => {
      return match('e');
    });
}
