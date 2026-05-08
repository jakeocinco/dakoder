import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface DakoderStackProps extends cdk.StackProps {
  stackTag: string;
}

export class DakoderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DakoderStackProps) {
    super(scope, id, props);
  }
}
