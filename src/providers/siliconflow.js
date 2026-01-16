const BaseProvider = require('./base');

class SiliconFlowProvider extends BaseProvider {
  constructor(config) {
    super(config);
  }
  
  getTestModel() {
    return 'Qwen/Qwen3-8B';
  }
  
  async chatCompletion(request) {
    const siliconflowRequest = {
      ...request,
      stream: false
    };
    
    return super.chatCompletion(siliconflowRequest);
  }
}

module.exports = SiliconFlowProvider;