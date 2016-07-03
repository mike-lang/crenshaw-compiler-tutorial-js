'use strict';

const cradle = require('./cradle'),
  expressionParsing = require('./expression');


const q = require('q');

const emitLn = cradle.emitLn,
  getName = cradle.getName,
  init = cradle.init,
  look = cradle.look,
  expected = cradle.expected,
  match = cradle.match,
  abort = cradle.abort,
  expression = expressionParsing.expression,
  boolExpression = expressionParsing.boolExpression;

let labelCount = 0;

function newLabel() {
  let result = 'L' + labelCount;
  labelCount++;
  return result;
}

function postLabel(l) {
  console.log(l + ':');
}

function other() {
  return getName()
    .then((name) => {
      emitLn(name);
    });
}

function doFor() {
  let label1, label2, counterName;

  return match('f')
    .then(() => {
      label1 = newLabel();
      label2 = newLabel();
      return getName();
    })
    .then((name) => {
      counterName = name;
      return match('=');
    })
    .then(() => {
      return expression();
    })
    .then(() => {
      emitLn('SUBQ #1,D0');
      emitLn('LEA ' + counterName + '(PC),A0');
      emitLn('MOVE D0,(A0)');
      return expression();
    })
    .then(() => {
      emitLn('MOVE D0,-(SP)');
      postLabel(label1);
      emitLn('LEA ' + counterName + '(PC),A0');
      emitLn('MOVE (A0),D0');
      emitLn('ADDQ #1,D0');
      emitLn('MOVE D0,(A0)');
      emitLn('CMP (SP),D0');
      emitLn('BGT ' + label2);
      return block(label2);
    })
    .then(() => {
      return match('e');
    })
    .then(() => {
      emitLn('BRA ' + label1);
      postLabel(label2);
      emitLn('ADDQ #2,SP');
    })


}

function block(exitLabel) {
  function continueBlock() {
    return fin()
      .then(() => {
        return block(exitLabel);
      })
  };
  return q()
    .then(() => {
      const c = look();
      if (c !== 'e' && c !== 'l' && c !== 'u') {
        return fin()
          .then(() => {
            switch(c) {
              case 'i': 
                return doIf(exitLabel)
                  .then(continueBlock);
              case 'w':
                return doWhile()
                  .then(continueBlock);
              case 'p':
                return doLoop()
                  .then(continueBlock);
              case 'r':
                return doRepeat()
                  .then(continueBlock);
              case 'f':
                return doFor()
                  .then(continueBlock);
              case 'd':
                return doDo()
                  .then(continueBlock);
              case 'b': 
                return doBreak(exitLabel)
                  .then(continueBlock);
              default:
                return other()
                  .then(continueBlock);
            }
          });
      }
    });
}

function doIf(loopExitLabel) {
  let label1, label2;

  return match('i')
    .then(() => {
      label1 = newLabel();
      label2 = label1;
      return boolExpression();
    })
    .then(() => {
      emitLn('BEQ ' + label1);
      return block();
    })
    .then(() => {
      let nextChar = look();
      if (nextChar === 'l') {
        return match('l')
          .then(() => {
            label2 = newLabel();
            emitLn('BRA ' + label2);
            postLabel(label1);
            return block(loopExitLabel);
          });
      }
    }).then(() => {
      return match('e');
    })
    .then(() => {
      postLabel(label2);
    });
}

function doBreak(label) {
  return match('b')
    .then(() => {
      if (label !== '') {
        emitLn('BRA ' + label);
      } else {
        abort('No loop to break from');
      }
    });
}

function doWhile() {
  let label1, label2;

  return match('w')
    .then(() => {
      label1 = newLabel();
      label2 = newLabel();
      postLabel(label1);
      return boolExpression();
    })
    .then(() => {
      emitLn('BEQ ' + label2);
      return block(label2);
    })
    .then(() => {
      return match('e');
    })
    .then(() => {
      emitLn('BRA ' + label1);
      postLabel(label2);
    });
}

function doLoop() {
  let label1, label2;
  return match('p')
    .then(() => {
      label1 = newLabel();
      label2 = newLabel();
      postLabel(label1);
      return block(label2);
    })
    .then(() => {
      return match('e');
    })
    .then(() => {
      emitLn('BRA ' + label1);
      postLabel(label2);
    });
}

function doRepeat() {
  let label1, label2;
  return match('r')
    .then(() => {
      label1 = newLabel();
      label2 = newLabel();
      postLabel(label1);
      return block(label2);
    })
    .then(() => {
      return match('u');
    })
    .then(() => {
      return boolExpression();
    })
    .then(() => {
      emitLn('BEQ ' + label1);
      postLabel(label2);
    });
}

function doDo() {
  let label1, label2;
  return match('d')
    .then(() => {
      label1 = newLabel();
      label2 = newLabel();
      return expression();
    })
    .then(() => {
      emitLn('SUBQ #1,D0');
      postLabel(label1);
      emitLn('MOVE D0,-(SP)');
      return block(label2);
    })
    .then(() => {
      emitLn('MOVE (SP)+,D0');
      emitLn('DBRA D0,' + label);
      emitLn('SUBQ #2,SP');
      postLabel(label2);
      emitLn('ADDQ #2,SP');
    });
}

function doProgram() {
  return block('')
    .then(() => {
      const c = look();
      if (c !== 'e') return expected('End');
      emitLn('END');
    });
}

function fin() {
  return q()
    .then(() => {
      let nextChar = look();
      if (nextChar === '\r') 
        return getChar();
    })
    .then(() => {
      let nextChar = look();
      if (nextChar === '\n')
        return getChar();
    });
}

function assignment() {
  // Somewhere we need to generate DS directives
  // for this to work with the EASy68K assembler.
  // Leaving this as an exercise for now to collect variables
  // and collect generated code in a buffer so that
  // the appropriate header with symbol definitions
  // is put before the code in the results emitted
  // on stdout
  return getName()
    .then((name) => {
      return match('=')
        .then(() => {
          return boolExpression()
            .then(() => {
              emitLn('LEA ' + name + '(PC),A0');
              emitLn('MOVE D0,(A0)');
            });
        });
    });
}


init()
  .then(() => {
    return doProgram();
  })
  .catch((err) => {
    console.log(err.stack);
  });
