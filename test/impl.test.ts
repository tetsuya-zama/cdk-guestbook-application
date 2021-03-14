import {Post, Reply, Success, Failure} from '../lib/guestbook/domain';
import {PostDynamoDBRow, ReplyDynamoDBRow, parseDynamoItem, PostDataSetDynamoDBRow} from '../lib/guestbook/impl';

import moment from 'moment';
import {v4} from 'uuid';

describe('PostDynamoDBRow', () => {
    test('It will be created from Post', () => {
        const post = Post.createNew('Taro', 'It is beautiful morning', 'https://example.com/sunshine.png');
        const postRow = PostDynamoDBRow.fromPost(post);
        
        expect(postRow.h_key).toBe(post.id);
        expect(postRow.s_key).toBe(post.id);
        expect(postRow.name).toBe(post.name);
        expect(postRow.message).toBe(post.message);
        expect(postRow.image_url).toBe(post.imageUrl);
        expect(postRow.posted_at).toBe(post.postedAt.valueOf());
    })
    
    test('toPost returns Post instance created from the row and replies', () => {
        const postId = v4();
        const now = moment();
        
        const postRow = new PostDynamoDBRow(
            postId,
            postId,
            'Taro',
            'It is beautiful morning',
            'https://example.com/sunshine.png',
            now.valueOf()
        );
        
        const replies = [Reply.createNew('Hanako', 'Yeah!')];
        const post = postRow.toPost(replies);
        
        expect(post.id).toBe(postRow.h_key);
        expect(post.name).toBe(postRow.name);
        expect(post.message).toBe(postRow.message);
        expect(post.imageUrl).toBe(postRow.image_url);
        expect(post.postedAt).toStrictEqual(moment(postRow.posted_at));
        
        expect(post.replies.length).toBe(1);
        expect(post.replies[0].name).toBe('Hanako');
        expect(post.replies[0].message).toBe('Yeah!');
    })
})

describe("ReplyDynamoDBRow",() => {
    test("It will be created by Reply instance and post Id", () => {
        const postId = v4();
        const reply = Reply.createNew('Hanako', 'Yeah!');
        
        const replyRow = ReplyDynamoDBRow.fromReply(postId, reply);
        
        expect(replyRow.h_key).toBe(postId);
        expect(replyRow.s_key).toBe(reply.id);
        expect(replyRow.name).toBe(reply.name);
        expect(replyRow.message).toBe(replyRow.message);
        expect(replyRow.posted_at).toBe(reply.postedAt.valueOf());
    })
    
    test("toReply returns Reply created by the row", () => {
        const postId = v4();
        const replyId = v4();
        const now = moment();
        
        const replyRow = new ReplyDynamoDBRow(
            postId,
            replyId,
            'Hanako',
            'Yeah!',
            now.valueOf()
        );
        
        const reply = replyRow.toReply();
        
        expect(reply.id).toBe(replyRow.s_key);
        expect(reply.name).toBe(replyRow.name);
        expect(reply.message).toBe(replyRow.message);
        expect(reply.postedAt.valueOf()).toBe(now.valueOf());
    });
});

describe("parseDynamoItem", () => {
    test("It parses plane object(results of DynamoDB.DocumentClient) to wrapper objects", () => {
        const postId = v4();
        
        const dummyData: Array<{[key:string]:any}> = [
            {
                'h_key': postId,
                's_key': postId,
                'name': 'Taro',
                'message': 'It is beautiful morning',
                'image_url': 'https://example.com/sunshine.png',
                'posted_ad': moment().valueOf(),
                'type_': 'Post'
            },
            {
                'h_key': postId,
                's_key': v4(),
                'name': 'Hanako',
                'message': 'Yeah!',
                'posted_ad': moment().valueOf(),
                'type_': 'Reply'
            },
            {
                'h_key': postId,
                's_key': v4(),
                'name': 'Jiro',
                'message': 'You are right!',
                'posted_ad': moment().valueOf(),
                'type_': 'Reply'
            },
            {
                'h_key': postId,
                's_key': v4(),
                'name': 'Saburo',
                'message': 'I see',
                'posted_ad': moment().valueOf(),
                'type_': 'some_invalid_type' // Invalid Type!!
            }
        ];
        
        const results = dummyData.map(d => parseDynamoItem(d));
        
        const successResults = results.filter((r): r is Success<PostDataSetDynamoDBRow, unknown> => r.isSuccess());
        const failureResults = results.filter((r): r is Failure<PostDataSetDynamoDBRow, unknown> => r.isFailure());
        
        expect(successResults.length).toBe(3);
        expect(failureResults.length).toBe(1);
        
        const postRows = successResults.map(r => r.value).filter((r): r is PostDynamoDBRow => r.isPost());
        const replyRows = successResults.map(r => r.value).filter((r): r is ReplyDynamoDBRow => r.isReply());
        
        expect(postRows.length).toBe(1);
        expect(replyRows.length).toBe(2);
    })
})