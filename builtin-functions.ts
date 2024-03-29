import { evalNode, evalStr } from './evaluator';
import { Memory } from './memory';
import { BoObject, Fun, Macro, Message, NIL, Str } from './object';

type FuncType = (
  receiver: BoObject | undefined,
  args: BoObject[],
  env: Memory
) => BoObject;

export class BuiltinFunction extends BoObject {
  constructor(public name: string, public fun: FuncType) {
    super();
  }
  call(
    receiver: BoObject | undefined,
    args: BoObject[],
    env: Memory
  ): BoObject {
    return this.fun(receiver, args, env);
  }
  str(): string {
    return this.name;
  }
}

export const IF = new BuiltinFunction(
  'if',
  (
    _receiver: BoObject | undefined,
    args: BoObject[],
    env: Memory
  ): BoObject => {
    if (args.length === 3 || args.length === 2) {
      const [cond, trueCase, falseCase] = args;
      if (evalNode(cond, env) !== NIL) return evalNode(trueCase, env);
      else if (falseCase) return evalNode(falseCase, env);
      else return NIL;
    }
    throw new Error(`ERROR if(args.len === ${args})  arg length error`);
  }
);

export const FUN = new BuiltinFunction(
  'fun',
  (
    _receiver: BoObject | undefined,
    args: BoObject[],
    env: Memory
  ): BoObject => {
    if (args?.length >= 1) return new Fun(args, env);
    throw new Error(`ERROR fun(args.len===${args?.length}) arg length error`);
  }
);

export const MACRO = new BuiltinFunction(
  'macro',
  (
    _receiver: BoObject | undefined,
    args: BoObject[],
    env: Memory
  ): BoObject => {
    if (args.length >= 1) return new Macro(args);
    throw new Error(`ERROR macro(args.len===${args.length}) arg length error`);
  }
);

export const MESSAGE = new BuiltinFunction(
  'message',
  (
    _receiver: BoObject | undefined,
    args: BoObject[],
    env: Memory
  ): BoObject => {
    if (args.length >= 2 && args[0] instanceof Str) {
      const type = args[0].value;
      if (type == '__' && args.length === 2 && args[1] instanceof Str) {
        return new Message(undefined, args[1].value, undefined);
      } else if (type === '_@' && args[1] instanceof Str) {
        return new Message(
          undefined,
          args[1].value,
          args.slice(2, args.length)
        );
      } else if (type === '@_' && args.length === 3 && args[2] instanceof Str) {
        return new Message(args[1], args[2].value, undefined);
      } else if (type === '@@' && args[2] instanceof Str) {
        return new Message(args[1], args[2].value, args.slice(3, args.length));
      }
    }
    throw new Error(
      `ERROR MESSAGE(${args
        .map((e) => {
          e.str();
        })
        .join(',')})`
    );
  }
);

export const EVAL_NODE = new BuiltinFunction(
  'evalNode',
  (
    _receiver: BoObject | undefined,
    args: BoObject[],
    env: Memory
  ): BoObject => {
    if (args.length === 1) return evalNode(evalNode(args[0], env), env);
    throw new Error(
      `ERROR evalNode(args.len===${args.length}) arg length error`
    );
  }
);

export const EVAL_STR = new BuiltinFunction(
  'evalStr',
  (
    _receiver: BoObject | undefined,
    args: BoObject[],
    env: Memory
  ): BoObject => {
    if (args.length === 1 && args[0] instanceof Str) {
      return evalStr(args[0].value, env);
    }
    throw new Error(
      `ERROR evalStr(args.len===${args.length}) arg length error`
    );
  }
);
/*
export const PRINT = new BuiltinFunction(
  'print',
  (receiver: BoObject | undefined, args: BoObject[], env: Memory): BoObject => {
    if (receiver && args?.length === 0) {
      const result = evalNode(receiver, env);
      console.log(result.str());
      return result;
    }
    throw new Error(`ERROR PRINT(args.len===${args.length}) arg length error`);
  }
);
*/
