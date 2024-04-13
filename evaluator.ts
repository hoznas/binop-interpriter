import {
  BuiltinFunction,
  EVAL_NODE,
  EVAL_STR,
  FUN,
  MACRO,
  MESSAGE,
} from './builtin-functions';
import { Memory } from './memory';
import {
  BoObject,
  Fun,
  Macro,
  Message,
  NIL,
  Num,
  Str,
  UserObject,
} from './object';
import { parse } from './parser';
import { tokenize } from './tokenizer';

export class Evaluator {
  rootEnvironmentSlot: Memory;
  rootObjectSlot: Memory;
  constructor() {
    this.rootEnvironmentSlot = new Memory();
    this.rootObjectSlot = new Memory();
    this.rootEnvironmentSlot.define(
      'Object',
      new UserObject(this.rootObjectSlot)
    );
    this.rootEnvironmentSlot.define('nil', NIL);

    this.rootEnvironmentSlot.define('fun', FUN);
    this.rootEnvironmentSlot.define('macro', MACRO);
    this.rootEnvironmentSlot.define('evalNode', EVAL_NODE);
    this.rootEnvironmentSlot.define('evalStr', EVAL_STR);
    this.rootEnvironmentSlot.define('message', MESSAGE);
  }
  eval(code: string): BoObject {
    return evalStr(code, this.rootEnvironmentSlot);
  }
}

export const evalStr = (code: string, env: Memory): BoObject => {
  const tokens = tokenize(code);
  const node = parse(tokens);
  return evalNode(node, env);
};
export const evalNode = (node: BoObject, env: Memory): BoObject => {
  //console.log(`evalNode(${node.str()})`);
  // eval binary operator
  if (node instanceof Message && node.receiver && node.args?.length === 1) {
    // lhs/rhs => Left/Right Hand Side value
    const [lhs, op, rhs] = [node.receiver, node.slotName, node.args[0]];
    if (['+', '-', '*', '/', '%'].includes(op)) {
      return evalArithmeticOp(lhs, op, rhs, env);
    } else if (['==', '!=', '<', '<=', '>', '>='].includes(op)) {
      return evalCompareOp(lhs, op, rhs, env);
    } else if (['=', ':=', '.', ';', ',', '&&', '||'].includes(op)) {
      return evalSpecialOp(lhs, op, rhs, env);
    }
  }
  if (node instanceof Message) {
    return evalMessage(node, env);
  } else {
    // Num,Str,Nil,UserObject,Fun,Macro
    return node;
  }
};
export const evalMessage = (mes: Message, env: Memory): BoObject => {
  //console.log(`evalMessage(${mes.str()})`);
  const result = evalIfDefaultFunction(mes, env);
  if (result) return result;

  const receiver = mes.receiver ? evalNode(mes.receiver, env) : undefined;
  const f: BoObject | undefined =
    receiver && receiver instanceof UserObject
      ? receiver.get(mes.slotName)
      : env.get(mes.slotName);

  if (f instanceof Fun && mes.args) {
    return evalFunCall(receiver as UserObject, f, mes.args, env);
  } else if (f instanceof Macro && mes.args) {
    return evalMacroCall(receiver as UserObject, f, mes.args, env);
  } else if (f instanceof BuiltinFunction && mes.args) {
    return f.call(receiver, mes.args, env);
  } else if (f && !mes.args) {
    return f;
  } else {
    throw `ERROR evalMessage() => ${f} is not fun or macro`;
  }
};
const evalIfDefaultFunction = (
  mes: Message,
  env: Memory
): BoObject | undefined => {
  if (mes.receiver) {
    if (
      mes.slotName === 'if' &&
      (mes.args?.length === 1 || mes.args?.length === 2)
    ) {
      const receiver = evalNode(mes.receiver, env);
      const block = receiver !== NIL ? mes.args[0] : mes.args[1] || NIL;
      return evalNode(block, env);
    } else if (mes.slotName === 'print' && mes.args?.length === 0) {
      const result = evalNode(mes.receiver, env);
      console.log(result.str());
      return result;
    } else if (mes.slotName === 'clone' && mes.args?.length === 0) {
      return evalNode(mes.receiver, env).clone();
    }
  }
  return undefined;
};
const evalFunCall = (
  _this: UserObject | undefined,
  fun: Fun,
  args: BoObject[],
  callerEnv: Memory
): BoObject => {
  const closure = bind(
    _this,
    fun.argList,
    args.map((arg) => evalNode(arg, callerEnv)),
    fun.createdEnv.subMemory()
  );
  return evalNode(fun.body, closure);
};
const evalMacroCall = (
  _this: UserObject | undefined,
  macro: Macro,
  args: BoObject[],
  callerEnv: Memory
): BoObject => {
  const closure = bind(_this, macro.argList, args, callerEnv.subMemory());
  return evalNode(macro.body, closure);
};
const bind = (
  _this: UserObject | undefined,
  argList: string[],
  values: BoObject[],
  createdEnv: Memory
): Memory => {
  const closure = createdEnv.subMemory();
  if (argList.length !== values.length)
    throw new Error('ERROR bind() => arg length error.');
  for (let i = 0; i < argList.length; i++) {
    closure.defineForce(argList[i], values[i]);
  }
  if (_this) closure.defineForce('this', _this);
  return closure;
};
const evalSpecialOp = (
  lhs: BoObject,
  op: string,
  rhs: BoObject,
  env: Memory
): BoObject => {
  //console.log(`evalSpecialOp(${lhs.str()} ${op} ${rhs.str()})`);
  //= := . ; , && ||
  if (op === '&&') {
    const elhs = evalNode(lhs, env);
    return elhs === NIL ? NIL : evalNode(rhs, env);
  } else if (op === '||') {
    const elhs = evalNode(rhs, env);
    return elhs !== NIL ? elhs : evalNode(rhs, env);
  } else if (op === ';') {
    evalNode(lhs, env);
    return evalNode(rhs, env);
  } else if (op === ':=' && lhs instanceof Message) {
    return evalAssign('define', lhs, evalNode(rhs, env), env);
  } else if (op === '=' && lhs instanceof Message) {
    return evalAssign('update', lhs, evalNode(rhs, env), env);
  } else if (op === '.') {
    throw new Error(`ERROR evalSpecialOp(${lhs.str()} ${op} ${rhs.str()})`);
  } else {
    // op === ','
    throw new Error(`ERROR evalSpecialOp(${lhs.str()} ${op} ${rhs.str()})`);
  }
};
const evalArithmeticOp = (
  lhs: BoObject,
  op: string,
  rhs: BoObject,
  env: Memory
): BoObject => {
  //console.log(`evalArithmeticOp(${elhs.str()} ${op} ${erhs.str()})`);
  const [elhs, erhs] = [evalNode(lhs, env), evalNode(rhs, env)];
  if (elhs instanceof Num) {
    const n =
      erhs instanceof Num
        ? erhs.value
        : erhs instanceof Str
        ? Number(erhs.value)
        : undefined;
    if (n === undefined) throw new Error('ERROR evalArithmeticOp');
    if (op === '+') return new Num(elhs.value + n);
    if (op === '-') return new Num(elhs.value - n);
    if (op === '*') return new Num(elhs.value * n);
    if (op === '/') return new Num(elhs.value / n);
    if (op === '%') return new Num(elhs.value % n);
  } else if (elhs instanceof Str) {
    if (op === '+' && (erhs instanceof Str || erhs instanceof Num)) {
      return new Str(elhs.value.concat(erhs.value.toString()));
    } else if (erhs instanceof Num) {
      if (op === '/') return new Str(elhs.value.substring(0, erhs.value));
      if (op === '%') return new Str(elhs.value.substring(erhs.value));
    }
  }
  throw new Error(`ERROR evalArithmeticOp(${lhs.str()} ${op} ${rhs.str()})`);
};

