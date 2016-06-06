'use strict';

const q = require('q');

const TAB = '\t';

let look;
exports.look = function() {
  return look;
};

function getChar() {
  const stdin = process.stdin;
  const deferred = q.defer();

  stdin.setRawMode(true);
  stdin.resume();
  stdin.once('data', function(c) {
    if ( c.toString() === '\u0003' ) {
      process.exit();
    }
    stdin.pause();
    stdin.setRawMode(false);
    look = c.toString();
    stdin.removeAllListeners('error');
    return deferred.resolve();
  });
  stdin.once('error', function(err) {
    return deferred.reject(err);
  });

  return deferred.promise;
}
exports.getChar = getChar;

function error(err) {
  console.log('\nError: ' + err + '.');
  console.log(new Error().stack);
}
exports.error = error;

function abort(err) {
  error(err);
  process.exit(1);
}
exports.abort = abort;

function expected(s) {
  abort(s + ' Expected');
}
exports.expected = expected;

function match(x) {
  if (look !== x) expected(`''` + x + `''`);
  else {
    return getChar()
      .then(() => {
        return skipWhite();
      });
  }
}

exports.match = match;

function isAlpha(c) {
  return !!c.match(/[a-zA-Z]/);
}
exports.isAlpha = isAlpha;

function isDigit(c) {
  return !!c.match(/\d/);
}
exports.isDigit = isDigit;

function isAlNum(c) {
  return isAlpha(c) || isDigit(c);
}
exports.isAlNum = isAlNum;

function isWhite(c) {
  return c === ' ' || c === TAB;
}
exports.isWhite = isWhite;

function skipWhite() {
  return q()
    .then(() => {
      if (isWhite(look)) {
        return getChar()
          .then(() => {
            return skipWhite();
          });
      }
    });
}

function getNameInner(token) {
  let nextChar = look;
  if (isAlNum(nextChar)) {
    token = token + nextChar.toUpperCase();
    return getChar()
      .then(() => {
        return getNameInner(token);
      });
  } else {
    return token;
  }
}

function getName() {
  if (!isAlpha(look)) expected('Name');
  return q()
    .then(() => {
      return getNameInner('')
        .then((name) => {
          return skipWhite().thenResolve(name);
        });
    });
}
exports.getName = getName;

function getNumInner(value) {
  let nextChar = look;
  if (isDigit(nextChar)) {
    value = value + nextChar;
    return getChar()
      .then(() => {
        return getNumInner(value);
      });
  } else {
    return value;
  }
}

function getNum() {
  if (!isDigit(look)) expected('Integer');
  return q()
    .then(() => {
      return getNumInner('')
        .then((number) => {
          return skipWhite().thenResolve(number);
        });
    });
}
exports.getNum = getNum;


function emit(s) {
  process.stdout.write(TAB + s);
}
exports.emit = emit;


function asmHeader() {
  // This next line came from the EASy68K boilerplate
  // look up what it means
  emitLn('ORG\t$1000'); 
  label('START');
}
function label(s) {
  process.stdout.write(s + ':\n');
}

function emitLn(s) {
  emit(s);
  process.stdout.write('\n');
}
exports.emitLn = emitLn;

function simHalt() {
  emitLn('SIMHALT');
}

function asmFooter() {
  emitLn('END\tSTART');
}

function init() {
  asmHeader();
  return getChar()
    .then(() => {
      return skipWhite();
    });
}
exports.init = init;

function finish() {
  asmFooter();
}
exports.finish = finish;

/** skeletal main program */
function main() {
  return init()
    .then(() => {
    });
}
