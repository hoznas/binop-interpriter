import {
  BuiltinFunction,
  EVAL_NODE,
  EVAL_STR,
  FUN,
  MACRO,
  MESSAGE,
  defaultMethodMap,
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
  // eval binary operator
  if (!(node instanceof Message)) {
    // Num,Str,Nil,UserObject,Fun,Macro
    return node;
  } else if (node.receiver && node.args?.length === 1) {
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
  return evalMessage(node, env);
};

export const evalMessage = (mes: Message, env: Memory): BoObject => {
  // console.log(`evalMessage(${mes.str()})`);
  const result = evalIfDefaultFunction(mes, env);
  if (result) return result;

  const receiver = mes.receiver ? evalNode(mes.receiver, env) : undefined;
  const f: BoObject | undefined =
    receiver && receiver instanceof UserObject
      ? receiver.get(mes.slotName)
      : env.get(mes.slotName);

  if (!f) {
    throw new Error(`ERROR evalMessage() => ${mes.slotName} is not defined.`);
  }

  if (!mes.args) {
    return f;
  }

  if (f instanceof Fun) {
    return evalFunCall(receiver as UserObject, f, mes.args, env);
  } else if (f instanceof Macro) {
    return evalMacroCall(receiver as UserObject, f, mes.args, env);
  } else if (f instanceof BuiltinFunction) {
    return f.call(receiver, mes.args, env);
  } else {
    throw `ERROR evalMessage() => ${f} is not fun or macro`;
  }
};

const evalIfDefaultFunction = (
  mes: Message,
  env: Memory
): BoObject | undefined => {
  const method = defaultMethodMap[mes.slotName];
  if (!method) return undefined;
  return method(mes, env);
};

export const evalFunCall = (
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
    const eLhs = evalNode(lhs, env);
    return eLhs === NIL ? NIL : evalNode(rhs, env);
  } else if (op === '||') {
    const eLhs = evalNode(lhs, env);
    return eLhs !== NIL ? eLhs : evalNode(rhs, env);
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
  //console.log(`evalArithmeticOp(${eLhs.str()} ${op} ${eRhs.str()})`);
  const [eLhs, eRhs] = [evalNode(lhs, env), evalNode(rhs, env)];
  if (eLhs instanceof Num) {
    const n =
      eRhs instanceof Num
        ? eRhs.value
        : eRhs instanceof Str
        ? Number(eRhs.value)
        : undefined;
    if (n === undefined) throw new Error('ERROR evalArithmeticOp');
    if (op === '+') return new Num(eLhs.value + n);
    if (op === '-') return new Num(eLhs.value - n);
    if (op === '*') return new Num(eLhs.value * n);
    if (op === '/') return new Num(eLhs.value / n);
    if (op === '%') return new Num(eLhs.value % n);
  } else if (eLhs instanceof Str) {
    if (op === '+' && (eRhs instanceof Str || eRhs instanceof Num)) {
      return new Str(eLhs.value.concat(eRhs.value.toString()));
    } else if (eRhs instanceof Num) {
      if (op === '/') return new Str(eLhs.value.substring(0, eRhs.value));
      if (op === '%') return new Str(eLhs.value.substring(eRhs.value));
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
  //console.log(`evalCompareOp(${op},${eLhs.str()},${eRhs.str()})`);
  const [eLhs, eRhs] = [evalNode(lhs, env), evalNode(rhs, env)];
  const cmp = eLhs.compare(eRhs);
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
      throw new Error(`ERROR evalAssign() assign error. result =${result}.`);
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
  return env.update(varName, value);
};
