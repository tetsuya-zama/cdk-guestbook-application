import { Post, Reply, PostRepository, Optional, GuestBookService, PostNotFoundError } from '../lib/guestbook/domain';
import { validate } from 'uuid';

describe('Post', () => {
    test("createNew creates new Post", () => {
        const post = Post.createNew('Taro', 'It is nice place here!', 'https://example.com/photo.png');
        
        expect(validate(post.id)).toBe(true);
        expect(post.name).toBe('Taro');
        expect(post.message).toBe('It is nice place here!');
        expect(post.imageUrl).toBe('https://example.com/photo.png');
        expect(post.replies.length).toBe(0);
    })
    
    test("addNewReply adds to new reply to the post", () => {
        const post = Post.createNew('Taro', 'It is nice place here!', 'https://example.com/photo.png');
        post.addNewReply('Hanako', 'I am with you');
        
        expect(validate(post.id)).toBe(true);
        expect(post.name).toBe('Taro');
        expect(post.message).toBe('It is nice place here!');
        expect(post.imageUrl).toBe('https://example.com/photo.png');
        expect(post.replies.length).toBe(1);
        
        expect(post.replies[0].name).toBe('Hanako');
        expect(post.replies[0].message).toBe('I am with you');
    })
    
    test("toJSON returns python style named object", () => {
        const post = Post.createNew('Taro', 'It is nice place here!', 'https://example.com/photo.png');
        post.addNewReply('Hanako', 'I am with you');
        
        const result = post.toJSON();
        
        expect(result.id).toBe(post.id);
        expect(result.name).toBe(post.name);
        expect(result.image_url).toBe(post.imageUrl);
        expect(result.posted_at).toBe(post.postedAt);
        expect(result.replies.length).toBe(1);
    })
})

describe('Reply', () => {
    test("createNew creates new Reply", () => {
        const reply =Reply.createNew('Hanako', 'I am with you');
        
        expect(validate(reply.id)).toBe(true);
        expect(reply.name).toBe('Hanako');
        expect(reply.message).toBe('I am with you');
    })
    
    test("toJSON returns python style named object", () => {
        const reply =Reply.createNew('Hanako', 'I am with you');
        const result = reply.toJSON();
        
        expect(result.id).toBe(reply.id);
        expect(result.name).toBe(reply.name);
        expect(result.message).toBe(reply.message);
        expect(result.posted_at).toBe(reply.postedAt);
    });
})

class MockPostRepository implements PostRepository{
    constructor(
        private list_ :Array<Post> = []
    ){}
    
    async fetchAll():Promise<Array<Post>>{
        return [...this.list_];
    }
    async findById(postId: string):Promise<Optional<Post>>{
        return this.list_.find(p => p.id === postId);
    }
    async save(post: Post):Promise<void>{
        this.list_ = [...this.list_, post];
    }
    async removeById(postId: string):Promise<void>{
        this.list_ = this.list_.filter(p => p.id != postId);
    } 
}