const evalCompareOp = (
  lhs: BoObject,
  op: string,
  rhs: BoObject,
  env: Memory
): BoObject => {
  //console.log(`evalCompareOp(${op},${elhs.str()},${erhs.str()})`);
  const [elhs, erhs] = [evalNode(lhs, env), evalNode(rhs, env)];
  const cmp = elhs.compare(erhs);
  const t = new Num(1);
  if (op === '==') return cmp === 0 ? t : NIL;
  if (op === '!=') return cmp !== 0 ? t : NIL;
  if (op === '<') return cmp < 0 ? t : NIL;
  if (op === '<=') return cmp <= 0 ? t : NIL;
  if (op === '>') return cmp > 0 ? t : NIL;
  // op === '>='
  return cmp >= 0 ? t : NIL;
};
const evalAssign = (
  flag: 'define' | 'update',
  message: Message,
  value: BoObject,
  env: Memory
): BoObject => {
  //console.log(`evalAssign(${flag},${target.str()},${value.str()})`)
  if (message.receiver) {
    const assignReceiver = evalNode(message.receiver, env);
    if (assignReceiver instanceof UserObject && !message.args) {
      return assignObjectSlot(assignReceiver, message.slotName, value);
    }
  } else {
    if (!message.args) {
      const result = assignLocalVariable(flag, message.slotName, value, env);
      if (result) return result;
      throw new Error('ERROR evalAssign() assign error');
    }
  }
  throw new Error('ERROR evalAssign()');
};
const assignObjectSlot = (
  receiverObj: UserObject,
  varName: string,
  value: BoObject
): BoObject => {
  //console.log(`assignObjectSlot(${receiverObj.str()},${varName},${value.str()})`)
  return receiverObj.assignToObject(varName, value);
};
const assignLocalVariable = (
  flag: 'define' | 'update',
  varName: string,
  value: BoObject,
  env: Memory
): BoObject | null => {
  //console.log(`assignLocalVariable(${flag},${varName},${value.str()})`);
  if (flag === 'define') return env.define(varName, value);
  else return env.update(varName, value);
};
