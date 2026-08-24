/**
 * A closed effect is either a terminal value or one tagged operation together
 * with the structural continuation that consumes the handler result.
 */
export type Effect<A> =
  | Readonly<{
      _tag: "Pure";
      value: A;
    }>
  | Readonly<{
      _tag: "Op";
      tag: string;
      input: unknown;
      onReturn: (value: unknown) => Effect<A>;
    }>;

/**
 * Each program supplies its capabilities explicitly when it is interpreted.
 * The operation constructor owns the input/output types; the map intentionally
 * has no global registry or higher-kinded type surface.
 */
export type HandlerMap = Readonly<
  Record<string, (input: never) => unknown | PromiseLike<unknown>>
>;

/** The release callback observes how the owned scope was left. */
export type ScopeExit<A> =
  | Readonly<{ _tag: "Success"; value: A }>
  | Readonly<{ _tag: "Error"; error: unknown }>;

type ErrorDetails = Readonly<Record<string, unknown>>;

class DarkcoreError extends Error {
  readonly code: string;
  readonly details: ErrorDetails;
  readonly trace_id: string;

  constructor(
    code: string,
    message: string,
    details: ErrorDetails,
    traceId: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "DarkcoreError";
    this.code = code;
    this.details = details;
    this.trace_id = traceId;
  }
}

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function ulid(): string {
  let timestamp = Date.now();
  let timePart = "";
  for (let index = 0; index < 10; index += 1) {
    timePart = ULID_ALPHABET.charAt(timestamp % 32) + timePart;
    timestamp = Math.floor(timestamp / 32);
  }

  let randomPart = "";
  for (let index = 0; index < 16; index += 1) {
    randomPart += ULID_ALPHABET.charAt(Math.floor(Math.random() * 32));
  }
  return timePart + randomPart;
}

function describeError(error: unknown): Readonly<{
  name: string;
  message: string;
}> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError", message: String(error) };
}

function failure(
  code: string,
  message: string,
  details: ErrorDetails,
  cause?: unknown,
): DarkcoreError {
  return new DarkcoreError(code, message, details, ulid(), cause);
}

function normalizeFailure(
  error: unknown,
  code: string,
  message: string,
  details: ErrorDetails = {},
): DarkcoreError {
  if (error instanceof DarkcoreError) {
    return error;
  }
  return failure(
    code,
    message,
    { ...details, cause: describeError(error) },
    error,
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      (error as Error & { code?: unknown }).code === "ABORT_ERR")
  );
}

function handlerFor(
  handlers: HandlerMap,
  tag: string,
): (input: never) => unknown | PromiseLike<unknown> {
  const handler = handlers[tag];
  if (handler === undefined) {
    throw failure(
      "MISSING_HANDLER",
      "No handler was supplied for an operation.",
      {
        tag,
      },
    );
  }
  return handler;
}

/** Construct a closed, terminal effect. */
export function pure<A>(value: A): Effect<A> {
  return Object.freeze({ _tag: "Pure", value });
}

/**
 * Construct a tagged operation. Composition lives only in onReturn: invoking
 * onReturn builds the next data node and performs no effect by itself.
 */
export function op<Input, Output, A>(
  tag: string,
  input: Input,
  onReturn: (value: Output) => Effect<A>,
): Effect<A> {
  return Object.freeze({
    _tag: "Op",
    tag,
    input,
    onReturn: (value: unknown) => onReturn(value as Output),
  });
}

/**
 * Interpret an effect synchronously and apply a terminal algebra.
 *
 * The loop replaces the current node rather than recursively evaluating the
 * continuation, so arbitrarily long operation chains do not consume the JS
 * call stack.
 */
export function fold<A, B>(
  effect: Effect<A>,
  handlers: HandlerMap,
  onReturn: (value: A) => B,
): B {
  try {
    let current = effect;
    for (;;) {
      if (current._tag === "Pure") {
        return onReturn(current.value);
      }

      const output = handlerFor(handlers, current.tag)(current.input as never);
      if (isPromiseLike(output)) {
        throw failure(
          "ASYNC_HANDLER_IN_SYNC_RUN",
          "A synchronous interpreter received an asynchronous handler result.",
          { tag: current.tag },
        );
      }
      current = current.onReturn(output);
    }
  } catch (error) {
    throw normalizeFailure(
      error,
      "EFFECT_RUN_FAILED",
      "Effect interpretation failed.",
    );
  }
}

