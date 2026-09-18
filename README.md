# @minamorl/darkcore

A standalone TypeScript effect interpreter built from small tagged data and an
explicit handler map. It has no runtime dependencies, global HKT registration,
typeclass catalog, operator overloading, or per-transformer API.

Documentation, including a detailed introduction and runnable examples, lives
at [https://lib.minamorl.com/darkcore/](https://lib.minamorl.com/darkcore/).

## Install

```sh
npm install @minamorl/darkcore
```

## Effects

`Effect<A>` is a type-only export. A value is either `Pure`, which is closed,
or one `Op` carrying a string tag, its input, and `onReturn`. The continuation
only constructs the next node; handlers perform the effects.

```ts
import {
  op,
  pure,
  run,
  type Effect,
  type HandlerMap,
} from "@minamorl/darkcore";

const program: Effect<number> = op("read", { key: "answer" }, (value: number) =>
  op("add", { left: value, right: 1 }, (sum: number) => pure(sum)),
);

const handlers: HandlerMap = {
  read: ({ key }: { key: string }) => (key === "answer" ? 41 : 0),
  add: ({ left, right }: { left: number; right: number }) => left + right,
};

run(program, handlers); // 42
```

`fold` and `foldAsync` add the terminal `onReturn` algebra. `run` and
`runAsync` return the terminal value unchanged. Both interpreters replace the
current node in a loop, so long operation chains are stack safe. A sync run
rejects a handler that returns a promise.

The complete runtime function surface is:

- `pure`, `op`
- `fold`, `run`
- `foldAsync`, `runAsync`
- `scoped`, `scopedAsync`

The directly required type surface is `Effect`, `HandlerMap`, and
`ScopeExit`.

## Owned resources

`scoped(acquire, use, release)` keeps acquisition, use, and release in one
call. Once acquisition succeeds, release observes a `Success` or `Error`
exit on normal completion, callback return, or throw.

`scopedAsync` provides the same rule for promise-returning callbacks.
JavaScript promises cannot be forcibly cancelled; cancellation within the
language guarantee is cooperative rejection (for example `AbortError`), which
follows the error release path.

## Errors

Interpreter and scope failures are `Error` instances with the stable envelope
fields `code`, `message`, `details`, and ULID-shaped `trace_id`. Error
details contain only names/messages for nested failures, never raw stacks. The
library emits no logs and reads no secrets.
