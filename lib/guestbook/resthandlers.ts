import { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { GuestBookService, PostNotFoundError } from './domain';
import { PostRepositoryDynamoDBImpl } from './impl';
import { isNewPostRequest, isNewReplyRequest, convertPostRequestToResponse } from './interface';

import trend_app_protect from 'trend_app_protect';

const GUEST_BOOK_TABLE_NAME = process.env['GUEST_BOOK_TABLE_NAME'];
const FILE_BUCKET_NAME = process.env['FILE_BUCKET_NAME'];

const CORS_HEADER: {[key:string]: string} = {
    "Access-Control-Allow-Origin": "*"
}

type ResponseHeaders = {[header:string]: string | boolean | number};

const  createResult = 
    (statusCode: number) => 
    (body:string = "", headers: ResponseHeaders = {}) => 
    ({statusCode, body, headers: {...headers, ...CORS_HEADER}});

const createSuccessResult = createResult(200);
const createBadRequestResult = createResult(400);
const createNotFoundResult = createResult(404);
const createInternalServerErrorResult = createResult(500);

function composeGuestBookService(){
    if(GUEST_BOOK_TABLE_NAME){
        return new GuestBookService(new PostRepositoryDynamoDBImpl(GUEST_BOOK_TABLE_NAME));
    } else {
        throw new Error('Environment Variable "GUEST_BOOK_TABLE_NAME" is required.');
    }
}

// GET: /, GET: /posts
export const getIndexHandler:APIGatewayProxyHandler = trend_app_protect.api.aws_lambda.protectHandler(async () => {
    const service = composeGuestBookService();
    const result = await service.getPosts();

    return result.isSuccess() ? 
        (posts => createSuccessResult(JSON.stringify(posts)))(result.value)
        : (err => {
            console.error(err);
            return createInternalServerErrorResult()
        })(result.value)
})

// GET /posts/{postid}
export const getPostHandler: APIGatewayProxyHandler = trend_app_protect.api.aws_lambda.protectHandler(async (event: APIGatewayProxyEvent) => {
    const postId = event.pathParameters?.postid;
    if(!postId) return createBadRequestResult(); 
    
    const service = composeGuestBookService();
    const result = await service.findPostById(postId);
    
    return result.isSuccess() ? 
        (post => {
            return !!post ? 
            createSuccessResult(JSON.stringify(post))
            : createNotFoundResult()
        })(result.value)
        : (err => {
            console.error(err);
            return createInternalServerErrorResult();
        })(result.value)
} );

// POST: / , POST: /posts
export const postIndexHandler:APIGatewayProxyHandler = trend_app_protect.api.aws_lambda.protectHandler(async (event: APIGatewayProxyEvent) => {
    if(!FILE_BUCKET_NAME){
        throw new Error('Environment Variable "FILE_BUCKET_NAME" is required.');
    }
    
    const requestBody = event.body;
    if(!requestBody) return createBadRequestResult();
    
    const payload = JSON.parse(requestBody);

    return isNewPostRequest(payload) ? 
        await (async (payload) => {
            const service = composeGuestBookService();
            const result = await service.addNewPost(payload.name, payload.message, null);
            
            return result.isSuccess() ? 
                await (async (post) => {
                    const response = await convertPostRequestToResponse(payload, post, FILE_BUCKET_NAME);
                    return createSuccessResult(JSON.stringify(response));
                })(result.value)
                : (err => {
                    console.error(err);
                    return createInternalServerErrorResult();
                })(result.value)
        })(payload)
        : createBadRequestResult()
});

// POST: /posts/{postid}/replies
export const postReplyHandler: APIGatewayProxyHandler = trend_app_protect.api.aws_lambda.protectHandler(async (event: APIGatewayProxyEvent) => {
    const postId = event.pathParameters?.postid;
    const requestBody = event.body;
    
    if(!postId || !requestBody) return createBadRequestResult();
    
    const payload = {post_id:postId, ...JSON.parse(requestBody)}

    return isNewReplyRequest(payload) ? 
        await (async (payload) => {
            const service = composeGuestBookService();
            const result = await service.addNewReplyToPost(payload.post_id, payload.replyer_name, payload.reply_message);
            
            return result.isSuccess() ? 
                createSuccessResult()
                : (err => {
                    return err instanceof PostNotFoundError ? 
                        createNotFoundResult()
                        : (err => {
                            console.error(err);
                            return createInternalServerErrorResult();
                        })(err)
                })(result.value)
        })(payload)
        : createBadRequestResult()
});

// DELETE: /posts/{postid}
export const deletePostHandler: APIGatewayProxyHandler = trend_app_protect.api.aws_lambda.protectHandler(async (event: APIGatewayProxyEvent) => {
    const postId = event.pathParameters?.postid;
    
    if(!postId) return createBadRequestResult();
    
    const service = composeGuestBookService();
    const result = await service.removePost(postId);
    
    return result.isSuccess() ? 
        createSuccessResult()
        : result.value instanceof PostNotFoundError ? 
            createNotFoundResult()
            : (err => {
                console.error(err)
                return createInternalServerErrorResult()
            })(result.value);
});