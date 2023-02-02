import { FUN, IF } from './builtin-functions';
import { IoObject, Message, Method, NIL, Num, Str, UserObject } from './object';
import { parse } from './parser';
import { Slot } from './slot';
import { tokenize } from './tokenizer';

export class Evaluator {
  rootSlot: Slot;
  objectSlot: Slot;
  constructor() {
    this.rootSlot = new Slot();
    this.objectSlot = new Slot();
    this.rootSlot.define('Object', new UserObject(this.objectSlot));
    this.rootSlot.define('nil', NIL);
  }
  eval(code: string): IoObject {
    return evalStr(code, this.rootSlot);
  }
}

export function evalStr(code: string, env: Slot = new Slot()): IoObject {
  const tokens = tokenize(code);
  const node = parse(tokens);
  return evalNode(node, env);
}

export function evalNode(node: IoObject, e: Slot): IoObject {
  console.log(`evalNode(${node.str()})`);
  // eval binary operator
  if (node instanceof Message && node.target && node.args?.length === 1) {
    const [lhs, op, rhs] = [node.target, node.name, node.args[0]];
    if (['+', '-', '*', '/', '%'].includes(op)) {
      return evalArithmeticOp(lhs, op, rhs, e);
    } else if (['==', '!=', '<', '<=', '>', '>='].includes(op)) {
      return evalCompareOp(lhs, op, rhs, e);
    } else if (['=', ':=', '.', ';', ',', '&&', '||'].includes(op)) {
      return evalSpecialOp(lhs, op, rhs, e);
    }
  }
  if (node instanceof Message) {
    return evalMessage(node, e);
  } else {
    // Num,Str,Nil,UserObject,Method
    return node;
  }
}

export function evalMessage(mes: Message, e: Slot): IoObject {
  //console.log(`evalMessage(${mes.str()})`);
  if (!mes.target && mes.name === 'fun' && mes.args) {
    console.log('FUN');
    console.log(mes.str());
    const f = FUN(mes.args, e);
    console.log(f.str());
    return f;
  } else if (!mes.target && mes.name === 'if' && mes.args) {
    return IF(mes.args, e);
  } else if (mes.target && mes.name === 'print' && mes.args?.length === 0) {
    console.log(evalNode(mes.target, e).str());
    return NIL;
  } else if (mes.target && mes.name === 'clone' && mes.args?.length === 0) {
    return evalNode(mes.target, e).clone();
  }

  const target = mes.target ? evalNode(mes.target, e) : null;
  let foo: IoObject | null = NIL;
  if (target && target instanceof UserObject) {
    foo = target.get(mes.name);
  } else {
    foo = e.get(mes.name);
  }
  if (!foo) {
    throw `evalMessage(A)`;
  }
  if (foo instanceof Method && mes.args) {
    return evalMethodCall(target as UserObject, foo, mes.args, e);
  } else if (!mes.args) {
    return foo;
  } else {
    throw `evalMessage(B)`;
  }
}

function evalMethodCall(
  _this: UserObject | undefined,
  m: Method,
  args: IoObject[],
  callerEnv: Slot
): IoObject {
  const closure = bind(
    _this,
    m.argList,
    args.map((arg) => evalNode(arg, callerEnv)),
    m.createdEnv.subSlot()
  );
  return evalNode(m.body, closure);
}

function bind(
  _this: UserObject | undefined,
  argList: string[],
  values: IoObject[],
  createdEnv: Slot
): Slot {
  const closure = createdEnv.subSlot();
  if (argList.length !== values.length) throw 'ERROR arg length error.';
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
  e: Slot
): IoObject {
  //console.log(`evalSpecialOp(${lhs.str()} ${op} ${rhs.str()})`);
  //= := . ; , && ||
  if (op === '&&') {
    const elhs = evalNode(lhs, e);
    return elhs === NIL ? NIL : evalNode(rhs, e);
  } else if (op === '||') {
    const elhs = evalNode(rhs, e);
    return elhs !== NIL ? elhs : evalNode(rhs, e);
  } else if (op === ';') {
    evalNode(lhs, e);
    return evalNode(rhs, e);
  } else if (op === ':=' && lhs instanceof Message) {
    return evalAssign('define', lhs, evalNode(rhs, e), e);
  } else if (op === '=' && lhs instanceof Message) {
    return evalAssign('update', lhs, evalNode(rhs, e), e);
  } else if (op === '.') {
    throw `[ERROR] internal error operator[.](${op} ${lhs.str()} ${rhs.str()})`;
  } else if (op === ',') {
    throw `[ERROR] internal error operator[,](${op} ${lhs.str()} ${rhs.str()})`;
  }
  throw 'evalSpecialOp()';
}
function evalArithmeticOp(
  lhs: IoObject,
  op: string,
  rhs: IoObject,
  e: Slot
): IoObject {
  //console.log(`evalArithmeticOp(${elhs.str()} ${op} ${erhs.str()})`);
  const [elhs, erhs] = [evalNode(lhs, e), evalNode(rhs, e)];
  if (op === '+' && elhs instanceof Str) return elhs.concat(erhs);
  if (elhs instanceof Num && (erhs instanceof Num || erhs instanceof Str)) {
    const n = erhs instanceof Num ? erhs.value : Number(erhs.value);
    if (op === '+') return new Num(elhs.value + n);
    if (op === '-') return new Num(elhs.value - n);
    if (op === '*') return new Num(elhs.value * n);
    if (op === '/') return new Num(elhs.value / n);
    if (op === '%') return new Num(elhs.value % n);
  }
  throw 'evalArithmeticOp()';
}
function evalCompareOp(
  lhs: IoObject,
  op: string,
  rhs: IoObject,
  e: Slot
): IoObject {
  //console.log(`evalCompareOp(${op},${elhs.str()},${erhs.str()})`);
  const [elhs, erhs] = [evalNode(lhs, e), evalNode(rhs, e)];
  const cmp = elhs.compare(erhs);
  const t = new Num(1);
  if (op === '==') return cmp === 0 ? t : NIL;
  if (op === '!=') return cmp !== 0 ? t : NIL;
  if (op === '<') return cmp < 0 ? t : NIL;
  if (op === '<=') return cmp <= 0 ? t : NIL;
  if (op === '>') return cmp > 0 ? t : NIL;
  if (op === '>=') return cmp >= 0 ? t : NIL;
  throw 'evalArithmeticOp()';
}

function evalAssign(
  flag: 'define' | 'update',
  message: Message,
  value: IoObject,
  e: Slot
): IoObject {
  //console.log(`evalAssign(${flag},${target.str()},${value.str()})`)
  if (message.target) {
    const assignTarget = evalNode(message.target, e);
    if (assignTarget instanceof UserObject && !message.args) {
      return assignObjectSlot(assignTarget, message.name, value);
    }
  } else {
    if (!message.args) {
      const result = assignLocalVariable(flag, message.name, value, e);
      if (result) return result;
      throw 'ERROR evalAssign()    assign error';
    }
  }
  throw 'ERROR evalAssign()    obj.method() = value is not supported';
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
  e: Slot
): IoObject | null {
  //console.log(`assignLocalVariable(${flag},${varName},${value.str()})`);
  if (flag === 'define') return e.define(varName, value);
  else return e.update(varName, value);
}
