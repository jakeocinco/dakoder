# CDK Spec

## Description

CDK infrastructure for the Dakoder system.

## Requirements

- All resources named with a stack tag prefix for uniqueness (e.g., `{stackTag}-orchestrator`)
- S3 bucket used as shared file system across all Lambdas
- Lambdas have read/write permissions to the S3 bucket
- Each Lambda function defined separately (orchestrator, code, build, review)
- Lambdas use S3 file system (EFS not needed)

## Stack Tag

A configurable prefix applied to all resource names to ensure uniqueness across environments/deployments.
