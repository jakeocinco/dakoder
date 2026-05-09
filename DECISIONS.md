# Decisions & Trade-offs

## Compute: Lambda (no VPC)

**Decision:** Use Lambda without a VPC.

**Rationale:**
- S3 Files and EFS both require a VPC with NFS mount targets
- A VPC requires a NAT Gateway (~$66/month minimum) for internet access (GitHub, Claude API)
- Lambda without VPC has zero baseline cost and simpler networking
- Workers use S3 via SDK + `/tmp` (10GB) as working directory
- Acceptable since workers run sequentially, not concurrently on the same files

**Trade-offs accepted:**
- Must download from S3 to `/tmp`, work locally, then upload back
- 15-minute max execution time per Lambda invocation
- 10GB `/tmp` limit per invocation

## Storage: S3 via SDK (not S3 Files)

**Decision:** Use S3 as durable storage accessed via the AWS SDK, not as a mounted filesystem.

**Rationale:**
- S3 Files (announced April 2026) provides POSIX filesystem semantics on S3 but requires a VPC
- The download/upload pattern is acceptable for our async sequential workflow
- Avoids VPC complexity and NAT Gateway costs

## Build: CodeBuild (not in-Lambda)

**Decision:** Use AWS CodeBuild for build/test steps, triggered by the Build Lambda.

**Rationale:**
- Can't run `cargo build` or heavy compilation inside Lambda (no toolchain, 15-min timeout, limited resources)
- CodeBuild provides isolated containers with any toolchain via Docker images
- Pay-per-build-minute ($0.005/min for small), no baseline cost
- No VPC required
- Full stdout/stderr captured — ideal feedback for the coding agent on failures
- Free tier: 100 build minutes/month

**Trade-offs accepted:**
- ~30-60s startup latency per build (container provisioning)
- Slightly more complex async flow (Build Lambda triggers CodeBuild, polls or uses EventBridge for completion)

## Open Questions

-
