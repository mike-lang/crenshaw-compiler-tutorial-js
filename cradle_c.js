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

function getNumInner(value) {

  if(isDigit(look)) {
    return getChar()
      .thenResolve(10 * value + parseInt(look, 10))
      .then((result) => {
        return getNumInner(result);
      });
  }
  return value;
}
function getNum() {
  if (!isDigit(look)) expected('Integer');
  return getNumInner(0);
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
