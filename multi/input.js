'use strict';

const q = require('q');

let programText = '',
  inputConsumed = false,
  look;

exports.look = function() {
  return look;
}

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

exports.init = function() {
  return getChar();
}


