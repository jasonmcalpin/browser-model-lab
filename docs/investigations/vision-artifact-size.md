# Vision benchmark artifact size investigation

Date: 2026-11-13

## Root cause

The oversized artifacts are caused by rasterized fixture images, encoded as `data:image/png;base64` strings, being retained in every successful trial's `VisionInvocation.imageUrl`. They are not model output, tensors, token arrays, WebGPU state, or runtime metadata.

The intended reference-only fix was merged in commit `12c1c53`, but commit `e600453` reverted the runner and type changes and deleted both `visionEvidence.ts` and its regression tests. The two oversized runs were produced later, at revision `ae618f0fac47-dirty`, with the reverted behavior. The fix is therefore not active in these artifacts or in the current source.

## Inspected artifacts and size attribution

Inspection parsed the JSON and measured values by path, serialized byte size, and SHA-256 without printing payload contents.

| Artifact | Candidate | File bytes | Image URL bytes | Share | Projected reference-only bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| `20261113T182305Z_mac-m4_ae618f0fac47-dirty.json` | `qwen35-0.8b-multimodal` | 107,693,311 | 107,613,288 | 99.926% | 78,824 |
| `20261113T182747Z_mac-m4_ae618f0fac47-dirty.json` | `qwen35-2b-q4f16` | 107,693,008 | 107,613,288 | 99.926% | 78,521 |

Both files exceed GitHub's 100 MiB limit (104,857,600 bytes) by about 2.84 MB. Gzip sizes are 81,441,479 and 81,441,288 bytes respectively; compression recovers much of base64's encoding overhead but does not change what the JSON stores.

All large strings occur at:

`candidates[0].visionCapability.cases[*].invocations[*].imageUrl`

There are 30 occurrences but only three distinct values. The exact duplication is:

| Runtime image | Serialized bytes each | Occurrences | Total bytes | Share of artifact | Decoded PNG bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `vision-three-people.png` raster | 3,703,992 | 12 | 44,447,904 | 41.273% | 2,777,974 |
| `vision-umbrella-bicycle.png` raster | 3,749,852 | 9 | 33,748,668 | 31.338% | 2,812,371 |
| `vision-empty-room.png` raster | 3,268,524 | 9 | 29,416,716 | 27.315% | 2,451,374 |

The images are repeated once per successful trial: four cases × three trials for the people image, three × three for the bicycle image, and three × three for the room image. The `visionCapability.cases` array alone serializes to approximately 107.63 MB; each affected case's three-entry `invocations` array is approximately 9.81–11.25 MB. All other data accounts for about 80 KB. Generated answer strings total 186 bytes in the 0.8B run and 156 bytes in the 2B run.

The runner's `imageCache` correctly limits rasterization to one data URL per source path during execution. That is only an execution cache: the same string is then referenced by 30 invocation objects, and JSON has no reference identity, so serialization writes all 30 copies.

## Comparison with text-only runs

For the same `ae618f0fac47` vision plan series, the eleven text-only candidates are 31,038–49,024 bytes. They contain no `data:image/` strings and either report vision as unsupported with zero cases or fail before producing a vision capability result. Earlier full-suite text-only artifacts are larger (approximately 0.88–7.31 MB) because they preserve extensive text transcripts, but still contain no image URLs and remain an order of magnitude below the GitHub limit.

The two multimodal artifacts are therefore about 2,200–3,400 times larger than the corresponding text-only vision-plan artifacts solely because they retain image data URLs per trial.

## Pipeline trace

