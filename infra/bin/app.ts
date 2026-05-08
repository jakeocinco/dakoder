#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DakoderStack } from "../lib/stack";

const app = new cdk.App();
const stackTag = app.node.tryGetContext("stackTag") || "dakoder";

new DakoderStack(app, `${stackTag}-stack`, { stackTag });
