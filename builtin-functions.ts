import { evalNode, evalStr } from './evaluator';
import { Memory } from './memory';
import { Fun, IoObject, Macro, Message, NIL, Str } from './object';

export const IF = function (args: IoObject[], env: Memory): IoObject {
  const [cond, trueCase, falseCase] = args;
  if (evalNode(cond, env) !== NIL) return evalNode(trueCase, env);
  else if (falseCase) return evalNode(falseCase, env);
  else return NIL;
};

export const FUN = function (args: IoObject[], env: Memory): IoObject {
  return new Fun(args, env);
};
export const MACRO = function (args: IoObject[], env: Memory): IoObject {
  return new Macro(args);
};

export const MESSAGE = function (args: IoObject[], env: Memory): IoObject {
  if (args.length >= 2 && args[0] instanceof Str) {
    const type = args[0].value;
    if (type == '__' && args.length === 2 && args[1] instanceof Str) {
      return new Message(undefined, args[1].value, undefined);
    } else if (type === '_@' && args[1] instanceof Str) {
      return new Message(undefined, args[1].value, args.slice(2, args.length));
    } else if (type === '@_' && args.length === 3 && args[2] instanceof Str) {
      return new Message(args[1], args[2].value, undefined);
    } else if (type === '@@' && args[2] instanceof Str) {
      return new Message(args[1], args[2].value, args.slice(3, args.length));
    }
  }
  throw `ERROR MESSAGE(${args
    .map((e) => {
      e.str();
    })
    .join(',')})`;
};
export const EVAL_NODE = function (args: IoObject[], env: Memory): IoObject {
  return evalNode(evalNode(args[0], env), env);
};

export const EVAL_STR = function (args: IoObject[], env: Memory): IoObject {
  if (args[0] instanceof Str) {
    return evalStr(args[0].value, env);
  }
  throw `ERROR EVAL_STR(${args[0]})`;
};
