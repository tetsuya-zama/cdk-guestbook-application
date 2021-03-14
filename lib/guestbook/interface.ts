import {Post} from './domain';
import {S3} from 'aws-sdk';

export interface NewPostRequest{
    name: string,
    message: string,
    image_file_name?: string
}

export function isNewPostRequest(obj: any): obj is NewPostRequest{
    return !!obj.name && typeof obj.name === 'string'
        && !!obj.message && typeof obj.message === 'string'
        && ((!!obj.image_file_name && typeof obj.image_file_name === 'string') || !obj.image_file_name)
}

export interface NewPostResponse{
    post: Post,
    file_upload_url?: string
}

export async function convertPostRequestToResponse(req: NewPostRequest, post: Post, fileBucketName: string, expiresIn: number = 300): Promise<NewPostResponse>{
    const {image_file_name} = req;
    if(image_file_name){
         const s3 = new S3({signatureVersion:"v4"});
         const file_upload_url = await s3.getSignedUrlPromise('putObject',{
            Bucket: fileBucketName,
            Key: `${post.id}/${image_file_name}`,
            Expires: expiresIn
         });
         
         return {post, file_upload_url}
    }else{
        return {post}
    }
}

export interface NewReplyRequest{
    post_id: string
    replyer_name: string
    reply_message: string
}

export function isNewReplyRequest(obj: any): obj is NewReplyRequest{
    return !!obj.post_id && typeof obj.post_id === 'string'
        && !!obj.replyer_name && typeof obj.replyer_name === 'string'
        && !!obj.reply_message && typeof obj.reply_message === 'string'
}