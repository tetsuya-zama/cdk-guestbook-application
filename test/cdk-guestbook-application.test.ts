import "@aws-cdk/assert/jest";
import * as cdk from '@aws-cdk/core';
import * as CdkGuestbookApplication from '../lib/cdk-guestbook-application-stack';

test('REST API Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CdkGuestbookApplication.CdkGuestbookApplicationStack(app, 'MyTestStack');
    // THEN
    expect(stack).toHaveResourceLike("AWS::DynamoDB::Table", {
      "KeySchema": [
        {
          "AttributeName": "h_key",
          "KeyType": "HASH"
        },
        {
          "AttributeName": "s_key",
          "KeyType": "RANGE"
        }
      ],
      "AttributeDefinitions": [
        {
          "AttributeName": "h_key",
          "AttributeType": "S"
        },
        {
          "AttributeName": "s_key",
          "AttributeType": "S"
        }
      ],
      "BillingMode": "PAY_PER_REQUEST"
    });
    
    expect(stack).toHaveResourceLike("AWS::S3::Bucket", {
      "CorsConfiguration": {
          "CorsRules": [
            {
              "AllowedHeaders": [
                "*"
              ],
              "AllowedMethods": [
                "POST",
                "PUT"
              ],
              "AllowedOrigins": [
                "*"
              ]
            }
          ]
        }
    });
    
    expect(stack).toHaveResource("AWS::Lambda::Function", {
        "Handler": "index.getIndexHandler",
        "Runtime": "nodejs12.x"
    });
    
    expect(stack).toHaveResource("AWS::Lambda::Function", {
        "Handler": "index.getPostHandler",
        "Runtime": "nodejs12.x"
    });
    
    expect(stack).toHaveResource("AWS::Lambda::Function", {
        "Handler": "index.postIndexHandler",
        "Runtime": "nodejs12.x"
    });
    
    expect(stack).toHaveResource("AWS::Lambda::Function", {
        "Handler": "index.postReplyHandler",
        "Runtime": "nodejs12.x"
    });
    
    expect(stack).toHaveResource("AWS::Lambda::Function", {
        "Handler": "index.deletePostHandler",
        "Runtime": "nodejs12.x"
    });
    
    expect(stack).toHaveResource("AWS::Lambda::Function", {
        "Handler": "index.imageUploadedHandler",
        "Runtime": "nodejs12.x"
    });
    
    expect(stack).toHaveResourceLike("AWS::ApiGateway::RestApi", {
      "Name": "guestbook-api"
    });
});
