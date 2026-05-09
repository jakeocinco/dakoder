import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
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
            'exports.handler = async () => ({ statusCode: 200 });'
          ),
          timeout: cdk.Duration.minutes(15),
          environment: {
            BUCKET_NAME: this.bucket.bucketName,
            STACK_TAG: props.stackTag,
          },
        });
        this.bucket.grantReadWrite(fn);
        return [name, fn];
      })
    ) as Record<(typeof functionNames)[number], lambda.Function>;

    for (const name of functionNames) {
      for (const other of functionNames) {
        if (other === name) continue;
        functions[name].addEnvironment(
          `${other.toUpperCase()}_FUNCTION_NAME`,
          functions[other].functionName
        );
        functions[other].grantInvoke(functions[name]);
      }
    }
  }
}
