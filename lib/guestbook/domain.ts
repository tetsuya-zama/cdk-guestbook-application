import moment from 'moment';
import {v4 as uuidv4} from 'uuid';

export type Optional<T> = T | null | undefined;

export class Post{
    private _imageUrl: Optional<string>
    
    get imageUrl(){
        return this._imageUrl;
    }
    
    constructor(
        readonly id: string,
        readonly name: string,
        readonly message: string,
        imageUrl: Optional<string>,
        readonly postedAt: moment.Moment,
        readonly replies: Array<Reply>
    ){
        this._imageUrl = imageUrl;
    }
    
    static createNew(name: string, message: string, imageUrl: Optional<string>): Post{
        const id = uuidv4();
        return new Post(
            id,
            name,
            message,
            imageUrl,
            moment(),
            []
        );
    }
    
    addNewReply(replierName: string, replyMessage:string): void{
        this.replies.push(Reply.createNew(replierName, replyMessage));
    }
    
    setImageUrl(imageUrl: string){
        this._imageUrl = imageUrl;
    }
    
    toJSON(){
        return {
            id:this.id,
            name:this.name,
            message: this.message,
            image_url: this.imageUrl,
            posted_at: this.postedAt,
            replies: this.replies
        }
    }
}

export class Reply{
    constructor(
        readonly id: string,
        readonly name: string,
        readonly message: string,
        readonly postedAt: moment.Moment
    ){}
    
    static createNew(name: string, message: string): Reply{
        const id = uuidv4();
        return new Reply(
            id,
            name,
            message,
            moment()
        );
    }
    
    toJSON(){
        return {
            id: this.id,
            name: this.name,
            message: this.message,
            posted_at: this.postedAt
        }
    }
}

export interface PostRepository{
    fetchAll: () => Promise<Array<Post>>
    findById: (postId: string) => Promise<Optional<Post>>
    save: (post: Post) => Promise<void>
    removeById: (postId: string) => Promise<void> 
}

//抽象型を用いたエラーハンドリング
//@see https://dev.classmethod.jp/articles/error-handling-practice-of-typescript/

export type Result<T,E> = Success<T,E> | Failure<T,E>;

export class Success<T,E>{
    constructor(readonly value: T){}
    type = "success" as const;
    isSuccess(): this is Success<T,E>{
        return true;
    }
    isFailure(): this is Failure<T,E>{
        return false
    }
    unwrap(): T {
        return this.value;
    }
}

export class Failure<T,E>{
    constructor(readonly value: E){}
    type = "failure" as const;
    isSuccess(): this is Success<T,E>{
        return false;
    }
    isFailure(): this is Failure<T,E>{
        return true;
    }
    unwrap(): T {
        if(this.value instanceof Error){
            throw this.value;
        }else if(typeof this.value == 'string'){
            throw new Error(this.value);
        }else{
            throw new Error('Failure result is unwraped');
        }
    }
}

export class PostNotFoundError extends Error{
    constructor(postId: string){
        super(`The post identyfied by ${postId} is not found`);
    }
}

export class GuestBookService{
    constructor(private repository: PostRepository){}
    
    async getPosts(): Promise<Result<Array<Post>, Error>>{
        try{
            return new Success(await this.repository.fetchAll());
        }catch(e){
            return new Failure(e);
        }
    }
    
    async findPostById(postId: string): Promise<Result<Optional<Post>, Error>>{
        try{
            return new Success(await this.repository.findById(postId));
        }catch(e){
            return new Failure(e);
        }
    }
    
    async addNewPost(name: string, message: string, imageUrl: Optional<string>): Promise<Result<Post, Error>>{
        const post = Post.createNew(name, message, imageUrl);
        try {
            await this.repository.save(post);
            return new Success(post);
        }catch(e){
            return new Failure(e);
        }
    }
    
    async addNewReplyToPost(postId: string, replierName: string, replyMessage: string): Promise<Result<unknown, Error>>{
        const findPostResult = await this.findPostById(postId);
        
        if(findPostResult.isFailure()){
            return new Failure(findPostResult.value);
        }
        
        const post = findPostResult.value;
        
        if(!post){
            return new Failure(new PostNotFoundError(postId))
        }
        try{
            post.addNewReply(replierName, replyMessage);
            await this.repository.save(post);
            return new Success<unknown, Error>(true);
        }catch(e){
            return new Failure(e);
        }
    }
    
    async removePost(postId: string): Promise<Result<unknown, Error>>{
        const findPostResult = await this.findPostById(postId);

        if(findPostResult.isFailure()){
            return new Failure(findPostResult.value);
        }
        
        const post = findPostResult.value;
        
        if(!post){
            return new Failure(new PostNotFoundError(postId))
        }
        
        try{
            await this.repository.removeById(postId);
            return new Success(true);
        }catch(e){
            return new Failure(e);
        }
    }
    
    async imageUploaded(postId: string, imageUrl: string): Promise<Result<unknown, Error>>{
        const findPostResult = await this.findPostById(postId);
        
        if(findPostResult.isFailure()){
            return new Failure(findPostResult.value);
        }
        
        const post = findPostResult.value;
        
        if(!post){
            return new Failure(new PostNotFoundError(postId));
        }
        
        post.setImageUrl(imageUrl);
        
        try{
            await this.repository.save(post);
            return new Success(true)
        }catch(e){
            return new Failure(e);
        }
    }
}