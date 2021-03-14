interface AddPostRequest {
    name: string,
    message: string,
    image_file_name?: string
}

const API_BASE_URL = process.env["API_BASE_URL"];

describe("Guest Book API", () => {
    const addPost = (post: AddPostRequest) => cy.request('POST', `${API_BASE_URL}`, post);
    const getPosts = () => cy.request('GET', `${API_BASE_URL}`);
    
    test("add Post without image", () => {
        if(!API_BASE_URL) assert(false);
        
        const result = addPost({name: "Joe", message:"Hello, everyone!"});
        result
            .its('headers')
            .its('content-type')
            .should('include', 'application/json');
    });
    
    test("get all Posts", () => {
        if(!API_BASE_URL) assert(false);
        
        const result = getPosts();
        result
            .its('headers')
            .its('content-type')
            .should('include', 'application/json');
    })
})