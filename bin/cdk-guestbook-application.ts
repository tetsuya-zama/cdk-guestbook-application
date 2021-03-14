#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkGuestbookApplicationStack } from '../lib/cdk-guestbook-application-stack';

const app = new cdk.App();
new CdkGuestbookApplicationStack(app, 'CdkGuestbookApplicationStack');
