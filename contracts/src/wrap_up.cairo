#[starknet::interface]
pub trait IWrapUp<TContractState> {
    fn submitArticle(ref self: TContractState, ipfsHash: ByteArray);
    fn submitResearchReport(ref self: TContractState, ipfsHash: ByteArray);
    fn upvoteArticle(ref self: TContractState, articleId: u256);
    fn postComment(ref self: TContractState, articleId: u256, ipfsHash: ByteArray);
    fn upvoteComment(ref self: TContractState, commentId: u256);
    fn setDisplayName(ref self: TContractState, newName: ByteArray);
    fn getUserPoints(self: @TContractState, user: starknet::ContractAddress) -> u256;
    fn getArticle(self: @TContractState, articleId: u256) -> WrapUp::Article;
    fn articleCount(self: @TContractState) -> u256;
    fn commentCount(self: @TContractState) -> u256;
}

#[starknet::contract]
pub mod WrapUp {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};

    #[derive(Drop, Serde, starknet::Store, Clone)]
    pub struct Article {
        pub ipfsHash: ByteArray,
        pub curator: ContractAddress,
        pub upvoteCount: u256,
        pub timestamp: u64,
        pub exists: bool,
        pub isResearch: bool,
    }

    #[derive(Drop, Serde, starknet::Store, Clone)]
    pub struct Comment {
        pub ipfsHash: ByteArray,
        pub articleId: u256,
        pub commenter: ContractAddress,
        pub upvoteCount: u256,
        pub timestamp: u64,
        pub exists: bool,
    }

    #[storage]
    struct Storage {
        articles: Map<u256, Article>,
        articleCount: u256,
        comments: Map<u256, Comment>,
        commentCount: u256,
        userPoints: Map<ContractAddress, u256>,
        hasUpvotedArticle: Map<(ContractAddress, u256), bool>,
        hasUpvotedComment: Map<(ContractAddress, u256), bool>,
        displayNames: Map<ContractAddress, ByteArray>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ArticleSubmitted: ArticleSubmitted,
        CommentPosted: CommentPosted,
        Upvoted: Upvoted,
        PointsAwarded: PointsAwarded,
        DisplayNameSet: DisplayNameSet,
    }

    #[derive(Drop, starknet::Event)]
    struct ArticleSubmitted {
        #[key] articleId: u256,
        ipfsHash: ByteArray,
        #[key] curator: ContractAddress,
        isResearch: bool,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct CommentPosted {
        #[key] articleId: u256,
        #[key] commentId: u256,
        ipfsHash: ByteArray,
        commenter: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Upvoted {
        #[key] id: u256,
        isArticle: bool,
        voter: ContractAddress,
        receiver: ContractAddress,
        newUpvoteCount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PointsAwarded {
        #[key] user: ContractAddress,
        pointsEarned: u256,
        totalPoints: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct DisplayNameSet {
        #[key] user: ContractAddress,
        displayName: ByteArray,
    }

    #[abi(embed_v0)]
    impl WrapUpImpl of super::IWrapUp<ContractState> {
        fn submitArticle(ref self: ContractState, ipfsHash: ByteArray) {
            self._submit(ipfsHash, false);
        }

        fn submitResearchReport(ref self: ContractState, ipfsHash: ByteArray) {
            self._submit(ipfsHash, true);
            let caller = get_caller_address();
            let current_points = self.userPoints.entry(caller).read();
            let new_points = current_points + 1;
            self.userPoints.entry(caller).write(new_points);
            self.emit(PointsAwarded { user: caller, pointsEarned: 1, totalPoints: new_points });
        }

        fn upvoteArticle(ref self: ContractState, articleId: u256) {
            let mut article = self.articles.entry(articleId).read();
            assert(article.exists, 'Article does not exist');
            
            let caller = get_caller_address();
            assert(!self.hasUpvotedArticle.entry((caller, articleId)).read(), 'Already upvoted');
            assert(article.curator != caller, 'Cannot upvote own work');

            self.hasUpvotedArticle.entry((caller, articleId)).write(true);
            article.upvoteCount += 1;
            
            let curator = article.curator;
            let is_research = article.isResearch;
            let new_upvote_count = article.upvoteCount;

            self.articles.entry(articleId).write(article);

            let points_to_award = if is_research { 2 } else { 1 };
            let current_curator_points = self.userPoints.entry(curator).read();
            let new_points = current_curator_points + points_to_award;
            self.userPoints.entry(curator).write(new_points);

            self.emit(Upvoted { 
                id: articleId, 
                isArticle: true, 
                voter: caller, 
                receiver: curator, 
                newUpvoteCount: new_upvote_count 
            });
            self.emit(PointsAwarded { user: curator, pointsEarned: points_to_award, totalPoints: new_points });
        }

        fn postComment(ref self: ContractState, articleId: u256, ipfsHash: ByteArray) {
            assert(self.articles.entry(articleId).read().exists, 'Article does not exist');
            assert(ipfsHash.len() > 0, 'Empty IPFS hash');

            let count = self.commentCount.read() + 1;
            let commenter = get_caller_address();
            let timestamp = get_block_timestamp();

            let comment = Comment {
                ipfsHash: ipfsHash.clone(),
                articleId,
                commenter,
                upvoteCount: 0,
                timestamp,
                exists: true
            };

            self.comments.entry(count).write(comment);
            self.commentCount.write(count);

            self.emit(CommentPosted { articleId, commentId: count, ipfsHash, commenter, timestamp });
        }

        fn upvoteComment(ref self: ContractState, commentId: u256) {
            let mut comment = self.comments.entry(commentId).read();
            assert(comment.exists, 'Comment does not exist');

            let caller = get_caller_address();
            assert(!self.hasUpvotedComment.entry((caller, commentId)).read(), 'Already upvoted');
            assert(comment.commenter != caller, 'Cannot upvote own comment');

            self.hasUpvotedComment.entry((caller, commentId)).write(true);
            comment.upvoteCount += 1;

            let commenter = comment.commenter;
            let new_upvote_count = comment.upvoteCount;

            self.comments.entry(commentId).write(comment);

            let current_points = self.userPoints.entry(commenter).read();
            let new_points = current_points + 1;
            self.userPoints.entry(commenter).write(new_points);

            self.emit(Upvoted { 
                id: commentId, 
                isArticle: false, 
                voter: caller, 
                receiver: commenter, 
                newUpvoteCount: new_upvote_count 
            });
            self.emit(PointsAwarded { user: commenter, pointsEarned: 1, totalPoints: new_points });
        }

        fn setDisplayName(ref self: ContractState, newName: ByteArray) {
            assert(newName.len() > 0 && newName.len() <= 32, 'Invalid name length');
            let caller = get_caller_address();
            self.displayNames.entry(caller).write(newName.clone());
            self.emit(DisplayNameSet { user: caller, displayName: newName });
        }

        fn getUserPoints(self: @ContractState, user: ContractAddress) -> u256 {
            self.userPoints.entry(user).read()
        }

        fn getArticle(self: @ContractState, articleId: u256) -> Article {
            let article = self.articles.entry(articleId).read();
            assert(article.exists, 'Article does not exist');
            article
        }

        fn articleCount(self: @ContractState) -> u256 {
            self.articleCount.read()
        }

        fn commentCount(self: @ContractState) -> u256 {
            self.commentCount.read()
        }
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn _submit(ref self: ContractState, ipfsHash: ByteArray, isResearch: bool) {
            assert(ipfsHash.len() > 0, 'Empty IPFS hash');
            let count = self.articleCount.read() + 1;
            let curator = get_caller_address();
            let timestamp = get_block_timestamp();

            let article = Article {
                ipfsHash: ipfsHash.clone(),
                curator,
                upvoteCount: 0,
                timestamp,
                exists: true,
                isResearch
            };

            self.articles.entry(count).write(article);
            self.articleCount.write(count);

            self.emit(ArticleSubmitted { articleId: count, ipfsHash, curator, isResearch, timestamp });
        }
    }
}