const BaseProvider = require('./base');

class GiteeProvider extends BaseProvider {
  constructor(config) {
    super(config);
  }
  
  getTestModel() {
    return 'Lingshu-32B';
  }
  
  async chatCompletion(request) {
    const giteeRequest = {
      ...request,
      stream: false
    };
    
    return super.chatCompletion(giteeRequest);
  }
}

module.exports = GiteeProvider;