1. **Browser vision runner:** `rasterizedVisionFixture` in `src/benchmark/benchmarkRunner.ts:54` fetches each fixture, redraws it to a 1600×900 canvas, and returns `canvas.toDataURL("image/png")` at line 66. `runVisionCapability` caches one string per path at lines 79–88.
2. **Runtime request construction:** `buildVisionInvocation` in `src/benchmark/modelAdapters.ts:71` places the complete data URL in `VisionInvocation.imageUrl`. The persisted type requires that field in `src/benchmark/types.ts:205`.
3. **Browser runtime client and worker:** `BenchmarkWorkerClient.generateVision` retains the invocation in `pendingVision` and sends it to the worker (`src/benchmark/workerClient.ts:41-50`). The worker consumes the URL at `src/benchmark/benchmark.worker.ts:172-213`; its completion message returns only raw text and metrics. The client then reattaches the retained runtime invocation to `VisionGenerationResult` at `src/benchmark/workerClient.ts:101-104`. The payload is necessary in the request, but not in the result.
4. **Model runtime:** `Qwen35DirectRuntime.generateVision` reads the data URL and creates the resized model input at `src/benchmark/modelRuntime.ts:64-72`. No tensors or processed image objects are returned to the artifact pipeline.
5. **Trial retention:** `runVisionCapability` pushes `result.invocation` unchanged for every trial at `src/benchmark/benchmarkRunner.ts:83-106`. The artifact type explicitly declares `cases[].invocations` as full `VisionInvocation[]` at `src/benchmark/types.ts:523-542`.
6. **Artifact assembly and browser automation:** `buildBrowserAiBenchmarkArtifact` passes candidate results through unchanged at `src/benchmark/artifact.ts:7-43`. Automation stores the complete artifact in its published browser state at `src/benchmark/automation.ts:130-135`.
7. **CLI transfer and serialization:** Playwright retrieves that state with `page.evaluate` (`scripts/run-browser-ai-benchmark.mjs:84-89`), retains each page artifact, shallow-merges candidates in `mergeBrowserAiArtifacts` (`scripts/browser-ai-benchmark-cli-lib.mjs:128-148`), and pretty-prints the entire graph with `JSON.stringify` at `scripts/run-browser-ai-benchmark.mjs:171-180`. This is where every repeated string becomes independent bytes on disk.
8. **Catalog materialization:** `scripts/export-model-capability-catalog.mjs:271-288` eagerly reads and parses every run artifact, so the large payloads also impose avoidable I/O and memory cost. `observationFromArtifact` at lines 114–137 does not copy `visionCapability` into the catalog; the generated catalog contains compact artifact references and is not the source of the file growth.

The Node runtime client has the same retention shape (`src/benchmark/nodeRuntimeClient.ts:145-176`), although the current browser plan is what produced the inspected artifacts.

## Why the earlier fix did not work

Commit `12c1c53` introduced:

- a `visionCapability.images` registry containing each repository path once;
- `imageId` references from fixtures and cases;
- a persisted invocation projection omitting `imageUrl`; and
- tests using a synthetic 4 MB data URL plus shared-image deduplication.

Commit `e600453`, six minutes later, reversed the runner and type changes and deleted `src/benchmark/visionEvidence.ts` and `src/benchmark/visionEvidence.test.ts`. Current artifacts confirm the reversal: `visionCapability` has only `supported`, `cases`, `score`, `maximum`, and `fixtures`; cases and fixtures contain `image`, not `imageId`; every successful invocation contains `imageUrl`; and no shared `images` registry exists.

## Recommended serialization contract

Separate the runtime request contract from durable evidence and make the conversion explicit at the runtime/evidence boundary:

- Keep an internal `RuntimeVisionInvocation` with `imageUrl` for worker transport only. It must never be a subtype of, or directly assignable to, persisted artifact evidence.
- Return or construct a fresh `VisionInvocationEvidence` containing only trial-specific data such as effective generation settings, compatibility profile, and termination/metrics. Do not use object spread or serialize an `Omit`-typed runtime object; TypeScript erasure would not remove extra runtime properties.
- Add an artifact-level image registry with one entry per distinct input. Each entry should include a stable `imageId`, repository-relative source path, MIME type, dimensions, byte length, and a SHA-256 digest of the exact raster supplied to the runtime. Record the deterministic rasterization transform/version. This preserves input identity and reproducibility without embedding bytes.
- Make fixtures reference `imageId`, and make cases reference their fixture (or the same `imageId`). The parent case owns the prompt, expected answer, scorer, and response cap; trial evidence need not duplicate the prompt or image. Preserve every generated response, metric, error, score, and effective setting.
- Validate the durable artifact at assembly/serialization time: vision evidence must not contain `data:`, `blob:`, `ArrayBuffer`, typed arrays, or runtime image/tensor objects. Fail visibly if the projection is bypassed.
- Version this as artifact schema 14. The earlier implementation changed the shape while leaving `schemaVersion: 13`; that would make two incompatible layouts claim the same schema.

