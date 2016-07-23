'use strict';

const q = require('q');

const TAB = '\t';

const util = require('util');

let look;
exports.look = function() {
  return look;
};

let programText = '',
  inputConsumed = false;

function getChar() {
  const stdin = process.stdin;

  if (stdin.isTTY) {
    // If STDIN is attached to a terminal,
    // we can switch to raw mode and consume
    // characters one at a time as follows.
    //
    // Otherwise, we'll stream everything to a
    // buffer than then character by character
    // iterate over the buffer.
    const deferred = q.defer();
    stdin.setRawMode(true);
    stdin.resume();
    stdin.once('data', function(c) {
      if ( c.toString() === '\u0003' ) {
        process.exit();
      }
      stdin.pause();
      look = c.toString();

      stdin.removeAllListeners('error');
      return deferred.resolve();
    });
    stdin.once('error', function(err) {
      return deferred.reject(err);
    });

    return deferred.promise;
  } else {
    var deferred = q.defer();
    if (!inputConsumed) {
      stdin.on('readable', function () {
        let readData = stdin.read();

        if (readData) {
          programText += readData.toString();
        }
      });
      stdin.on('end', function() {
        inputConsumed = true;
        if (!programText.length) {
          process.exit();
        }
        look = programText[0];
        programText = programText.slice(1);
        deferred.resolve();
      });
    } else {
      if (!programText.length) {
        process.exit();
      }
      look = programText[0];
      programText = programText.slice(1);
      deferred.resolve();
    }
    return deferred.promise;
  }
}
exports.getChar = getChar;

function error(err) {
  console.log('\nError: ' + err + '.');
  console.log(new Error().stack);
  throw new Error(err);
}
exports.error = error;

function abort(err) {
  error(err);
  //process.exit(1);
}
exports.abort = abort;

function expected(s) {
  abort(s + ' Expected');
}
exports.expected = expected;

function match(x) {
  if (look === x) return getChar();
  else expected(`''` + x + `''`);
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

function getName() {
  if (!isAlpha(look)) expected('Name');
  let result = look.toUpperCase();
  return getChar().thenResolve(result);
}
exports.getName = getName;

function getNum() {
  if (!isDigit(look)) expected('Integer');
  let result = look;
  return getChar().thenResolve(result);
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
  return getChar();
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
