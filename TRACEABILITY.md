# Spec traceability

## Domain pins

| Pin(s)                                                                                                                 | Evidence                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `darkcore.rewrite.standalone`, `darkcore.package.*`                                                                    | Standalone package metadata in `package.json`: `@minamorl/darkcore` version `0.1.0`                                   |
| `darkcore.rewrite.no_fp_ts_hkt_surface`, `darkcore.api.surface.no_datatype_catalog`, `darkcore.operator_overload.none` | Closed exports test; no runtime dependency, HKT, typeclass, datatype catalog, transformer, or overloaded operator     |
| `darkcore.capability.boundary`, `darkcore.capability.handler_map`                                                      | `HandlerMap` is passed explicitly to every interpreter call                                                           |
| `darkcore.resource.same_scope`, `darkcore.scoped.release_coverage`                                                     | `scoped` and `scopedAsync` own acquire/use/release; tests cover success, return, error, and cooperative cancellation  |
| `darkcore.interpreter.stack_safety`                                                                                    | `fold` and `foldAsync` use current-node loops; tests execute 100,000 sync and 10,000 async operations                 |
| `darkcore.effect.tagged_data`, `darkcore.effect.single_tagged_node`                                                    | `Effect` is the discriminated `Pure \| Op` tagged-data type                                                           |
| `darkcore.api.surface.closed_set`, `darkcore.api.surface.types_directly_required_only`                                 | Runtime export-set test and generated declaration; only `Effect`, `HandlerMap`, and `ScopeExit` support the functions |
| `darkcore.pure.closed_effect`                                                                                          | `pure` constructs a frozen terminal node                                                                              |
| `darkcore.bind.structure_composition_only`, `darkcore.bind.no_category_algebra_fill`                                   | There is no public bind; `op.onReturn` only constructs the next node                                                  |
| `darkcore.algebra.site`                                                                                                | Operation algebra is in handlers; terminal algebra is the `fold` / `foldAsync` `onReturn`                             |
| `darkcore.dispatch.tag`                                                                                                | Interpreter indexes the explicit handler map by `Op.tag`                                                              |

The berylx-ts and TypeScript-rule pins are outside this package worktree and are
left for their owning phases.

## Imported house pins

| Pin(s)                                                                    | Evidence or applicability                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `code.error.envelope`, `code.error.http_shape`, `code.error.no_raw_stack` | Private error implementation exposes `code/message/details/trace_id`; tests verify the shape and details omit stack data |
| `code.id.scheme`, `code.time.tz`                                          | Trace IDs use a UTC-epoch ULID representation                                                                            |
| `code.ci.format_prettier`                                                 | `format:check` is the first gate in the `ci` script                                                                      |
| log, secret, write-idempotency, retry pins                                | Not applicable: the package logs nothing, reads no secrets, performs no writes, and retries nothing                      |
| derived-cache pins                                                        | Not applicable: the package has no expensive repeated derived-state query or cache                                       |
| identity canonicalization pins                                            | Not applicable: the package accepts no path, module, or domain ID input                                                  |
| owned-resource house pins                                                 | Same-scope ownership and all in-language exits are exercised by the scoped tests; ownership never escapes                |
| maintainer-exemplar evidence pins                                         | Not applicable: no maintainer attribution or exemplar claim is made                                                      |
