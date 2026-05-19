import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const exec = promisify(execFile);
const secrets = new SecretsManagerClient();

export async function getGitToken(secretArn: string): Promise<string> {
  const res = await secrets.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  return res.SecretString!;
}

export async function cloneRepo(
  repoUrl: string,
  branch: string,
  token: string,
  destPath: string,
): Promise<void> {
  const authedUrl = repoUrl.replace(
    "https://",
    `https://x-access-token:${token}@`,
  );
  await exec("git", [
    "clone",
    "--branch",
    branch,
    "--depth",
    "1",
    authedUrl,
    destPath,
  ]);
}
