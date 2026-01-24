# 🤖 VibeAI 聊天演示

体验与AI模型的实时对话。选择可用模型，开始聊天吧！

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'

// 状态管理
const models = ref([])
const selectedModel = ref('')
const messages = ref([])
const inputText = ref('你好！请介绍一下你自己。')
const loading = ref(false)
const error = ref(null)
const streamEnabled = ref(true)
const isLoadingModels = ref(false)

// 计算属性
const availableModels = computed(() => models.value)
const hasMessages = computed(() => messages.value.length > 0)
const lastMessage = computed(() => messages.value[messages.value.length - 1])
const isSendDisabled = computed(() => 
  !selectedModel.value || 
  !inputText.value.trim() || 
  loading.value
)

// 从本地存储加载历史消息
function loadMessages() {
  try {
    const saved = localStorage.getItem('vibeai_chat_messages')
    if (saved) {
      messages.value = JSON.parse(saved)
    }
  } catch (e) {
    console.warn('Failed to load chat history:', e)
  }
}

// 保存消息到本地存储
function saveMessages() {
  try {
    localStorage.setItem('vibeai_chat_messages', JSON.stringify(messages.value))
  } catch (e) {
    console.warn('Failed to save chat history:', e)
  }
}

// 获取可用模型列表
async function fetchModels() {
  isLoadingModels.value = true
  error.value = null
  
  try {
    const response = await fetch('/api/v1/models')
    if (!response.ok) {
      throw new Error(`获取模型失败: ${response.status}`)
    }
    
    const data = await response.json()
    if (data.success && data.data) {
      models.value = data.data
      
      // 如果还没有选择模型，选择第一个
      if (models.value.length > 0 && !selectedModel.value) {
        selectedModel.value = models.value[0].code
      }
    } else {
      throw new Error(data.message || '获取模型数据失败')
    }
  } catch (err) {
    error.value = err.message
    console.error('获取模型时出错:', err)
  } finally {
    isLoadingModels.value = false
  }
}

// 发送消息到AI
async function sendMessage() {
  if (isSendDisabled.value) return
  
  const userMessage = inputText.value.trim()
  if (!userMessage) return
  
  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
    model: selectedModel.value
  })
  
  // 保存到本地存储
  saveMessages()
  
  // 清空输入框
  inputText.value = ''
  loading.value = true
  error.value = null
  
  // 准备请求数据
  const requestData = {
    model: selectedModel.value,
    messages: messages.value.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    stream: streamEnabled.value,
    temperature: 0.7,
    max_tokens: 1000
  }
  
  try {
    const response = await fetch('/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API请求失败: ${response.status} - ${errorText}`)
    }
    
    // 处理流式响应
    if (streamEnabled.value) {
      await handleStreamResponse(response)
    } else {
      // 处理非流式响应
      const result = await response.json()
      
      if (result.choices && result.choices.length > 0) {
        const aiMessage = result.choices[0].message
        
        messages.value.push({
          role: aiMessage.role,
          content: aiMessage.content,
          timestamp: new Date().toISOString(),
          model: selectedModel.value,
          usage: result.usage,
          requestId: result._meta?.requestId
        })
      } else {
        throw new Error('API返回了空响应')
      }
    }
    
    // 保存到本地存储
    saveMessages()
    
  } catch (err) {
    error.value = err.message
    console.error('发送消息时出错:', err)
    
    // 添加错误消息
    messages.value.push({
      role: 'assistant',
      content: `抱歉，处理您的请求时出错了: ${err.message}`,
      timestamp: new Date().toISOString(),
      model: selectedModel.value,
      isError: true
    })
    
  } finally {
    loading.value = false
    // 滚动到底部
    await nextTick()
    scrollToBottom()
  }
}

// 处理流式响应
async function handleStreamResponse(response) {
  if (!response.body) {
    throw new Error('响应体不可用')
  }
  
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let accumulatedContent = ''
  
  // 添加占位符消息
  const assistantMessageIndex = messages.value.length
  messages.value.push({
    role: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
    model: selectedModel.value,
    isStreaming: true
  })
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        // 完成流式传输
        messages.value[assistantMessageIndex].isStreaming = false
        break
      }
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (line.trim() === '') continue
        
        if (line.startsWith('data: ')) {
          const data = line.substring(6)
          
          if (data === '[DONE]') {
            messages.value[assistantMessageIndex].isStreaming = false
            return
          }
          
          try {
            const parsed = JSON.parse(data)
            
            if (parsed.choices && parsed.choices.length > 0) {
              const delta = parsed.choices[0].delta
              
              if (delta.content) {
                accumulatedContent += delta.content
                messages.value[assistantMessageIndex].content = accumulatedContent
                
                // 触发视图更新
                await nextTick()
              }
            }
          } catch (e) {
            console.warn('解析流式数据时出错:', e)
          }
        }
      }
    }
  } catch (err) {
    console.error('流式处理出错:', err)
    messages.value[assistantMessageIndex].isStreaming = false
    messages.value[assistantMessageIndex].content = accumulatedContent || '流式响应中断'
    throw err
  }
}

