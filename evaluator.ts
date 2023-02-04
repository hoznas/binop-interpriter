import { FUN, IF } from './builtin-functions';
import { Memory } from './memory';
import { Fun, IoObject, Message, NIL, Num, Str, UserObject } from './object';
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
  }
  eval(code: string): IoObject {
    return evalStr(code, this.rootEnvironmentSlot);
  }
}

export function evalStr(code: string, env: Memory = new Memory()): IoObject {
  const tokens = tokenize(code);
  const node = parse(tokens);
  return evalNode(node, env);
}

export function evalNode(node: IoObject, env: Memory): IoObject {
  //console.log(`evalNode(${node.str()})`);
  // eval binary operator
  if (node instanceof Message && node.target && node.args?.length === 1) {
    const [lhs, op, rhs] = [node.target, node.name, node.args[0]];
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
    // Num,Str,Nil,UserObject,Method
    return node;
  }
}

export function evalMessage(mes: Message, env: Memory): IoObject {
  //console.log(`evalMessage(${mes.str()})`);
  if (!mes.target && mes.name === 'fun' && mes.args) {
    const f = FUN(mes.args, env);
    return f;
  } else if (!mes.target && mes.name === 'if' && mes.args) {
    return IF(mes.args, env);
  } else if (mes.target && mes.name === 'print' && mes.args?.length === 0) {
    console.log(evalNode(mes.target, env).str());
    return NIL;
  } else if (mes.target && mes.name === 'clone' && mes.args?.length === 0) {
    return evalNode(mes.target, env).clone();
  }

  const target = mes.target ? evalNode(mes.target, env) : undefined;
  let foo: IoObject | undefined = NIL;
  if (target && target instanceof UserObject) {
    foo = target.get(mes.name);
  } else {
    foo = env.get(mes.name);
  }
  if (!foo) {
    throw `ERROR evalMessage(${mes.str()})`;
  }
  if (foo instanceof Fun && mes.args) {
    return evalMethodCall(target as UserObject, foo, mes.args, env);
  } else if (!mes.args) {
    return foo;
  } else {
    throw `ERROR evalMessage() => unknown`;
  }
}

function evalMethodCall(
  _this: UserObject | undefined,
  fun: Fun,
  args: IoObject[],
  callerEnv: Memory
): IoObject {
  const closure = bind(
    _this,
    fun.argList,
    args.map((arg) => evalNode(arg, callerEnv)),
    fun.createdEnv.subMemory()
  );
  return evalNode(fun.body, closure);
}

function bind(
  _this: UserObject | undefined,
  argList: string[],
  values: IoObject[],
  createdEnv: Memory
): Memory {
  const closure = createdEnv.subMemory();
  if (argList.length !== values.length)
    throw 'ERROR bind() => arg length error.';
  for (let i = 0; i < argList.length; i++) {
    closure.defineForce(argList[i], values[i]);
  }
  if (_this) closure.defineForce('this', _this);
  return closure;
}

function evalSpecialOp(
  lhs: IoObject,
  op: string,
  rhs: IoObject,
  env: Memory
): IoObject {
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
    throw `ERROR evalSpecialOp(${lhs.str()} ${op} ${rhs.str()}) internal error operator[.]`;
  } else {
    // op === ','
    throw `ERROR evalSpecialOp(${lhs.str()} ${op} ${rhs.str()}) internal error operator[,]`;
  }
}
function evalArithmeticOp(
  lhs: IoObject,
  op: string,
  rhs: IoObject,
  env: Memory
): IoObject {
  //console.log(`evalArithmeticOp(${elhs.str()} ${op} ${erhs.str()})`);
  const [elhs, erhs] = [evalNode(lhs, env), evalNode(rhs, env)];
  if (op === '+' && elhs instanceof Str) return elhs.concat(erhs);
  if (elhs instanceof Num && (erhs instanceof Num || erhs instanceof Str)) {
    const n = erhs instanceof Num ? erhs.value : Number(erhs.value);
    if (op === '+') return new Num(elhs.value + n);
    if (op === '-') return new Num(elhs.value - n);
    if (op === '*') return new Num(elhs.value * n);
    if (op === '/') return new Num(elhs.value / n);
    //op === '%'
    return new Num(elhs.value % n);
  }
  throw `ERROR evalArithmeticOp(${lhs.str()} ${op} ${rhs.str()})`;
}
function evalCompareOp(
  lhs: IoObject,
  op: string,
  rhs: IoObject,
  env: Memory
): IoObject {
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
}

function evalAssign(
  flag: 'define' | 'update',
  message: Message,
  value: IoObject,
  env: Memory
): IoObject {
  //console.log(`evalAssign(${flag},${target.str()},${value.str()})`)
  if (message.target) {
    const assignTarget = evalNode(message.target, env);
    if (assignTarget instanceof UserObject && !message.args) {
      return assignObjectSlot(assignTarget, message.name, value);
    }
  } else {
    if (!message.args) {
      const result = assignLocalVariable(flag, message.name, value, env);
      if (result) return result;
      throw 'ERROR evalAssign() assign error';
    }
  }
  throw 'ERROR evalAssign() ';
}
function assignObjectSlot(
  targetObj: UserObject,
  varName: string,
  value: IoObject
): IoObject {
  //console.log(`assignObjectSlot(${targetObj.str()},${varName},${value.str()})`)
  return targetObj.assignToObject(varName, value);
}

function assignLocalVariable(
  flag: 'define' | 'update',
  varName: string,
  value: IoObject,
  env: Memory
): IoObject | null {
  //console.log(`assignLocalVariable(${flag},${varName},${value.str()})`);
  if (flag === 'define') return env.define(varName, value);
  else return env.update(varName, value);
}
