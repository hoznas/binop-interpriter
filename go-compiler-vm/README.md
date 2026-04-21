# go-compiler-vm

BinOp 言語のコンパイラと VM の Go 実装。

- **go-compiler** — ソースコードを中間言語 (IL) テキストにコンパイルする
- **go-vm** — IL テキストを受け取りスタックマシンで実行する

## 実行方法

### ビルド

```bash
# コンパイラ
cd go-compiler && go build -o binop-compiler .

# VM
cd go-vm && go build -o binop-vm .
```

### パイプライン実行（コンパイル → VM）

```bash
binop-compiler sample.bo | binop-vm
```

### VM 単体で直接実行（コンパイル+実行を一括）

```bash
binop-vm --source sample.bo
```

### IL ファイルを直接 VM で実行

```bash
binop-compiler sample.bo > out.il
binop-vm out.il
```

### go run で実行（ビルド不要）

```bash
# コンパイルのみ（IL を stdout に出力）
cd go-compiler && go run . sample.bo

# パイプ
cd go-compiler && go run . sample.bo | (cd ../go-vm && go run . )

# ソース直接実行
cd go-vm && go run . --source ../sample.bo
```

## テスト

```bash
cd go-compiler && go test ./...
cd go-vm && go test ./...
```
