import {
  BuiltinFunction,
  EVAL_NODE,
  EVAL_STR,
  FUN,
  MACRO,
  MESSAGE,
  defaultMethodMapK,
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

// ===== CPS基盤 =====

// 継続(Continuation): 評価結果を受け取り、次の計算を返す関数
export type Continuation = (result: BoObject) => Bounce;

// Thunk: 「まだ実行していない計算」を包む箱。
// トランポリンがこれを開封して実行する。
// これにより再帰呼び出しをループに変換し、スタックオーバーフローを防ぐ。
export class Thunk {
  constructor(public fn: () => Bounce) {}
}

// Bounce: 評価の途中結果。
// - BoObject なら評価完了
// - Thunk ならまだ続きがある
export type Bounce = BoObject | Thunk;

// トランポリン: Thunkを繰り返し開封して最終的なBoObjectを得る。
// CPS化された評価器の「実行エンジン」。
export const trampoline = (bounce: Bounce): BoObject => {
  while (bounce instanceof Thunk) {
    bounce = bounce.fn();
  }
  return bounce;
};

// ===== 評価器 =====

export class Evaluator {
  static print = (msg: string) => {
    console.log('foo', msg);
  };
  rootEnvironmentSlot: Memory;
  rootObjectSlot: Memory;
  constructor(print = (msg: string) => console.log(msg)) {
    this.rootEnvironmentSlot = new Memory();
    this.rootObjectSlot = new Memory();
    Evaluator.print = print;

    // variables
    this.rootEnvironmentSlot.define(
      'Object',
      new UserObject(this.rootObjectSlot),
    );
    this.rootEnvironmentSlot.define('nil', NIL);

    // functions
    this.rootEnvironmentSlot.define('fun', FUN);
    this.rootEnvironmentSlot.define('macro', MACRO);
    this.rootEnvironmentSlot.define('evalNode', EVAL_NODE);
    this.rootEnvironmentSlot.define('evalStr', EVAL_STR);
    this.rootEnvironmentSlot.define('message', MESSAGE);
  }
  eval(code: string): BoObject {
    // CPS版の評価器を通じて実行する
    // 初期継続は恒等関数(identity): 最終結果をそのまま返す
    return trampoline(evalStrK(code, this.rootEnvironmentSlot, (x) => x));
  }
}

// 同期版のevalStr（trampoline経由でCPS版を呼ぶ便利関数）
export const evalStr = (code: string, env: Memory): BoObject => {
  return trampoline(evalStrK(code, env, (x) => x));
};

// ===== CPS評価関数 =====
// 関数名末尾のKは「Kontinuation（継続）」を受け取ることを示す
// CPS文献での標準的な命名規約

// evalStrのCPS版: コードをパースしてevalNodeKに渡す
export const evalStrK = (
  code: string,
  env: Memory,
  k: Continuation,
): Bounce => {
  const tokens = tokenize(code);
  const node = parse(tokens);
  return evalNodeK(node, env, k);
};

// evalNodeのCPS版: ノードを評価し、結果を継続kに渡す
export const evalNodeK = (
  node: BoObject,
  env: Memory,
  k: Continuation,
): Bounce => {
  if (!(node instanceof Message)) {
    // リテラル値(Num, Str, Nil, UserObject, Fun, Macro)は
    // そのまま継続に渡す — これ以上評価する必要がない
    return k(node);
  }

  if (node.receiver && node.args?.length === 1) {
    const [lhs, op, rhs] = [node.receiver, node.slotName, node.args[0]];
    if (['+', '-', '*', '/', '%'].includes(op)) {
      return evalArithmeticOpK(lhs, op, rhs, env, k);
    }
    if (['==', '!=', '<', '<=', '>', '>='].includes(op)) {
      return evalCompareOpK(lhs, op, rhs, env, k);
    }
    if (['=', ':=', '.', ';', ',', '&&', '||'].includes(op)) {
      return evalSpecialOpK(lhs, op, rhs, env, k);
    }
  }

  // メッセージ（関数呼び出し、スロットアクセス等）
  return evalMessageK(node, env, k);
};

// --- 算術演算のCPS版 ---
// lhsを評価 → rhsを評価 → 純粋な計算結果を継続kに渡す
//
// CPS的な読み方:
//   「lhsを評価して、その結果eLhsを受け取ったら…
//     rhsを評価して、その結果eRhsを受け取ったら…
//       計算結果をkに渡す」
const evalArithmeticOpK = (
  lhs: BoObject,
  op: string,
  rhs: BoObject,
  env: Memory,
  k: Continuation,
): Bounce => {
  return evalNodeK(
    lhs,
    env,
    (
      eLhs, // ← lhsを評価
    ) =>
      new Thunk(() =>
        evalNodeK(
          rhs,
          env,
          (
            eRhs, // ← rhsを評価（Thunkでスタック節約）
          ) => k(computeArithmetic(eLhs, op, eRhs)), // ← 計算結果を継続に渡す
        ),
      ),
  );
};

// 純粋な算術計算（副作用なし、CPS不要）
const computeArithmetic = (
  eLhs: BoObject,
  op: string,
  eRhs: BoObject,
): BoObject => {
  if (eLhs instanceof Num) {
    const n =
      eRhs instanceof Num
        ? eRhs.value
        : eRhs instanceof Str
          ? Number(eRhs.value)
          : undefined;
    if (n === undefined) throw new Error('ERROR computeArithmetic');
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
  throw new Error(`ERROR computeArithmetic(${eLhs.str()} ${op} ${eRhs.str()})`);
};

// --- 比較演算のCPS版 ---
// 算術と同じパターン: lhs評価 → rhs評価 → 比較結果を継続に渡す
const evalCompareOpK = (
  lhs: BoObject,
  op: string,
  rhs: BoObject,
  env: Memory,
  k: Continuation,
): Bounce => {
  return evalNodeK(
    lhs,
    env,
    (eLhs) =>
      new Thunk(() =>
        evalNodeK(rhs, env, (eRhs) => k(computeCompare(eLhs, op, eRhs))),
      ),
  );
};

// 純粋な比較計算（副作用なし、CPS不要）
const computeCompare = (
  eLhs: BoObject,
  op: string,
  eRhs: BoObject,
): BoObject => {
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

// --- 特殊演算子のCPS版 ---
// 制御フロー(;, &&, ||)と代入(:=, =)をCPSで表現する。
//
// CPS的な読み方の例（セミコロン）:
//   a ; b は「aを評価して結果を捨て、bを評価してその結果をkに渡す」
//   → evalNodeK(a, env, (_) => Thunk(() => evalNodeK(b, env, k)))
//
// ポイント: rhsの評価が「末尾位置」になる（kをそのまま渡す）
const evalSpecialOpK = (
  lhs: BoObject,
  op: string,
  rhs: BoObject,
  env: Memory,
  k: Continuation,
): Bounce => {
  if (op === ';') {
    // セミコロン: lhsを評価（結果は捨てる）→ rhsを末尾位置で評価
    return evalNodeK(
      lhs,
      env,
      (_discarded) => new Thunk(() => evalNodeK(rhs, env, k)),
    );
  } else if (op === '&&') {
    // 論理AND: lhsがNILならNIL、そうでなければrhsを評価
    return evalNodeK(lhs, env, (eLhs) =>
      eLhs === NIL ? k(NIL) : new Thunk(() => evalNodeK(rhs, env, k)),
    );
  } else if (op === '||') {
    // 論理OR: lhsがNILでなければそれを返す、NILならrhsを評価
    return evalNodeK(lhs, env, (eLhs) =>
      eLhs !== NIL ? k(eLhs) : new Thunk(() => evalNodeK(rhs, env, k)),
    );
  } else if (op === ':=' && lhs instanceof Message) {
    // 変数定義: rhsを評価 → 結果を環境に束縛
    return evalNodeK(rhs, env, (value) =>
      evalAssignK('define', lhs, value, env, k),
    );
  } else if (op === '=' && lhs instanceof Message) {
    // 変数更新: rhsを評価 → 結果で環境を更新
    return evalNodeK(rhs, env, (value) =>
      evalAssignK('update', lhs, value, env, k),
    );
  }
  throw new Error(`ERROR evalSpecialOpK(${lhs.str()} ${op} ${rhs.str()})`);
};

// --- 代入のCPS版 ---
// receiverがある場合（obj.x = 5）はreceiverをCPSで評価する必要がある
const evalAssignK = (
  flag: 'define' | 'update',
  message: Message,
  value: BoObject,
  env: Memory,
  k: Continuation,
): Bounce => {
  if (message.receiver) {
    // receiver.slot = value → receiverを評価してからスロットに代入
    return evalNodeK(message.receiver, env, (assignReceiver) => {
      if (assignReceiver instanceof UserObject && !message.args) {
        return k(assignReceiver.assignToObject(message.slotName, value));
      }
      throw new Error('ERROR evalAssignK()');
    });
  } else {
    // ローカル変数への代入（receiverなし、評価不要）
    if (!message.args) {
      if (flag === 'define') {
        const result = env.define(message.slotName, value);
        if (result) return k(result);
        throw new Error(
          `ERROR evalAssignK() define error: ${message.slotName}`,
        );
      }
      const result = env.update(message.slotName, value);
      if (result) return k(result);
      throw new Error(`ERROR evalAssignK() update error: ${message.slotName}`);
    }
  }
  throw new Error('ERROR evalAssignK()');
};

// --- メッセージ評価のCPS版 ---
// メッセージ = 関数呼び出し or スロットアクセス
// receiver評価 → slot検索 → Fun/Macro/BuiltinFunctionの分岐
const evalMessageK = (mes: Message, env: Memory, k: Continuation): Bounce => {
  // まずデフォルト関数(if, print, clone, doWhile)をチェック
  const defaultResult = evalIfDefaultFunctionK(mes, env, k);
  if (defaultResult !== undefined) return defaultResult;

  // receiverを評価した後の処理
  const afterReceiver = (receiver: BoObject | undefined): Bounce => {
    const f: BoObject | undefined =
      receiver && receiver instanceof UserObject
        ? receiver.get(mes.slotName)
        : env.get(mes.slotName);

    if (!f)
      throw new Error(
        `ERROR evalMessageK() => ${mes.slotName} is not defined.`,
      );

    // 引数なし → 値の参照（プロパティアクセスや変数参照）
    if (!mes.args) return k(f);

    // 引数あり → 関数/マクロ呼び出し
    if (f instanceof Fun) {
      return evalFunCallK(receiver as UserObject, f, mes.args, env, k);
    } else if (f instanceof Macro) {
      return evalMacroCallK(receiver as UserObject, f, mes.args, env, k);
    } else if (f instanceof BuiltinFunction) {
      // CPS版: 継続kを渡す
      return f.callK(receiver, mes.args, env, k);
    }
    throw new Error(
      `ERROR evalMessageK() => ${mes.slotName} is not fun or macro`,
    );
  };

  // receiverがあれば先にCPSで評価する
  if (mes.receiver) {
    return evalNodeK(
      mes.receiver,
      env,
      (receiver) => new Thunk(() => afterReceiver(receiver)),
    );
  }
  return afterReceiver(undefined);
};

// デフォルト関数(if, print等)の呼び出しチェック（CPS版）
const evalIfDefaultFunctionK = (
  mes: Message,
  env: Memory,
  k: Continuation,
): Bounce | undefined => {
  const method = defaultMethodMapK[mes.slotName];
  if (!method) return undefined;
  return method(mes, env, k);
};

// --- 関数呼び出しのCPS版 ---

// 引数リストを左から順にCPSで評価するヘルパー
// 各引数を1つずつ評価し、結果を配列に集めて継続kに渡す
const evalArgsK = (
  args: BoObject[],
  env: Memory,
  k: (results: BoObject[]) => Bounce,
): Bounce => {
  const results: BoObject[] = [];
  const evalNext = (i: number): Bounce => {
    if (i >= args.length) return k(results); // 全引数の評価完了
    return evalNodeK(args[i], env, (result) => {
      // i番目の引数を評価
      results.push(result);
      return new Thunk(() => evalNext(i + 1)); // 次の引数へ（Thunkでスタック節約）
    });
  };
  return evalNext(0);
};

// Fun（ユーザ定義関数）の呼び出し
// 1. 引数を左から順にCPSで評価
// 2. bind で引数をクロージャに束縛
// 3. 関数本体を末尾位置で評価 ← ここがTCO（末尾呼び出し最適化）の要
export const evalFunCallK = (
  _this: UserObject | undefined,
  fun: Fun,
  args: BoObject[],
  callerEnv: Memory,
  k: Continuation,
): Bounce => {
  return evalArgsK(args, callerEnv, (evaluatedArgs) => {
    const closure = bind(
      _this,
      fun.argList,
      evaluatedArgs,
      fun.createdEnv.subMemory(),
    );
    // 関数本体は「末尾位置」: kをそのまま渡すので、
    // 再帰呼び出しでもスタックが積み上がらない
    return new Thunk(() => evalNodeK(fun.body, closure, k));
  });
};

// Macro（マクロ）の呼び出し — 引数は評価せずそのまま渡す
const evalMacroCallK = (
  _this: UserObject | undefined,
  macro: Macro,
  args: BoObject[],
  callerEnv: Memory,
  k: Continuation,
): Bounce => {
  const closure = bind(_this, macro.argList, args, callerEnv.subMemory());
  return new Thunk(() => evalNodeK(macro.body, closure, k));
};

// 引数束縛: クロージャを作って引数を束縛する（純粋なメモリ操作のみ）
const bind = (
  _this: UserObject | undefined,
  argList: string[],
  values: BoObject[],
  createdEnv: Memory,
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
