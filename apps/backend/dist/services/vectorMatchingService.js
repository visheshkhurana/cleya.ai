"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorMatchingService = exports.VectorMatchingService = void 0;
const api_1 = require("@cleya/api");
class VectorMatchingService {
    findMatches = api_1.findMatches;
    findSimilarByVector = api_1.findSimilarByVector;
    findSimilarByText = api_1.findSimilarByText;
    hybridMatch = api_1.hybridMatch;
    getProfileForMatching = api_1.getProfileForMatching;
    ensureEmbedding = api_1.ensureEmbedding;
    backfillEmbeddings = api_1.backfillEmbeddings;
    getEmbeddingStats = api_1.getEmbeddingStats;
    async generateAndStoreEmbedding(userId, profileData) {
        return (0, api_1.generateAndStoreEmbedding)(userId, profileData);
    }
}
exports.VectorMatchingService = VectorMatchingService;
exports.vectorMatchingService = new VectorMatchingService();
//# sourceMappingURL=vectorMatchingService.js.map