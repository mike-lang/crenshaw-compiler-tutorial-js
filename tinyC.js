'use strict';

const cradle = require('./cradle');

const look = cradle.look,
  init = cradle.init,
  getChar = cradle.getChar,
  expected = cradle.expected;

const CTRLZ = String.fromCharCode(122);

function parseUntilCtrlZ() {
  return q()
    .then(() => {
      let nextChar = look();
      if (nextChar !== CTRLZ) {
        return getClass()
          .then(() => {
            return getType();
          })
          .then(() => {
            return topDecl();
          })
          .then(() => {
            return parseUntilCtrlZ();
          });
      }
    });
}

let storageClass = '';

function getClass() {
  return q()
    .then(() => {
      let nextChar = look();
      if (nextChar === 'a' || nextChar === 'x' || nextChar === 's') {
        storageClass = nextChar;
        return getChar();
      } else {
        storageClass = 'a';
      }
    });
}

let sign = '';
let typ = '';

function getType() {
  return q() 
    .then(() => {
      typ = ' ';
      let nextChar = look();
      if (nextChar === 'u') {
        sign = 'u';
        typ = 'i';
        return getChar();
      } else {
        sign = 's';
      }
    })
    .then(() => {
      let nextChar = look();
      if (nextChar === 'i' || nextChar === 'l' || nextChar === 'c') {
        typ = nextChar;
        return getChar();
      }
    });
}

function topDecl() {
  return getName() 
    .then((name) => {
      let nextChar = look();
      if (nextChar === '(') {
        return doFunc(name);
      } else {
        return doData(name);
      }
    });
}

function doFunc(name) {
  return match('(')
    .then(() => {
      return match(')');
    })
    .then(() => {
      return match('{');
    })
    .then(() => {
      return match('}');
    })
    .then(() => {
      if (typ === ' ') {
        typ = 'i';
      }
      console.log(storageClass + ' ' + sign + ' ' + typ + ' function ' + name);
    });
}

function doData(name) {
  function doDataTail() {
    // the data declaration might be an artibtrarily long list
    // Handle that here if we encounter commas
    let nextChar = look();
    if (nextChar === ',') {
      return match(',')
        .then(() => {
          return getName();
        })
        .then((nextName) => {
          console.log(storageClass + ' ' + sign + ' ' + typ + ' data ' + nextName);
          return doDataTail();
        });
    }
  }
  if (typ === ' ') {
    expected('Type declaration');
  }
  console.log(storageClass + ' ' + sign + ' ' + typ + ' data ' + name);
  return doDataTail()
    .then(() => {
      return match(';');
    });
}

init()
  .then(() => {
    return parseUntilCtrlZ();
  });
 


