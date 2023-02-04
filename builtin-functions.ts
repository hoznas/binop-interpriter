import { evalNode, evalStr } from './evaluator';
import { Memory } from './memory';
import { Fun, IoObject, NIL, Str } from './object';

export const IF = function (args: IoObject[], env: Memory): IoObject {
  const [cond, trueCase, falseCase] = args;
  if (evalNode(cond, env) !== NIL) return evalNode(trueCase, env);
  else if (falseCase) return evalNode(falseCase, env);
  else return NIL;
};

export const FUN = function (args: IoObject[], env: Memory): IoObject {
  return new Fun(args, env);
};

export const EVAL_STR = function (args: IoObject[], env: Memory): IoObject {
  if (args[0] instanceof Str) {
    return evalStr(args[0].value, env);
  }
  throw `ERROR EVAL_STR(${args[0]})`;
};
