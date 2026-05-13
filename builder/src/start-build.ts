import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";

const codebuild = new CodeBuildClient();
const getProjectName = () => process.env.CODEBUILD_PROJECT_NAME!;
const getBucket = () => process.env.BUCKET_NAME!;

export async function startBuild(taskId: string): Promise<{ buildId: string }> {
  const res = await codebuild.send(
    new StartBuildCommand({
      projectName: getProjectName(),
      sourceLocationOverride: `${getBucket()}/${taskId}/`,
      sourceTypeOverride: "S3",
      environmentVariablesOverride: [
        { name: "TASK_ID", value: taskId, type: "PLAINTEXT" },
      ],
    }),
  );
  return { buildId: res.build!.id! };
}
