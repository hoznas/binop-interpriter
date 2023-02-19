import { Memory } from './memory';

export abstract class BoObject {
  abstract str(): string;
  compare(other: BoObject): number {
    if (this === other) return 0;
    else return -1;
  }
  clone(): BoObject {
    return this;
  }
}

export class Num extends BoObject {
  constructor(public value: number) {
    super();
  }
  str(): string {
    return this.value.toString();
  }
  compare(other: BoObject): number {
    if (other instanceof Num) {
      const result = this.value - other.value;
      if (result === 0) return 0;
      else if (result < 0) return -1;
      else return 1;
    }
    return -1;
  }
}

export class Str extends BoObject {
  constructor(public value: string) {
    super();
  }
  str(): string {
    return `"${this.value}"`;
  }
  compare(other: BoObject): number {
    if (other instanceof Str) {
      if (this.value === other.value) return 0;
      else if (this.value < other.value) return -1;
      else return 1; //this.value > other.value
    }
    return -1;
  }
  concat(other: BoObject): BoObject {
    if (other instanceof Str) return new Str(this.value + other.value);
    else return new Str(this.value + other.str());
  }
}

export class Nil extends BoObject {
  private static instance = new Nil();
  private constructor() {
    super();
  }
  str(): string {
    return 'nil';
  }
  compare(other: BoObject): number {
    if (other instanceof Nil) return 0;
    else return -1;
  }
  static getInstance(): Nil {
    return Nil.instance;
  }
}
export const NIL = Nil.getInstance();

export class Message extends BoObject {
  receiver: BoObject | undefined;
  slotName: string;
  args?: BoObject[];
  isTailCall: boolean;
  constructor(
    receiver: BoObject | undefined,
    slotName: string,
    args?: BoObject[]
  ) {
    super();
    this.receiver = receiver;
    this.isTailCall = false;
    if (slotName !== '.') {
      this.slotName = slotName;
      this.args = args;
    } else if (args?.length === 1 && args[0] instanceof Message) {
      this.slotName = args[0].slotName;
      this.args = args[0].args;
    } else {
      throw new Error(
        `ERROR new Message(${receiver?.str()},${slotName},${args
          ?.map((e) => e.str())
          .join()})`
      );
    }
  }
  str(): string {
    const receiverStr = this.receiver ? this.receiver.str() : '';
    let argsStr: string;
    if (this.args) {
      argsStr = '(' + this.args.map((e) => e.str()).join(', ') + ')';
    } else {
      argsStr = '';
    }
    if (this.slotName === '.' && this.args?.length === 1) {
      return receiverStr + '.' + this.args![0].str();
    } else {
      const slotName = this.slotName; //+ (this.isTailCall ? '$' : '');
      if (this.receiver === undefined) {
        return slotName + argsStr;
      } else {
        return receiverStr + '.' + slotName + argsStr;
      }
    }
  }
}

export class Fun extends BoObject {
  argList: string[];
  body: BoObject;
  createdEnv: Memory;
  constructor(args: BoObject[], env: Memory) {
    super();
    if (args.length === 0) {
      throw new Error('ERROR new Fun(no-argument)');
    }
    this.body = args[args.length - 1];
    this.argList = args.slice(0, args.length - 1).map((e) => {
      if (e instanceof Message && !e.receiver && !e.args) return e.slotName;
      else throw new Error(`ERROR new Fun() => type error. value=${e.str()}`);
    });
    this.createdEnv = env;
    this.findTailCall(this.body);
  }
  str(): string {
    const argStr =
      this.argList.length === 0 ? '' : this.argList.join(',') + ',';
    return `fun(${argStr}${this.body.str()})`;
  }
  findTailCall(node: BoObject): void {
    if (node instanceof Message && node.args) {
      if (node.slotName === 'if' || node.slotName === ';') {
        if (node.args[1]) this.findTailCall(node.args[1]);
        if (node.args[2]) this.findTailCall(node.args[2]);
      } else if (/^[a-zA-Z_]/.test(node.slotName)) {
        // user defined functions
        node.isTailCall = true;
      }
    }
  }
}

export class Macro extends BoObject {
  argList: string[];
  body: BoObject;
  constructor(args: BoObject[]) {
    super();
    if (args.length === 0) {
      throw new Error('ERROR new Macro(no-argument)');
    }
    this.body = args[args.length - 1];
    this.argList = args.slice(0, args.length - 1).map((e) => {
      if (e instanceof Message && !e.receiver && !e.args) return e.slotName;
      else throw new Error(`ERROR new Macro()  value=${e.str()}`);
    });
  }
  str(): string {
    const argStr =
      this.argList.length === 0 ? '' : this.argList.join(',') + ',';
    return `macro(${argStr}${this.body.str()})`;
  }
}

export class UserObject extends BoObject {
  memory: Memory;
  proto?: UserObject;
  constructor(slot: Memory, proto?: UserObject) {
    super();
    this.memory = slot;
    this.proto = proto;
  }
  compare(other: BoObject): number {
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
  define(name: string, value: BoObject): BoObject | null {
    return this.memory.define(name, value);
  }
  update(name: string, value: BoObject): BoObject | null {
    return this.memory.update(name, value);
  }
  assignToObject(name: string, value: BoObject): BoObject {
    return this.memory.defineForce(name, value);
  }
  get(name: string): BoObject | undefined {
    return this.memory.get(name);
  }
}

export class TailCallNotification {
  constructor(
    public _this: UserObject | undefined,
    public fun: Fun,
    public args: BoObject[],
    public callerEnv: Memory
  ) {}
}
