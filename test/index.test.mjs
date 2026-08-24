import assert from "node:assert/strict";
import test from "node:test";

import * as api from "../dist/index.js";
import {
  fold,
  foldAsync,
  op,
  pure,
  run,
  runAsync,
  scoped,
  scopedAsync,
} from "../dist/index.js";

test("runtime exports are the closed public function set", () => {
  assert.deepEqual(Object.keys(api).sort(), [
    "fold",
    "foldAsync",
    "op",
    "pure",
    "run",
    "runAsync",
    "scoped",
    "scopedAsync",
  ]);
});

test("pure is closed and fold supplies the terminal algebra", () => {
  assert.equal(run(pure(21), {}), 21);
  assert.equal(
    fold(pure(21), {}, (value) => value * 2),
    42,
  );
});

test("op dispatches by tag through an explicit per-program handler map", () => {
  const program = op("read", { key: "answer" }, (value) =>
    op("add", { left: value, right: 1 }, pure),
  );
  const handlers = {
    read: ({ key }) => (key === "answer" ? 41 : 0),
    add: ({ left, right }) => left + right,
  };
  assert.equal(run(program, handlers), 42);
});

test("the synchronous interpreter is stack safe for long chains", () => {
  const countdown = (remaining) =>
    remaining === 0
      ? pure("done")
      : op("tick", remaining, (next) => countdown(next));

  assert.equal(
    run(countdown(100_000), { tick: (remaining) => remaining - 1 }),
    "done",
  );
});

test("the asynchronous interpreter is iterative and accepts mixed handlers", async () => {
  const countdown = (remaining) =>
    remaining === 0
      ? pure(remaining)
      : op("tick", remaining, (next) => countdown(next));

  const result = await foldAsync(
    countdown(10_000),
    { tick: async (remaining) => remaining - 1 },
    async (value) => value + 42,
  );
  assert.equal(result, 42);
  assert.equal(await runAsync(pure("done"), {}), "done");
});

test("sync interpretation rejects async handlers with an error envelope", () => {
  assert.throws(
    () =>
      run(op("later", null, pure), {
        later: async () => 1,
      }),
    (error) => {
      assert.equal(error.code, "ASYNC_HANDLER_IN_SYNC_RUN");
      assert.equal(typeof error.message, "string");
      assert.equal(typeof error.details, "object");
      assert.match(error.trace_id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
      assert.equal("stack" in error.details, false);
      return true;
    },
  );
});

test("missing handlers fail through the same safe envelope", () => {
  assert.throws(
    () => run(op("missing", null, pure), {}),
    (error) => {
      assert.equal(error.code, "MISSING_HANDLER");
      assert.deepEqual(error.details, { tag: "missing" });
      return true;
    },
  );
});

test("scoped releases on success and callback return", () => {
  const exits = [];
  const value = scoped(
    () => ({ open: true }),
    () => 42,
    (resource, exit) => {
      resource.open = false;
      exits.push(exit);
    },
  );

  assert.equal(value, 42);
  assert.deepEqual(exits, [{ _tag: "Success", value: 42 }]);
});

test("scoped releases on error", () => {
  let released = false;
  assert.throws(
    () =>
      scoped(
        () => ({ id: 1 }),
        () => {
          throw new Error("boom");
        },
        (_resource, exit) => {
          released = true;
          assert.equal(exit._tag, "Error");
        },
      ),
    (error) => {
      assert.equal(error.code, "SCOPE_USE_FAILED");
      return true;
    },
  );
  assert.equal(released, true);
});

test("scopedAsync releases cooperative cancellation", async () => {
  let exit;
  const cancellation = new Error("stop");
  cancellation.name = "AbortError";

  await assert.rejects(
    () =>
      scopedAsync(
        async () => ({ id: 1 }),
        async () => {
          throw cancellation;
        },
        async (_resource, observed) => {
          exit = observed;
        },
      ),
    (error) => {
      assert.equal(error.code, "SCOPE_CANCELLED");
      return true;
    },
  );
  assert.equal(exit._tag, "Error");
  assert.equal(exit.error, cancellation);
});
