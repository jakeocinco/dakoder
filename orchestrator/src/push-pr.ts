import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getGitToken } from "./git.ts";

const exec = promisify(execFile);

const getRepoUrl = () => process.env.REPO_URL!;
const getDefaultBranch = () => process.env.DEFAULT_BRANCH || "main";
const getBranchPrefix = () => process.env.BRANCH_PREFIX || "dakoder/";
const getCredentialsSecret = () => process.env.GIT_CREDENTIALS_SECRET!;

export async function pushBranchAndOpenPR(
  taskId: string,
  localPath: string,
  description: string,
): Promise<{ prUrl: string }> {
  const token = await getGitToken(getCredentialsSecret());
  const repoUrl = getRepoUrl();
  const authedUrl = repoUrl.replace(
    "https://",
    `https://x-access-token:${token}@`,
  );
  const branch = `${getBranchPrefix()}${taskId}`;

  await exec("git", ["init"], { cwd: localPath });
  await exec("git", ["checkout", "-b", branch], { cwd: localPath });
  await exec("git", ["add", "."], { cwd: localPath });
  await exec(
    "git",
    ["commit", "-m", description, "--author", "dakoder <dakoder@noreply>"],
    { cwd: localPath },
  );
  await exec("git", ["remote", "add", "origin", authedUrl], {
    cwd: localPath,
  });
  await exec("git", ["push", "-u", "origin", branch], { cwd: localPath });

  // Open PR via GitHub API
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const prUrl = await createPR(token, owner, repo, branch, description);
  return { prUrl };
}

function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) throw new Error(`Cannot parse GitHub URL: ${url}`);
  return { owner: match[1], repo: match[2] };
}

async function createPR(
  token: string,
  owner: string,
  repo: string,
  head: string,
  title: string,
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        title,
        head,
        base: getDefaultBranch(),
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub PR creation failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { html_url: string };
  return data.html_url;
}
