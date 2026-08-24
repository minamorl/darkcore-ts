# Free choices

Only choices explicitly marked `free` by the domain spec are recorded here.

| Free key                                                 | Choice                                                    |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `darkcore_ts.build_tooling`                              | Plain `tsc` ESM build plus npm scripts and Prettier gate  |
| `darkcore_ts.compiler_version`                           | TypeScript 5.9.2                                          |
| `darkcore_ts.test_runner_version`                        | The `node:test` runner supplied by Node.js 20 or newer    |
| `darkcore_ts.internal_module_layout`                     | One public module at `src/index.ts`                       |
| `darkcore_ts.continuation_queue.internal_representation` | A mutable current-node slot advanced by an iterative loop |
| `darkcore_ts.internal_error_representation`              | A private `Error` subclass carrying the required envelope |
