'use strict'

const q = require('q');

const cradle = require('./cradle');

const match = cradle.match,
  emitLn = cradle.emitLn,
  look = cradle.look,
  abort = cradle.abort,
  getChar = cradle.getChar,
  getName = cradle.getName,
  getNum = cradle.getNum;


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

function topDecls() {
  let nextChar = look();
  if (nextChar !== 'b') {
    return q()
      .then(() => {
        switch (nextChar) {
          case 'v': 
            return decl();
          default:
            abort(`Unrecognized keyword '${nextChar}'`);
        }
      })
      .then(() => {
        return topDecls();
      });
  }
}

function decl() {
  function varlistTail() {
    let nextChar = look();
    if (nextChar === ',') {
      return getChar()
        .then(() => {
          return getName();
        })
        .then((name) => {
          return alloc(name);
        })
        .then(() => {
          return varlistTail();
        });
    }
  }

  return match('v')
    .then(() => {
      return getName();
    })
    .then((name) => {
      return alloc(name);
    })
    .then(() => {
      return varlistTail();
    });
}

function alloc(name) {
  function emitCode(initialValue) {
    console.log(`${name}:\tDC ${initialValue}`);
  }
  return q()
    .then(() => {
      let nextChar = look();
      if (nextChar === '=') {
        return match('=')
          .then(() => {
            return getNum();
          })
          .then((num) => {
            emitCode(num);
          });
      } else {
        emitCode(0);
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

