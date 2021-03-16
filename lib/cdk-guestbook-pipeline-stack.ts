import { CdkGuestbookApplicationStack } from './cdk-guestbook-application-stack';

import { Construct, Stage, Stack, StackProps, StageProps, CfnOutput, SecretValue } from '@aws-cdk/core';
import { CdkPipeline, SimpleSynthAction, ShellScriptAction } from '@aws-cdk/pipelines';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';


class GuestBookApplication extends Stage {
    public readonly apiEndPoint: CfnOutput;
    public readonly stackName: CfnOutput;
  
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);
        const stack = new CdkGuestbookApplicationStack(this, `${id}-staging-guestbook`);
        this.apiEndPoint = new CfnOutput(stack, 'API_ENDPOINT', {value: stack.apiEndpoint});
        this.stackName = new CfnOutput(stack, 'STACK_NAME', {value:stack.stackName});
    }
}


export class CdkGuestbookPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();
    
    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'GuestBookPipeline',
      cloudAssemblyArtifact,
      
      sourceAction: new GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        oauthToken: SecretValue.secretsManager("github_token", {jsonField: "GITHUB_TOKEN"}),
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
        synthCommand: 'npx cdk synth'
      }),
    });
    
    const testingStage = pipeline.addStage('Testing');
    testingStage.addApplication(new GuestBookApplication(this,'staging'));
    testingStage.nextSequentialRunOrder(-2);
    const e2eApplication = new GuestBookApplication(this,'e2e');
    testingStage.addApplication(e2eApplication);
    testingStage.addActions(new ShellScriptAction({
      actionName: "cypress-testing",
      commands: [
        "npm install -g yarn aws-cli",
        "yarn",
        "npx cypress run --env API_BASE_URL=${API_BASE_URL}",
        "aws cloudformation delete-stack --stack-name ${STACK_NAME}"
      ],
      additionalArtifacts: [sourceArtifact],
      useOutputs: {
        API_BASE_URL: pipeline.stackOutput(e2eApplication.apiEndPoint),
        STACK_NAME: pipeline.stackOutput(e2eApplication.stackName)
      },
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: [
            "cloudformation:DeleteStack",
            "cloudformation:DescribeStacks"            
          ],
          resources: ['*'],
        }),
      ],
    }))
    
    const deployStage = pipeline.addApplicationStage(
      new GuestBookApplication(this, 'prod'), 
      {manualApprovals: true}
    );
  }
}