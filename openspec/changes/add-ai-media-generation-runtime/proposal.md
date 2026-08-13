## Why

Manypost's synchronous, single-image path is not sufficient for reliable image
and video generation. Long-running paid provider calls require durable
asynchronous state, explicit budget reservation, ambiguous-submission recovery,
tenant-scoped storage and truthful output ingestion before Manypost can safely
offer richer creative workflows.

This change establishes that shared foundation and the guided image/video
experience first. User-authored graphs, App Mode and Comfy Studio depend on the
foundation but have distinct security, orchestration, deployment and rollout
risks, so they are planned as follow-up changes instead of being coupled to the
initial runtime.

## What Changes

- Keep Manypost as the authoritative control plane for authentication,
  organizations, entitlements, billing, durable job state, storage, publishing
  and observability.
- Add organization-scoped asynchronous generation for the guided
  `social-image-create`, `social-image-edit`, `social-video-from-prompt` and
  `social-video-from-image` operations.
- Run inference only through approved third-party APIs. Do not deploy model
  weights, CUDA, GPU workers, Comfy Cloud or self-hosted inference.
- Add registered server-side image/video provider adapters with stable
  capability metadata and submit, inspect, cancel and result-fetch semantics.
  Persist routing snapshots and provider identifiers so callbacks and polling
  can reconcile the same attempt after a crash or restart.
- Gate image and video independently through explicit `ai_image` and
  `ai_video` entitlements, and advertise only capabilities supported by the
  current installation and approved provider catalogue.
- Quote and reserve the maximum declared customer-credit cost before provider
  submission. Track actual third-party monetary cost separately and settle the
  internal reservation exactly once.
- Produce one primary media output per generation at launch. User-requested
  variants and batches are separate idempotent generation resources; canonical
  derivatives such as thumbnails are not separate billable outputs.
- Persist the generation and reservation before enqueueing work. Recover a
  committed queued generation when the initial pg-boss enqueue is missed.
- Represent provider acceptance ambiguity explicitly. A persistently
  `submission_uncertain` attempt requires audited operator reconciliation and
  is never retried blindly as a new paid submission.
- Move large inputs and outputs through organization-scoped object storage,
  ingest ephemeral provider results before success, validate and normalize
  media, and expose durable results through the existing media library.
  Production video requires S3-compatible storage and the bounded media tools
  declared by the runtime.
- Encrypt retained generation prompts and provider-runtime inputs, exclude
  them from logs, purge content-bearing runtime data after 30 days, and retain
  only the non-content provenance and accounting data required by policy.
- Preserve `POST /v1/ai/image` while the composer migrates to the asynchronous
  guided runtime.
- Add provider/model evaluation, promotion, rollout and rollback gates so
  external API changes do not alter stable Manypost contracts.
- Publish stable generation, provider-attempt, accounting and output contracts
  for later workflow-runtime, App Mode and Studio changes.

## Goals

- Deliver safe guided image and video generation without making customers
  administer inference infrastructure.
- Make long-running paid provider execution durable across API, worker,
  database, queue and storage failures.
- Prevent duplicate charges and unbounded spend while preserving truthful
  recovery when provider acceptance is uncertain.
- Preserve tenant isolation, auditability, accessibility, provenance, content
  rights and clear cost disclosure.
- Establish a stable execution foundation for future advanced workflow
  orchestration without coupling it to a graph editor or executor.

## Non-goals

- Deploying or integrating ComfyUI, App Mode, Comfy Studio or user-authored
  workflow graphs in this change.
- Using Comfy Cloud, RunPod, local model weights, CUDA, GPU workers or
  self-hosted inference.
- Producing a batch, fan-out or multiple user-visible variants inside one
  generation resource.
- Exposing advanced LoRA, ControlNet, IP-Adapter, seed, sampler or similar
  controls unless a later provider-specific capability change reviews their
  API contract, rights, retention and cost.
- Training or executing local LoRAs/checkpoints.
- Blind retry or fallback after an external API may have accepted a paid job.
- A non-linear video editor, avatar/face/lip/voice cloning or automatic
  publishing.

## Capabilities

### New Capabilities

- `ai-media-generation-runtime`: durable guided asynchronous media generation,
  provider execution and recovery, tenant-safe output ingestion, accounting
  and observability.

### Modified Capabilities

- `ai-budget-control`: bound long-running provider jobs with maximum credit
  reservations, independent provider-cost accounting and spend limits.
- `ai-image-generation`: add asynchronous create/edit operations through
  approved image APIs while preserving the compatibility endpoint.
- `ai-provider-runtime`: add registered image/video API adapters, capability
  metadata and idempotent submit/inspect/cancel/result execution.
- `media-object-storage`: transport scoped generation inputs and permanently
  ingest ephemeral provider image/video outputs.
- `composer-authoring-experience`: add guided asynchronous image/video
  generation with deliberate result attachment.

## Impact

- **Code/API:** adds generation and provider-attempt state machines and ports in
  `packages/core`, organization-scoped repositories in `packages/db`,
  pg-boss execution/recovery in `packages/queue` and the worker, Hono/OpenAPI
  resources, and guided composer integration. `packages/generative-media`
  contains concrete provider adapters, catalogue serialization and bounded
  media processors; business invariants remain in core.
- **Data:** adds additive generation, provider-attempt, output, event and
  accounting persistence plus encrypted runtime-input and retention metadata.
  Existing media, credits and provider records remain valid.
- **Dependencies:** adds only reviewed provider API clients or HTTP adapters and
  bounded FFmpeg/ffprobe processing. It adds no ComfyUI, Python, model-weight or
  GPU runtime dependency.
- **Security/privacy:** every resource and callback is organization-scoped;
  prompts, provider bodies, credentials and signed URLs stay out of logs;
  content-bearing runtime inputs are encrypted and purged after 30 days.
- **Product identity:** no Postiz reference changes. Manypost naming remains
  unchanged.
- **Railway:** adds no service. Existing API/web/worker, PostgreSQL, Redis and
  S3-compatible storage remain the runtime. Video capabilities fail closed
  when required object storage or media tools are unavailable.

## Compatibility

`POST /v1/ai/image` keeps its existing contract during migration. New clients
use stable Manypost generation identifiers. Existing image-provider
configuration, credits, plans and media remain valid; the new `ai_video`
entitlement is gated independently. Installations without production-capable
object storage or media tools advertise video as unavailable while retaining
compatible image behavior. Future workflow/App/Studio changes consume the
stable generation and provider contracts defined here.

## Rollback

Disable new asynchronous routes, provider-catalogue entries and the `ai_video`
entitlement first. Keep callback receipt, polling, cancellation, output
ingestion and operator reconciliation active until every accepted or uncertain
provider attempt reaches a truthful terminal resolution. Revert application
exposure while retaining additive generation, accounting and media data; do
not reverse production migrations destructively. Stop retention processing or
remove its configuration only after no active generation depends on it, and do
not attempt to restore content already purged by policy.
