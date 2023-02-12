import { evalNode, evalStr } from './evaluator';
import { Memory } from './memory';
import { BoObject, Fun, Macro, Message, NIL, Str } from './object';

export const IF = function (args: BoObject[], env: Memory): BoObject {
  if (args.length === 3 || args.length === 2) {
    const [cond, trueCase, falseCase] = args;
    if (evalNode(cond, env) !== NIL) return evalNode(trueCase, env);
    else if (falseCase) return evalNode(falseCase, env);
    else return NIL;
  }
  throw `ERROR if(args.len === ${args})  argument length error`;
};
export const FUN = function (args: BoObject[], env: Memory): BoObject {
  if (args.length >= 1) return new Fun(args, env);
  throw `ERROR fun(args.len === ${args.length})  argument length error`;
};
export const MACRO = function (args: BoObject[], env: Memory): BoObject {
  if (args.length >= 1) return new Macro(args);
  throw `ERROR macro(args.len === ${args.length})  argument length error`;
};
export const MESSAGE = function (args: BoObject[], env: Memory): BoObject {
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
export const EVAL_NODE = function (args: BoObject[], env: Memory): BoObject {
  if (args.length === 1) return evalNode(evalNode(args[0], env), env);
  throw `ERROR evalNode(args.len === ${args.length})  argument length error`;
};

export const EVAL_STR = function (args: BoObject[], env: Memory): BoObject {
  if (args.length === 1 && args[0] instanceof Str) {
    return evalStr(args[0].value, env);
  }
  throw `ERROR evalStr(args.len === ${args.length})  argument length error`;
};
