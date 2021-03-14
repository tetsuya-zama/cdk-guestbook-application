#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkGuestbookPipelineStack } from '../lib/cdk-guestbook-pipeline-stack';

const app = new cdk.App();
new CdkGuestbookPipelineStack(app, 'CdkGuestbookPipelineStack');
