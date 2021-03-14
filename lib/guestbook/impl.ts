import { DocumentClient } from "aws-sdk/clients/dynamodb";
import moment from 'moment';
import {Optional, PostRepository, Post, Reply, Result, Success, Failure} from './domain';

const TYPE_POST = 'Post';
const TYPE_REPLY = 'Reply';

export type PostDataSetDynamoDBRow = PostDynamoDBRow | ReplyDynamoDBRow;

export class PostDynamoDBRow {
    constructor(
        readonly h_key: string,
        readonly s_key: string,
        readonly name: string,
        readonly message: string,
        readonly image_url: Optional<string>,
        readonly posted_at: number,
    ) {}
    
    readonly type_ = TYPE_POST
    
    isPost(): this is PostDynamoDBRow{
        return true;
    }
    
    isReply(): this is ReplyDynamoDBRow{
        return false;
    }
    
    static fromPost(post: Post): PostDynamoDBRow{
        return new PostDynamoDBRow(
            post.id,
            post.id,
            post.name,
            post.message,
            post.imageUrl,
            post.postedAt.valueOf()
        );
    }
    
    toPost(replies: Array<Reply>): Post{
        return new Post(
            this.h_key,
            this.name,
            this.message,
            this.image_url,
            moment(this.posted_at),
            replies
        );
    }
}

export class ReplyDynamoDBRow {
    constructor(
        readonly h_key: string,
        readonly s_key: string,
        readonly name: string,
        readonly message: string,
        readonly posted_at: number,
    ){}
    
    readonly type_ = TYPE_REPLY
    
    isPost(): this is PostDynamoDBRow{
        return false;
    }
    
    isReply(): this is ReplyDynamoDBRow{
        return true;
    }
    
    static fromReply(postId: string, reply: Reply): ReplyDynamoDBRow{
        return new ReplyDynamoDBRow(
            postId,
            reply.id,
            reply.name,
            reply.message,
            reply.postedAt.valueOf()
        );
    }
    
    toReply(): Reply{
        return new Reply(
            this.s_key,
            this.name,
            this.message,
            moment(this.posted_at)
        );
    }
}

export function parseDynamoItem(item: {[key: string]: any}): Result<PostDataSetDynamoDBRow, unknown>{
    const type = item["type_"];
    
    if(type === TYPE_POST){
        return new Success(new PostDynamoDBRow(
            item['h_key'] as string,
            item['s_key'] as string,
            item['name']  as string,
            item["message"] as string,
            item["image_url"] as Optional<string>,
            item["posted_at"] as number,
        ));
    }else if(type === TYPE_REPLY){
        return new Success(new ReplyDynamoDBRow(
            item['h_key'] as string,
            item['s_key'] as string,
            item['name']  as string,
            item["message"] as string,
            item["posted_at"] as number,
        ));
    }else{
        return new Failure(undefined);
    }
}

export class PostRepositoryDynamoDBImpl implements PostRepository{
    constructor(private tableName_: string){}
    
    async fetchAll(): Promise<Array<Post>>{
        const client = new DocumentClient();
        const result = await client.scan({TableName: this.tableName_}).promise();
        
        if(result.Items){
            const rows: Array<PostDataSetDynamoDBRow> = result.Items
                .map(item => parseDynamoItem(item))
                .filter((result): result is Success<PostDataSetDynamoDBRow, unknown> => result.isSuccess())
                .map(result => result.value);
                
            const postRows = rows.filter((row): row is PostDynamoDBRow => row.isPost());
            const replyRows = rows.filter((row): row is ReplyDynamoDBRow => row.isReply());
            
            return postRows.map(postRow => {
                const replies = replyRows.filter(row => row.h_key === postRow.h_key).map(row => row.toReply());
                return postRow.toPost(replies);
            });
            
        }else{
            return [];
        }
    }
    
    async findById(postId: string): Promise<Optional<Post>>{
        const client = new DocumentClient();
        const result = await client.query({
            TableName: this.tableName_,
            KeyConditionExpression: "h_key = :hkey",
            ExpressionAttributeValues: {
                ":hkey": postId
            }
        }).promise();
        
        if(result.Items){
            const rows: Array<PostDataSetDynamoDBRow> = result.Items
                .map(item => parseDynamoItem(item))
                .filter((result): result is Success<PostDataSetDynamoDBRow, unknown> => result.isSuccess())
                .map(result => result.value);
            
            const postRow = rows.find((row): row is PostDynamoDBRow => row.isPost());
            if(postRow){
                const replies = rows.filter((row): row is ReplyDynamoDBRow => row.isReply()).map(row => row.toReply());
                return postRow.toPost(replies);
            }else{
                return null;
            }
        }else{
            return null;
        }
    }
    
    async save(post: Post): Promise<void> {
        const rows: Array<PostDataSetDynamoDBRow>= [PostDynamoDBRow.fromPost(post), ...post.replies.map(reply => ReplyDynamoDBRow.fromReply(post.id, reply)) ];
        const client = new DocumentClient();
        
        await client.batchWrite({
            RequestItems: {
                [this.tableName_]: [
                    // {
                    //     DeleteRequest: {
                    //         Key: {
                    //             'h_key': post.id
                    //         }
                    //     }
                    // },
                    ...rows.map(row => ({
                        PutRequest: {
                            Item: row
                        }
                    }))
                ]
            }
        }).promise();
    }
    
    async removeById(postId: string): Promise<void>{
        const client = new DocumentClient();
        
        await client.delete({
            TableName: this.tableName_,
            Key: {"h_key": postId}
        }).promise();
    }
}