/** Interpret an effect synchronously and return its terminal value. */
export function run<A>(effect: Effect<A>, handlers: HandlerMap): A {
  return fold(effect, handlers, (value) => value);
}

/** Asynchronously interpret an effect and apply an asynchronous terminal algebra. */
export async function foldAsync<A, B>(
  effect: Effect<A>,
  handlers: HandlerMap,
  onReturn: (value: A) => B | PromiseLike<B>,
): Promise<B> {
  try {
    let current = effect;
    for (;;) {
      if (current._tag === "Pure") {
        return await onReturn(current.value);
      }

      const output = await handlerFor(
        handlers,
        current.tag,
      )(current.input as never);
      current = current.onReturn(output);
    }
  } catch (error) {
    throw normalizeFailure(
      error,
      "EFFECT_RUN_ASYNC_FAILED",
      "Asynchronous effect interpretation failed.",
    );
  }
}

/** Asynchronously interpret an effect and return its terminal value. */
export function runAsync<A>(
  effect: Effect<A>,
  handlers: HandlerMap,
): Promise<A> {
  return foldAsync(effect, handlers, (value) => value);
}

/**
 * Acquire, use, and release an owned synchronous resource in one lexical call.
 * Release runs after success, callback return, or throw once acquisition
 * succeeds.
 */
export function scoped<Resource, A>(
  acquire: () => Resource,
  use: (resource: Resource) => A,
  release: (resource: Resource, exit: ScopeExit<A>) => void,
): A {
  let resource: Resource;
  try {
    resource = acquire();
  } catch (error) {
    throw normalizeFailure(
      error,
      "SCOPE_ACQUIRE_FAILED",
      "Resource acquisition failed.",
    );
  }

  let value: A;
  try {
    value = use(resource);
  } catch (useError) {
    try {
      release(resource, Object.freeze({ _tag: "Error", error: useError }));
    } catch (releaseError) {
      throw failure(
        "SCOPE_USE_AND_RELEASE_FAILED",
        "Resource use and release both failed.",
        {
          use: describeError(useError),
          release: describeError(releaseError),
        },
        useError,
      );
    }
    throw normalizeFailure(
      useError,
      "SCOPE_USE_FAILED",
      "Resource use failed.",
    );
  }

  try {
    release(resource, Object.freeze({ _tag: "Success", value }));
  } catch (error) {
    throw normalizeFailure(
      error,
      "SCOPE_RELEASE_FAILED",
      "Resource release failed.",
    );
  }
  return value;
}

/**
 * Async counterpart of scoped. A cooperative cancellation represented by a
 * rejected promise (including AbortError) follows the error release path.
 */
export async function scopedAsync<Resource, A>(
  acquire: () => Resource | PromiseLike<Resource>,
  use: (resource: Resource) => A | PromiseLike<A>,
  release: (resource: Resource, exit: ScopeExit<A>) => void | PromiseLike<void>,
): Promise<A> {
  let resource: Resource;
  try {
    resource = await acquire();
  } catch (error) {
    throw normalizeFailure(
      error,
      "SCOPE_ACQUIRE_FAILED",
      "Resource acquisition failed.",
    );
  }

  let value: A;
  try {
    value = await use(resource);
  } catch (useError) {
    try {
      await release(
        resource,
        Object.freeze({ _tag: "Error", error: useError }),
      );
    } catch (releaseError) {
      throw failure(
        "SCOPE_USE_AND_RELEASE_FAILED",
        "Resource use and release both failed.",
        {
          use: describeError(useError),
          release: describeError(releaseError),
        },
        useError,
      );
    }
    throw normalizeFailure(
      useError,
      isCancellation(useError) ? "SCOPE_CANCELLED" : "SCOPE_USE_FAILED",
      isCancellation(useError)
        ? "Resource use was cancelled."
        : "Resource use failed.",
    );
  }

  try {
    await release(resource, Object.freeze({ _tag: "Success", value }));
  } catch (error) {
    throw normalizeFailure(
      error,
      "SCOPE_RELEASE_FAILED",
      "Resource release failed.",
    );
  }
  return value;
}
