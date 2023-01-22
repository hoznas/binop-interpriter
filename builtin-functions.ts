import { evalNode, evalStr } from './evaluator';
import { IoObject, Method, NIL, Str } from './object';
import { Slot } from './slot';

/*
class BuiltinFunction extends IoObject{
  name: string
  func: Function
  constructor(name: string, func: Function){
    super()
    this.name = name
    this.func = func

  }
  str(): string{
    return this.name
  }
  compare(other: IoObject): Number{
    if(other instanceof BuiltinFunction && this.name == other.name){
      return 0
    }
    return -1
  }
}
*/

/* TODO
evalNode
macro
throw/catch
print
*/

export const IF = function (args: IoObject[], env: Slot): IoObject {
  const [cond, trueCase, falseCase] = args;
  if (evalNode(cond, env) !== NIL) return evalNode(trueCase, env);
  else if (falseCase) return evalNode(falseCase, env);
  else return NIL;
};

export const FUN = function (args: IoObject[], env: Slot): IoObject {
  return new Method(args, env);
};

export const EVAL_STR = function (args: IoObject[], env: Slot): IoObject {
  if (args[0] instanceof Str) {
    return evalStr(args[0].value);
  }
  throw 'ERROR EVAL_STR()';
};
