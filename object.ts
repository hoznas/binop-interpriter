import { Memory } from './memory';

export abstract class IoObject {
  abstract str(): string;
  compare(other: IoObject): number {
    if (this === other) return 0;
    const s1 = this.str();
    const s2 = other.str();
    if (s1 < s2) return -1;
    if (s1 > s2) return 1;
    else return 0;
  }
  clone(): IoObject {
    return this;
  }
}

export class Num extends IoObject {
  constructor(public value: number) {
    super();
  }
  str(): string {
    return this.value.toString();
  }
  compare(other: IoObject): number {
    if (other instanceof Num) {
      const result = this.value - other.value;
      if (result === 0) return 0;
      else if (result < 0) return -1;
      else return 1;
    } else return super.compare(other);
  }
}

export class Str extends IoObject {
  constructor(public value: string) {
    super();
  }
  str(): string {
    return `"${this.value}"`;
  }
  compare(other: IoObject): number {
    if (other instanceof Str) {
      if (this.value === other.value) return 0;
      else if (this.value < other.value) return -1;
      else return 1; //this.value > other.value
    }
    return super.compare(other);
  }
  concat(other: IoObject): IoObject {
    if (other instanceof Str) return new Str(this.value + other.value);
    else return new Str(this.value + other.str());
  }
}

export class Nil extends IoObject {
  private static instance = new Nil();
  private constructor() {
    super();
  }
  str(): string {
    return 'nil';
  }
  compare(other: IoObject): number {
    if (other instanceof Nil) return 0;
    return super.compare(other);
  }
  static getInstance(): Nil {
    return Nil.instance;
  }
}
export const NIL = Nil.getInstance();

export class Message extends IoObject {
  target: IoObject | undefined;
  slotName: string;
  args?: IoObject[];
  constructor(
    target: IoObject | undefined,
    slotName: string,
    args?: IoObject[]
  ) {
    super();
    if (slotName !== '.') {
      this.target = target;
      this.slotName = slotName;
      this.args = args;
    } else if (args?.length === 1 && args[0] instanceof Message) {
      this.target = target;
      this.slotName = args[0].slotName;
      this.args = args[0].args;
    } else {
      throw `ERROR new Message(${target?.str()},${name},${args
        ?.map((e) => e.str())
        .join()})`;
    }
  }
  str(): string {
    const targetStr = this.target ? this.target.str() : '';
    let argsStr: string;
    if (this.args) {
      argsStr = '(' + this.args.map((e) => e.str()).join(', ') + ')';
    } else {
      argsStr = '';
    }
    if (this.slotName === '.' && this.args?.length === 1)
      return targetStr + '.' + this.args![0].str();
    else if (this.target === undefined) return this.slotName + argsStr;
    else return targetStr + '.' + this.slotName + argsStr;
  }
}

export class Fun extends IoObject {
  argList: string[];
  body: IoObject;
  createdEnv: Memory;
  constructor(args: IoObject[], env: Memory) {
    super();
    if (args.length === 0) {
      throw 'ERROR new Fun(no-argument)';
    }
    this.body = args[args.length - 1];
    this.argList = args.slice(0, args.length - 1).map((e) => {
      if (e instanceof Message && !e.target && !e.args) return e.slotName;
      else throw `ERROR new Fun() => argument must be Str. value=${e.str()}`;
    });
    this.createdEnv = env;
  }
  str(): string {
    const argStr =
      this.argList.length === 0 ? '' : this.argList.join(',') + ',';
    return `fun(${argStr}${this.body.str()})`;
  }
}
export class Macro extends IoObject {
  argList: string[];
  body: IoObject;
  constructor(args: IoObject[]) {
    super();
    if (args.length === 0) {
      throw 'ERROR new Macro(no-argument)';
    }
    this.body = args[args.length - 1];
    this.argList = args.slice(0, args.length - 1).map((e) => {
      if (e instanceof Message && !e.target && !e.args) return e.slotName;
      else throw `ERROR new Macro() => argument must be Str. value=${e.str()}`;
    });
  }
  str(): string {
    const argStr =
      this.argList.length === 0 ? '' : this.argList.join(',') + ',';
    return `macro(${argStr}${this.body.str()})`;
  }
}

export class UserObject extends IoObject {
  memory: Memory;
  proto?: UserObject;
  constructor(slot: Memory, proto?: UserObject) {
    super();
    this.memory = slot;
    this.proto = proto;
  }
  compare(other: IoObject): number {
    if (this === other) return 0;
    else return -1;
  }
  str(): string {
    const s = [...this.memory.slots.entries()]
      .map(([k, v]) => {
        return k + ':' + v.str();
      })
      .join(',');
    return '{' + s + '}';
  }
  clone(): UserObject {
    return new UserObject(this.memory.subMemory(), this);
  }
  define(name: string, value: IoObject): IoObject | null {
    return this.memory.define(name, value);
  }
  update(name: string, value: IoObject): IoObject | null {
    return this.memory.update(name, value);
  }
  assignToObject(name: string, value: IoObject): IoObject {
    return this.memory.defineForce(name, value);
  }
  get(name: string): IoObject | undefined {
    return this.memory.get(name);
  }
}
