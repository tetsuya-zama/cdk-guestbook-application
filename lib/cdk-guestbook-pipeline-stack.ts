import { CdkGuestbookApplicationStack } from './cdk-guestbook-application-stack';

import { Construct, Stage, Stack, StackProps, StageProps } from '@aws-cdk/core';
import { CdkPipeline, SimpleSynthAction } from '@aws-cdk/pipelines';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';


class GuestBookApplication extends Stage {
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);
        new CdkGuestbookApplicationStack(this, `${id}-staging-guestbook`);
    }
}


export class CdkGuestbookPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();
    
    const gitHubToken = this.node.tryGetContext('GITHUB_TOKEN');
    if(!gitHubToken) throw new Error('Context:GITHUB_TOKEN_NAME is required');
    
    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'GuestBookPipeline',
      cloudAssemblyArtifact,
      
      sourceAction: new GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        oauthToken: gitHubToken,
        // Replace these with your actual GitHub project name
        owner: 'tetsuya-zama',
        repo: 'cdk-guestbook-application',
        branch: 'master',
      }),
      
      synthAction: SimpleSynthAction.standardYarnSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        environment: {
          privileged: true
        },
        environmentVariables: {
          "GITHUB_TOKEN": {value: gitHubToken}
        },
        synthCommand: 'npx cdk synth -c GITHUB_TOKEN=$GITHUB_TOKEN'
      }),
      
      selfMutating: false
    });
    
    const testingStage = pipeline.addStage('Testing');
    testingStage.addApplication(new GuestBookApplication(this,'e2e'));
    testingStage.nextSequentialRunOrder(-2);
    testingStage.addApplication(new GuestBookApplication(this,'staging'));
    
    const deployStage = pipeline.addApplicationStage(
      new GuestBookApplication(this, 'prod'), 
      {manualApprovals: true}
    );
  }
}