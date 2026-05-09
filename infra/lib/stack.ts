import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
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
  }
}
