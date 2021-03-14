import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3n from '@aws-cdk/aws-s3-notifications';
import * as lmd from '@aws-cdk/aws-lambda';
import * as lmdjs from '@aws-cdk/aws-lambda-nodejs';
import * as agw from '@aws-cdk/aws-apigateway';

export class CdkGuestbookApplicationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const guestbookTable = new dynamodb.Table(this, 'guestbooktable', {
      partitionKey: {name: 'h_key', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 's_key', type: dynamodb.AttributeType.STRING},
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });
    
    const imageFileBucket = new s3.Bucket(this, 'guestbook-images', {
      cors : [{allowedOrigins: ["*"], allowedMethods: [s3.HttpMethods.POST, s3.HttpMethods.PUT], allowedHeaders:["*"]}],
      publicReadAccess: true
    });
    
    const lmdEnvironments = {
      "GUEST_BOOK_TABLE_NAME": guestbookTable.tableName,
      "FILE_BUCKET_NAME": imageFileBucket.bucketName,
    }
    
    const commonLambdaSetting: Partial<lmd.FunctionProps> = {
      environment: lmdEnvironments,
      tracing: lmd.Tracing.ACTIVE,
      timeout: cdk.Duration.minutes(3)
    }
    
    const getIndexJs = new lmdjs.NodejsFunction(this, 'get-index-js', {
      entry: "./lib/guestbook/resthandlers.ts",
      handler: "getIndexHandler",
      ...commonLambdaSetting
    });
    
    guestbookTable.grantReadData(getIndexJs);
    
    const getPostJs = new lmdjs.NodejsFunction(this, 'get-post-js', {
      entry: "./lib/guestbook/resthandlers.ts",
      handler: "getPostHandler",
      ...commonLambdaSetting
    });
    
    
    guestbookTable.grantReadData(getPostJs);
    
    const postIndexJs = new lmdjs.NodejsFunction(this, 'post-index-js', {
      entry: "./lib/guestbook/resthandlers.ts",
      handler: "postIndexHandler",
      ...commonLambdaSetting
    });
    
    
    guestbookTable.grantReadWriteData(postIndexJs);
    imageFileBucket.grantWrite(postIndexJs);
    
    const postReplyJs = new lmdjs.NodejsFunction(this, 'post-reply-js', {
      entry: "./lib/guestbook/resthandlers.ts",
      handler: "postReplyHandler",
      ...commonLambdaSetting
    });
    
    guestbookTable.grantReadWriteData(postReplyJs);
    
    const deletePostJs = new lmdjs.NodejsFunction(this, 'delete-post-js', {
      entry: "./lib/guestbook/resthandlers.ts",
      handler: "deletePostHandler",
      ...commonLambdaSetting
    });
    
    guestbookTable.grantReadWriteData(deletePostJs);
    
    const onImageUploaded = new lmdjs.NodejsFunction(this, 'on-image-uploaded', {
      entry: "./lib/guestbook/s3handlers.ts",
      handler: "imageUploadedHandler",
      ...commonLambdaSetting
    });
    
    guestbookTable.grantReadWriteData(onImageUploaded);
    imageFileBucket.addEventNotification(s3.EventType.OBJECT_CREATED ,new s3n.LambdaDestination(onImageUploaded));
    
    const api = new agw.RestApi(this, 'guestbook-api', {
      defaultCorsPreflightOptions: {
        allowOrigins: agw.Cors.ALL_ORIGINS,
        allowMethods: agw.Cors.ALL_METHODS
      },
      deployOptions: {
        tracingEnabled: true
      }
    });
    
    
    const root = api.root;
    root.addMethod('GET', new agw.LambdaIntegration(getIndexJs));
    root.addMethod('POST', new agw.LambdaIntegration(postIndexJs));

    const posts = root.addResource('posts');
    posts.addMethod('GET', new agw.LambdaIntegration(getIndexJs));
    posts.addMethod('POST', new agw.LambdaIntegration(postIndexJs));

    const postsPostId = posts.addResource('{postid}');
    postsPostId.addMethod('GET', new agw.LambdaIntegration(getPostJs));
    postsPostId.addMethod('DELETE', new agw.LambdaIntegration(deletePostJs));

    const jsPostsPostIdReplies = postsPostId.addResource('replies');
    jsPostsPostIdReplies.addMethod('POST', new agw.LambdaIntegration(postReplyJs));
  }
}