This design preserves authoritative evidence while treating the runtime image payload as ephemeral transport data. It does not truncate or discard prompts, answers, expected values, metrics, failures, or scoring evidence.

## Compatibility and migration

- Existing schema-13 artifacts remain immutable and readable. Do not rewrite them in place. Readers should support both the legacy inline layout and schema 14's reference layout during migration.
- The production rescore command currently changes only `productionFitness` and spreads the rest of each candidate/artifact through. It should preserve either vision layout, but needs explicit schema-13/schema-14 regression coverage.
- The catalog materializer currently ignores detailed vision evidence, so the corrected layout should not alter catalog output. It must accept both schema versions; parsing reference-only artifacts will substantially reduce its I/O and peak memory. Adding vision qualification to the catalog is a separate contract decision.
- UI and summary code use the vision score and fixture IDs, so they require only a small type/layout adjustment. Any external consumer that reads `cases[].image`, `fixtures[].image`, or invocation `imageUrl` must migrate to registry references.
- Rollout order should be: introduce versioned types and dual-version readers; project runtime results into schema-14 evidence; add validation and end-to-end tests; then produce new runs. Rollback is simply continued schema-13 reader support, not mutation of historical files.

## Regression tests

1. Unit-test that a multi-megabyte `data:image` runtime invocation becomes a small evidence object with no payload while the runtime request remains unchanged.
2. Unit-test stable image registry deduplication across multiple fixtures sharing one image and across multiple trials. Include digest, dimensions, transform version, and rejected external/unsafe paths.
3. Run `runVisionCapability` with a fake client that returns full runtime invocations. Serialize the complete artifact and assert that all prompts, expected answers, outputs, metrics, errors, and scores remain, while no `data:image`, `blob:`, typed array, or image bytes appear.
4. Test the browser worker-client boundary: the worker request must receive the image payload, but the completed durable result must expose only reference/evidence fields. Add the equivalent Node client test.
5. Add a CLI serialization test that uses shared images and three trials, writes through the same merge/stringify path, and asserts size grows with evidence count, not image byte count.
6. Add schema compatibility tests for legacy schema 13 and reference-based schema 14 in the rescore tool, catalog materializer, summary formatter, and UI fixtures.
7. Add a targeted artifact invariant test that rejects inline vision payloads. Use a synthetic payload rather than a blanket string-length cap so legitimate generated responses are never truncated.
8. Ensure the regression test files are included in the repository's normal `pnpm test` command so deleting or bypassing the projection cannot silently restore the old behavior.

## Expected reduction

Deleting only the 30 `imageUrl` properties from the inspected objects reduces the pretty-printed artifacts to 79,123 and 78,820 bytes. Applying the full registry/reference shape yields 78,824 and 78,521 bytes in an in-memory serialization simulation: a 99.927% reduction, or approximately 107.61 MB per artifact. Adding digests, dimensions, MIME types, and a transform identifier should keep these specific runs around 80 KB and comfortably below 0.1 MB. The estimate is based on the actual retained evidence, not on truncating any responses or trial records.

## Related defects, separate from the size root cause

- The two SVG-backed cases, `table-text` and `table-reasoning`, did not run. Both artifacts record `The source image could not be decoded.`, zero invocations, and zero outputs. The reported scores are 9/12 and 10/12, not twelve successfully executed fixtures.
- Those failed cases report `attemptCount: 3` despite zero actual attempts reaching the runtime. The field currently records configured trials rather than observed attempts, which is misleading evidence.
- The current catalog materializer does not project vision scores or qualifications at all. That is not responsible for artifact size, but it conflicts with the expectation that the compact catalog exposes measured vision capability and deserves a separate contract decision.
- The catalog materializer eagerly parses all full artifacts before projecting compact observations. Reference-only artifacts remove the immediate pressure, but streaming or per-file projection would further bound memory as the run archive grows.
