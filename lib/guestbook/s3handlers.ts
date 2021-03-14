import {S3Event} from 'aws-lambda';
import {GuestBookService} from './domain';
import {PostRepositoryDynamoDBImpl} from './impl';

const GUEST_BOOK_TABLE_NAME = process.env['GUEST_BOOK_TABLE_NAME'];

function composeGuestBookService(){
    if(GUEST_BOOK_TABLE_NAME){
        return new GuestBookService(new PostRepositoryDynamoDBImpl(GUEST_BOOK_TABLE_NAME));
    } else {
        throw new Error('Environment Variable "GUEST_BOOK_TABLE_NAME" is required.');
    }
}

export async function imageUploadedHandler(event:S3Event){
    const region = process.env.AWS_REGION;
    if(!region) throw new Error("Environment Variable AWS_REGION is missing");
    
    for(const record of event.Records){
        if(record.eventName.startsWith('ObjectCreated:')){
            const bucket = record.s3.bucket.name;
            const key = record.s3.object.key;
            const [postId] = key.split('/');
            const imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`; 
            
            const service = composeGuestBookService();
            
            const result = await service.imageUploaded(postId, imageUrl);
            
            if(result.isFailure()){
                console.error(result.value);
            }
        }
    }
}