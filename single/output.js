'use strict';

const TAB = '\t';

function emit(s) {
  process.stdout.write(TAB + s);
}
exports.emit = emit;

function emitLn(s) {
  emit(s);
  process.stdout.write('\n');
}
exports.emitLn = emitLn;



