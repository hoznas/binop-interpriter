import { Slot } from './slot';

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
  name: string;
  args?: IoObject[];
  constructor(target: IoObject | undefined, name: string, args?: IoObject[]) {
    super();
    if (name !== '.') {
      this.target = target;
      this.name = name;
      this.args = args;
    } else if (args?.length === 1 && args[0] instanceof Message) {
      this.target = target;
      this.name = args[0].name;
      this.args = args[0].args;
    } else {
      throw 'new Message()';
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
    if (this.name === '.' && this.args?.length === 1)
      return targetStr + '.' + this.args![0].str();
    else if (this.target === undefined) return this.name + argsStr;
    else return targetStr + '.' + this.name + argsStr;
  }
}

export class Method extends IoObject {
  private _argList: string[];
  private _body: IoObject;
  private _createdEnv: Slot;
  constructor(args: IoObject[], env: Slot) {
    super();
    if (args.length === 0) {
      console.log(args);
      console.log(args.map((x) => x.str()).join(','));
      throw 'new Method(no-argument)';
    }
    this._body = args.pop()!;
    this._argList = args.map((a) => {
      return (a as Message).name;
    });
    this._createdEnv = env;
  }

  str(): string {
    const str = this._argList.length === 0 ? '' : this._argList.join(',') + ',';
    return 'fun(' + str + this._body.str() + ')';
  }
  get argList(): string[] {
    return this._argList;
  }
  get body(): IoObject {
    return this._body;
  }
  get createdEnv(): Slot {
    return this._createdEnv;
  }
}

export class UserObject extends IoObject {
  slot: Slot;
  proto?: UserObject;
  constructor(slot: Slot, proto?: UserObject) {
    super();
    this.slot = slot;
    this.proto = proto;
  }
  compare(other: IoObject): number {
    if (this === other) return 0;
    else return -1;
  }
  str(): string {
    const s = Object.keys(this.slot.slot)
      .map((k) => {
        const v = this.slot.slot[k];
        return k + ':' + v.str();
      })
      .join(',');
    return '{' + s + '}';
  }

  clone(): UserObject {
    return new UserObject(this.slot.subSlot(), this);
  }

  define(name: string, value: IoObject): IoObject | null {
    return this.slot.define(name, value);
  }
  update(name: string, value: IoObject): IoObject | null {
    return this.slot.update(name, value);
  }
  assignToObject(name: string, value: IoObject): IoObject {
    return this.slot.defineForce(name, value);
  }
  get(name: string): IoObject | null {
    return this.slot.get(name);
  }
}