// 清空聊天记录
function clearMessages() {
  messages.value = []
  localStorage.removeItem('vibeai_chat_messages')
  error.value = null
}

// 复制消息内容
function copyMessage(content) {
  navigator.clipboard.writeText(content).then(() => {
    // 可以添加复制成功提示
    console.log('内容已复制')
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

// 滚动到底部
function scrollToBottom() {
  const container = document.querySelector('.messages-container')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

// 初始化
onMounted(() => {
  fetchModels()
  loadMessages()
  
  // 如果已有消息，选择最后使用的模型
  if (hasMessages.value && messages.value.length > 0) {
    const lastMsg = messages.value.find(msg => msg.model)
    if (lastMsg) {
      selectedModel.value = lastMsg.model
    }
  }
})
</script>

<div class="chat-demo-container">
  <!-- 控制面板 -->
  <div class="control-panel">
    <div class="panel-section">
      <h3>⚙️ 模型设置</h3>
      <div class="form-group">
        <label for="model-select">选择模型:</label>
        <select 
          id="model-select" 
          v-model="selectedModel" 
          :disabled="isLoadingModels || loading"
          class="model-select"
        >
          <option value="" disabled>选择AI模型...</option>
          <option 
            v-for="model in availableModels" 
            :key="model.id" 
            :value="model.code"
          >
            {{ model.name }} ({{ model.code }})
          </option>
        </select>
        <div v-if="isLoadingModels" class="loading-small">
          加载模型中...
        </div>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="streamEnabled" 
            :disabled="loading"
          >
          启用流式响应
        </label>
        <small class="hint">实时显示AI生成内容</small>
      </div>
      <div class="form-group">
        <button 
          @click="clearMessages" 
          :disabled="!hasMessages || loading"
          class="secondary-button"
        >
          清空聊天记录
        </button>
      </div>
    </div>
  </div>
  <!-- 聊天主区域 -->
  <div class="chat-main">
    <!-- 错误提示 -->
    <div v-if="error" class="error-banner">
      <span>⚠️ {{ error }}</span>
      <button @click="error = null" class="close-button">×</button>
    </div>
    <!-- 消息区域 -->
    <div class="messages-container" ref="messagesContainer">
      <div v-if="!hasMessages" class="empty-state">
        <div class="empty-icon">💬</div>
        <h3>开始对话</h3>
        <p>选择模型并输入消息以开始与AI聊天</p>
      </div>
      <div v-else class="messages-list">
        <div 
          v-for="(message, index) in messages" 
          :key="index"
          :class="['message', `message-${message.role}`, { 'message-error': message.isError }]"
        >
          <div class="message-header">
            <span class="message-avatar">
              {{ message.role === 'user' ? '👤' : '🤖' }}
            </span>
            <span class="message-model" v-if="message.model && message.role === 'assistant'">
              {{ message.model }}
            </span>
            <span class="message-time">
              {{ new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
            </span>
            <button 
              v-if="message.content && message.role === 'assistant'"
              @click="copyMessage(message.content)"
              class="copy-button"
              title="复制内容"
            >
              📋
            </button>
          </div>
          <div class="message-content">
            <div v-if="message.isStreaming && !message.content" class="streaming-placeholder">
              <span class="streaming-dot"></span>
              <span class="streaming-dot"></span>
              <span class="streaming-dot"></span>
            </div>
            <div v-else class="message-text">
              {{ message.content }}
            </div>
          </div>
          <!-- Token使用信息 -->
          <div v-if="message.usage" class="message-usage">
            <span>Token: {{ message.usage.prompt_tokens || 0 }} / {{ message.usage.completion_tokens || 0 }} (总计: {{ message.usage.total_tokens || 0 }})</span>
          </div>
        </div>
        <!-- 加载指示器 -->
        <div v-if="loading && !streamEnabled" class="loading-indicator">
          <div class="spinner"></div>
          <span>AI正在思考中...</span>
        </div>
      </div>
    </div>
    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-container">
        <textarea
          v-model="inputText"
          @keydown.enter.exact.prevent="sendMessage"
          @keydown.enter.shift.exact.prevent="inputText += '\n'"
          :disabled="loading || !selectedModel"
          placeholder="输入您的问题... (Enter发送，Shift+Enter换行)"
          rows="3"
          class="message-input"
        ></textarea>
        <div class="input-actions">
          <div class="char-count">
            {{ inputText.length }} 字符
          </div>
          <button
            @click="sendMessage"
            :disabled="isSendDisabled"
            class="send-button"
          >
            <span v-if="loading">发送中...</span>
            <span v-else>发送消息</span>
          </button>
        </div>
      </div>
      <div class="input-hint">
        提示：您可以使用Shift+Enter换行，直接按Enter发送消息
      </div>
    </div>
  </div>
</div>

<style scoped>
.chat-demo-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin: 2rem 0;
}

@media (min-width: 1024px) {
  .chat-demo-container {
    flex-direction: row;
    gap: 2rem;
  }
}

/* 控制面板样式 */
.control-panel {
  background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #c7d2fe;
  flex-shrink: 0;
}

@media (min-width: 1024px) {
  .control-panel {
    width: 300px;
  }
}

.panel-section h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #4f46e5;
  margin-top: 0;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1.2rem;
}

.form-group label {
  display: block;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.model-select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #c7d2fe;
  border-radius: 8px;
  background: white;
  font-size: 1rem;
  color: #1f2937;
  transition: border-color 0.2s;
}

.model-select:focus {
  outline: none;
  border-color: #4f46e5;
}

.model-select:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.loading-small {
  font-size: 0.9rem;
  color: #6b7280;
  margin-top: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
}

.checkbox-label input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
  accent-color: #4f46e5;
}

.hint {
  display: block;
  color: #6b7280;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.secondary-button {
  width: 100%;
  padding: 0.75rem;
  background: white;
  color: #4f46e5;
  border: 2px solid #4f46e5;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-button:hover:not(:disabled) {
  background: #4f46e5;
  color: white;
}

.secondary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.instructions {
  list-style: none;
  padding: 0;
  margin: 0;
}

.instructions li {
  padding: 0.5rem 0;
  color: #4b5563;
  font-size: 0.95rem;
  line-height: 1.5;
  border-bottom: 1px solid #e5e7eb;
}

.instructions li:last-child {
  border-bottom: none;
}

/* 聊天主区域样式 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 600px;
}

.error-banner {
  background: #fee;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  padding: 1rem;
  color: #dc2626;
  display: flex;
  justify-content: space-between;
  align-items: center;
  animation: slideDown 0.3s ease-out;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #dc2626;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.messages-container {
  flex: 1;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 1.5rem;
  overflow-y: auto;
  max-height: 500px;
  min-height: 400px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6b7280;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  font-size: 1rem;
  color: #6b7280;
  max-width: 400px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.message {
  border-radius: 12px;
  padding: 1rem;
  animation: fadeIn 0.3s ease-out;
}

.message-user {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  align-self: flex-end;
  margin-left: 2rem;
}

.message-assistant {
  background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
  align-self: flex-start;
  margin-right: 2rem;
}

.message-error {
  background: #fee;
  border: 1px solid #fca5a5;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.message-avatar {
  font-size: 1.2rem;
}

.message-role {
  font-weight: 600;
  color: #374151;
}

.message-model {
  font-size: 0.85rem;
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.message-time {
  font-size: 0.85rem;
  color: #6b7280;
  margin-left: auto;
}

.copy-button {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  color: #6b7280;
  transition: color 0.2s;
}

.copy-button:hover {
  color: #4f46e5;
}

.message-content {
  line-height: 1.6;
  color: #1f2937;
}

.streaming-placeholder {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  height: 1.5rem;
}

.streaming-dot {
  width: 8px;
  height: 8px;
  background: #4f46e5;
  border-radius: 50%;
  animation: pulse 1.5s infinite ease-in-out;
}

.streaming-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.streaming-dot:nth-child(3) {
  animation-delay: 0.4s;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.message-usage {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  font-size: 0.85rem;
  color: #6b7280;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-top: 1rem;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #e0e7ff;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 输入区域样式 */
.input-area {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 1.5rem;
}

.input-container {
  margin-bottom: 1rem;
}

.message-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #c7d2fe;
  border-radius: 8px;
  font-size: 1rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 80px;
  max-height: 200px;
  transition: border-color 0.2s;
}

.message-input:focus {
  outline: none;
  border-color: #4f46e5;
}

.message-input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
}

.char-count {
  font-size: 0.9rem;
  color: #6b7280;
}

.send-button {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-hint {
  font-size: 0.85rem;
  color: #6b7280;
  text-align: center;
}

/* 动画 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .chat-demo-container {
    margin: 1rem 0;
  }
  
  .control-panel {
    padding: 1rem;
  }
  
  .messages-container {
    max-height: 400px;
    min-height: 300px;
    padding: 1rem;
  }
  
  .message {
    padding: 0.75rem;
  }
  
  .message-user {
    margin-left: 1rem;
  }
  
  .message-assistant {
    margin-right: 1rem;
  }
  
  .input-area {
    padding: 1rem;
  }
  
  .send-button {
    padding: 0.75rem 1rem;
  }
}
</style>
