import { BoObject, Fun } from './object';
type map = Map<string, BoObject>;
export class Memory {
  super: Memory | undefined;
  slots: map;
  current: Fun | undefined;
  constructor(superMemory: Memory | undefined = undefined) {
    this.super = superMemory;
    this.slots = new Map<string, BoObject>();
    this.current = undefined;
  }
  subMemory() {
    return new Memory(this);
  }
  find(name: string): map | undefined {
    if (this.slots.get(name)) {
      return this.slots;
    } else if (this.super) {
      return this.super.find(name);
    } else {
      return undefined;
    }
  }
  get(name: string): BoObject | undefined {
    const slot = this.find(name);
    return slot && slot.get(name);
  }
  define(name: string, value: BoObject): BoObject | null {
    const isDefined = this.slots.get(name);
    if (!isDefined) {
      this.slots.set(name, value);
      return value;
    } else {
      return null;
    }
  }
  defineForce(name: string, value: BoObject): BoObject {
    this.slots.set(name, value);
    return value;
  }
  update(name: string, value: BoObject): BoObject | null {
    const slot = this.find(name);
    if (slot) {
      slot.set(name, value);
      return value;
    } else {
      return null;
    }
  }
  show() {
    this.super?.show();
    for (let [name, value] of this.slots) {
      console.log(`Slot.Show(${name} = ${value.str()})`);
    }
  }
}
