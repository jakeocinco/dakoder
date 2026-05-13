import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";

export interface DakoderStackProps extends cdk.StackProps {
  stackTag: string;
}

export class DakoderStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DakoderStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "Workspace", {
      bucketName: `${props.stackTag}-workspace`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const functionNames = ["orchestrator", "code", "build", "review"] as const;

    const functions = Object.fromEntries(
      functionNames.map((name) => {
        const fn = new lambda.Function(this, `${name}-fn`, {
          functionName: `${props.stackTag}-dakoder-${name}`,
          runtime: lambda.Runtime.NODEJS_22_X,
          handler: "index.handler",
          code: lambda.Code.fromInline(
            "exports.handler = async () => ({ statusCode: 200 });",
          ),
          timeout: cdk.Duration.minutes(15),
          environment: {
            BUCKET_NAME: this.bucket.bucketName,
            STACK_TAG: props.stackTag,
          },
        });
        this.bucket.grantReadWrite(fn);
        return [name, fn];
      }),
    ) as Record<(typeof functionNames)[number], lambda.Function>;

    for (const name of functionNames) {
      for (const other of functionNames) {
        if (other === name) continue;
        functions[name].addEnvironment(
          `${other.toUpperCase()}_FUNCTION_NAME`,
          functions[other].functionName,
        );
        functions[other].grantInvoke(functions[name]);
      }
    }

    const buildProject = new codebuild.Project(this, "BuildProject", {
      projectName: `${props.stackTag}-dakoder-build`,
      source: codebuild.Source.s3({
        bucket: this.bucket,
        path: "/",
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      environmentVariables: {
        BUCKET_NAME: { value: this.bucket.bucketName },
        STACK_TAG: { value: props.stackTag },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: { commands: ["npm install"] },
          build: { commands: ["npm test"] },
        },
      }),
    });

    this.bucket.grantRead(buildProject);
    functions["build"].addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["codebuild:StartBuild", "codebuild:BatchGetBuilds"],
        resources: [buildProject.projectArn],
      }),
    );
    functions["build"].addEnvironment(
      "CODEBUILD_PROJECT_NAME",
      buildProject.projectName,
    );

    new events.Rule(this, "BuildCompleteRule", {
      eventPattern: {
        source: ["aws.codebuild"],
        detailType: ["CodeBuild Build State Change"],
        detail: {
          "build-status": ["SUCCEEDED", "FAILED", "STOPPED"],
          "project-name": [buildProject.projectName],
        },
      },
      targets: [new targets.LambdaFunction(functions["build"])],
    });
  }
}