describe("GuestBookService", () => {
  test("getPost returns result of retreiving all posts", async ()=> {
        const service = new GuestBookService(new MockPostRepository([
          Post.createNew('Taro', 'Hi, everyone', null),
          Post.createNew('Jiro', 'It is beautiful day today!', 'https://example.com/pic_of_sky.jpg')
        ]));
        
        const result = await service.getPosts();
        
        expect(result.isSuccess()).toBe(true);

        const posts = result.unwrap();
        expect(posts.length).toBe(2);
        expect(posts[0].name).toBe('Taro');
        expect(posts[0].message).toBe('Hi, everyone');
        expect(posts[1].name).toBe('Jiro');
        expect(posts[1].message).toBe('It is beautiful day today!');
        expect(posts[1].imageUrl).toBe('https://example.com/pic_of_sky.jpg');

  })
   
  test("findPostsById returns result of retreiving a post by id", async () => {
        const post = Post.createNew('Taro', 'It is nice place here!', 'https://example.com/photo.png');
        post.addNewReply('Hanako', 'I am with you');
        
        const service = new GuestBookService(new MockPostRepository([post]));
        
        const resultFound = await service.findPostById(post.id);
        
        expect(resultFound.isSuccess()).toBe(true);
        const foundPost = resultFound.unwrap();
        
        expect(!!foundPost).toBe(true);
        
        if(!!foundPost){
            expect(foundPost.id).toBe(post.id);
            expect(foundPost.name).toBe(post.name);
            expect(foundPost.message).toBe(post.message);
            expect(foundPost.imageUrl).toBe(post.imageUrl);
            expect(foundPost.replies.length).toBe(1);
            
            expect(foundPost.replies[0].name).toBe(post.replies[0].name);
            expect(foundPost.replies[0].message).toBe(post.replies[0].message);
        }
        
        const resultNotFound = await service.findPostById('some-invalid-id');
        
        expect(resultNotFound.isSuccess()).toBe(true); // Not failure. Just not found.
        
        const maybeNull = resultNotFound.unwrap();
        expect(!!maybeNull).not.toBe(true);
  });
   
  test("addNewPost add and save new Post", async() => {
        const service = new GuestBookService(new MockPostRepository([
          Post.createNew('Taro', 'Hi, everyone', null),
          Post.createNew('Jiro', 'It is beautiful day today!', 'https://example.com/pic_of_sky.jpg')
        ]));
        
        const result = await service.addNewPost('Saburo', 'How do you do?', null);
        
        expect(result.isSuccess()).toBe(true);
        
        if(result.isSuccess()){
            const newPost = result.value;
            
            expect(validate(newPost.id)).toBe(true);
            expect(newPost.name).toBe('Saburo');
            expect(newPost.message).toBe('How do you do?');
        }
        
        const posts = (await service.getPosts()).unwrap();
        expect(posts.length).toBe(3);
  })
   
  test("addNewReplyToPost adds new Reply to existing Post", async () => {
        const post = Post.createNew('Taro', 'It is nice place here!', 'https://example.com/photo.png');
        post.addNewReply('Hanako', 'I am with you');
        
        const service = new GuestBookService(new MockPostRepository([post]));
        
        const maybeSuccess = await service.addNewReplyToPost(post.id, 'Hanako', 'You are right!');
        expect(maybeSuccess.isSuccess()).toBe(true);
        
        const updatedPost = (await service.findPostById(post.id)).unwrap();
        
        expect(updatedPost?.replies.length).toBe(2);
        expect(updatedPost?.replies[1].name).toBe('Hanako');
        expect(updatedPost?.replies[1].message).toBe('You are right!');
        
        
        const maybeFailure = await service.addNewReplyToPost('some-invalid-id', 'Hanako', 'You are right!');
        
        expect(maybeFailure.isFailure()).toBe(true);
        if(maybeFailure.isFailure()) expect(maybeFailure instanceof PostNotFoundError);
  });
   
  test("removePost deletes existing post identified by postId", async () => {
        const post = Post.createNew('Taro', 'It is nice place here!', 'https://example.com/photo.png');
        post.addNewReply('Hanako', 'I am with you');
        
        const service = new GuestBookService(new MockPostRepository([post]));
        
        const maybeSuccess = await service.removePost(post.id);
        expect(maybeSuccess.isSuccess()).toBe(true);
        
        const posts = (await service.getPosts()).unwrap();
        expect(posts.length).toBe(0);
        
        const maybeFailure = await service.removePost(post.id); // maybe Faiure because the post is already removed
        expect(maybeFailure.isFailure()).toBe(true);
        
        if(maybeFailure.isFailure()) expect(maybeFailure.value instanceof PostNotFoundError);
  })
  
  test("imageUploaded updates imageUrl of existing post", async () => {
        const post = Post.createNew('Taro', 'It is nice place here!', null);
        const imageUrl = 'https://example.com/photo.png'
        
        const service = new GuestBookService(new MockPostRepository([post]));
        
        const maybeSuccess = await service.imageUploaded(post.id, imageUrl);
        expect(maybeSuccess.isSuccess()).toBe(true);
        
        const updatedPost = (await service.findPostById(post.id)).unwrap();
        expect(!!updatedPost).toBe(true);
        if(updatedPost){
            expect(updatedPost.imageUrl).toBe(imageUrl);
        }
        
  });
});