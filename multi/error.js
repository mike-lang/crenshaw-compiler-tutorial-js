'use strict';


function error(err) {
  console.log('\nError: ' + err + '.');
  console.log(new Error().stack);
  throw new Error(err);
}
exports.error = error;

function expected(s) {
  error(s + ' Expected');
}
exports.expected = expected;

