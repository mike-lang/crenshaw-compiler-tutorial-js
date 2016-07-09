'use strict'

const cradle = require('./cradle');

const match = cradle.match,
  emitLn = cradle.emitLn,
  look = cradle.look,
  abort = cradle.abort,
  getChar = cradle.getChar;

const CR = '\r';

function init() {
  return getChar();
}

function postLabel(l) {
  console.log(l + ':');
}


function prog() {
  return match('p')
    .then(() => {
      return header();
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
  return match('b')
    .then(() => {
      return prolog();
    })
    .then(() => {
      return match('e');
    })
    .then(() => {
      return epilog();
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
  });

