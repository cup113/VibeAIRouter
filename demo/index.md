---
layout: home

hero:
  name: "VibeAI Router"
  text: "免费 AI 模型网关"
  tagline: 无需 API 密钥或登录，即可访问来自 SiliconFlow 和 Gitee AI 的免费 AI 模型。OpenAI 兼容。
  actions:
    - theme: brand
      text: 试用演示
      link: /demo/chat
    - theme: alt
      text: API参考
      link: /reference
---

<script setup>
import { ref, onMounted, computed } from 'vue'

const models = ref([])
const todayStats = ref(null)
const loading = ref(true)
const error = ref(null)
const baseUrl = ref('')

const availableModelsCount = computed(() => models.value.length)
const topModels = computed(() => models.value)

const statsData = computed(() => ({
  models: {
    title: '可用模型',
    icon: '🤖',
    color: '#1e40af',
    bgColor: '#e0e7ff',
    value: availableModelsCount.value,
    description: '可用的 AI 模型总数',
    subText: '已就绪',
    subColor: '#10b981'
  },
  requests: {
    title: '今日请求',
    icon: '📊',
    color: '#0ea5e9',
    bgColor: '#f0f9ff',
    value: todayStats.value?.requests?.total || 0,
    description: '今日发起的请求总数',
    subText: `平均吞吐量 ${todayStats.value?.requests?.perHour || 0} rph`,
    subColor: '#0ea5e9'
  },
  tokens: {
    title: '今日 Token',
    icon: '🔢',
    color: '#10b981',
    bgColor: '#f0fdf4',
    value: todayStats.value?.tokens?.formatted,
    description: '今日消耗的总Token数',
    subText: '访客使用量',
    subColor: '#10b981'
  },
  guests: {
    title: '今日用户数',
    icon: '👥',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    value: todayStats.value?.guests?.unique || 0,
    description: '今日独立访客用户数',
    subText: `平均每次用户发起 ${(todayStats.value?.guests?.requests || 0) / (todayStats.value?.guests?.unique || 1)} 次请求`,
    subColor: '#f59e0b'
  }
}))

async function fetchData() {
  try {
    const [modelsRes, statsRes] = await Promise.all([
      fetch('/api/v1/models'),
      fetch('/api/v1/status/today')
    ])

    if (!modelsRes.ok || !statsRes.ok) {
      throw new Error('从API获取数据失败')
    }

    const modelsData = await modelsRes.json()
    const statsData = await statsRes.json()

    models.value = modelsData.data || []
    todayStats.value = statsData.statistics || {
      tokens: { total: 0, formatted: '0' },
      requests: { total: 0, perHour: 0 },
      guests: { unique: 0, requests: 0, tokens: 0 }
    }
  } catch (err) {
    error.value = err.message
    console.error('获取统计信息时出错:', err)
  } finally {
    loading.value = false
  }
}

function copyBaseUrl() {
  if (!baseUrl.value) return
  
  navigator.clipboard.writeText(baseUrl.value)
    .then(() => {
    })
    .catch(err => {
      console.error('复制失败:', err)
      alert('复制失败，请手动复制')
    })
}

onMounted(() => {
  baseUrl.value = window.location.origin + '/api/v1'
  fetchData()
})
</script>

<div class="base-url-section">
  <div class="base-url-header">
    <h2>📡 API Base URL</h2>
  </div>
  <div class="base-url-content">
    <div class="base-url-display">
      <code>{{ baseUrl || '正在加载...' }}</code>
      <button 
        class="copy-button" 
        @click="copyBaseUrl"
        :disabled="!baseUrl"
        :title="baseUrl ? '点击复制' : 'URL未就绪'"
      >
          复制
      </button>
    </div>
    <p class="base-url-description">
      使用此 Base URL 访问所有 API 端点。完全兼容 OpenAI API 格式。
    </p>
  </div>
</div>

<div class="stats-section">
  <div class="section-header">
    <h2>📈 统计数据</h2>
  </div>

  <div v-if="loading" class="loading-state">
    <div class="spinner"></div>
    <p>正在加载统计信息...</p>
  </div>

  <div v-else-if="error" class="error-state">
    <h3>⚠️ 加载数据时出错</h3>
    <p>{{ error }}</p>
    <button @click="fetchData" class="retry-button">
      重试
    </button>
  </div>

  <div v-else class="stats-content">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" :style="{ backgroundColor: statsData.models.bgColor }">
            <span>{{ statsData.models.icon }}</span>
          </div>
          <h3 class="stat-title">{{ statsData.models.title }}</h3>
        </div>
        <p class="stat-value" :style="{ color: statsData.models.color }">{{ statsData.models.value }}</p>
        <p class="stat-description">{{ statsData.models.description }}</p>
        <div class="stat-footer">
          <p class="stat-subtext">
            <span class="stat-dot" :style="{ color: statsData.models.subColor }">●</span>
            {{ statsData.models.subText }}
          </p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" :style="{ backgroundColor: statsData.requests.bgColor }">
            <span>{{ statsData.requests.icon }}</span>
          </div>
          <h3 class="stat-title">{{ statsData.requests.title }}</h3>
        </div>
        <p class="stat-value" :style="{ color: statsData.requests.color }">{{ statsData.requests.value }}</p>
        <p class="stat-description">{{ statsData.requests.description }}</p>
        <div class="stat-footer">
          <p class="stat-subtext">
            <span class="stat-dot" :style="{ color: statsData.requests.subColor }">●</span>
            {{ statsData.requests.subText }}
          </p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" :style="{ backgroundColor: statsData.tokens.bgColor }">
            <span>{{ statsData.tokens.icon }}</span>
          </div>
          <h3 class="stat-title">{{ statsData.tokens.title }}</h3>
        </div>
        <p class="stat-value" :style="{ color: statsData.tokens.color }">{{ statsData.tokens.value }}</p>
        <p class="stat-description">{{ statsData.tokens.description }}</p>
        <div class="stat-footer">
          <p class="stat-subtext">
            <span class="stat-dot" :style="{ color: statsData.tokens.subColor }">●</span>
            {{ statsData.tokens.subText }}
          </p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" :style="{ backgroundColor: statsData.guests.bgColor }">
            <span>{{ statsData.guests.icon }}</span>
          </div>
          <h3 class="stat-title">{{ statsData.guests.title }}</h3>
        </div>
        <p class="stat-value" :style="{ color: statsData.guests.color }">{{ statsData.guests.value }}</p>
        <p class="stat-description">{{ statsData.guests.description }}</p>
        <div class="stat-footer">
          <p class="stat-subtext">
            <span class="stat-dot" :style="{ color: statsData.guests.subColor }">●</span>
            {{ statsData.guests.subText }}
          </p>
        </div>
      </div>
    </div>
    <div v-if="topModels.length > 0" class="models-section">
      <h3 class="models-title">🎯 可用AI模型</h3>
      <div class="models-tags">
        <span 
          v-for="model in topModels" 
          :key="model.id" 
          class="model-tag"
          :title="model.name"
        >
          {{ model.name }}
        </span>
      </div>
    </div>
    <div class="update-time">
      <p>数据加载时间 {{ new Date().toLocaleTimeString() }}</p>
    </div>
  </div>
</div>

<div class="features-section">
  <h2 class="features-title">为什么选择 VibeAI Router？</h2>
  <div class="features-grid">
    <div class="feature-card">
      <h3>🚀 无需 API 密钥</h3>
      <p><strong>无需登录</strong>即可访问来自 SiliconFlow 和 Gitee AI 的免费 AI 模型</p>
    </div>
    <div class="feature-card">
      <h3>🔄 OpenAI 兼容</h3>
      <p>使用与 OpenAI 相同的 API 格式，可直接替换现有应用</p>
    </div>
    <div class="feature-card">
      <h3>⚡ 流式支持</h3>
      <p>实时流式响应，支持首 Token 延迟追踪</p>
    </div>
    <div class="feature-card">
      <h3>📊 使用分析</h3>
      <p>追踪 Token 使用量、请求统计和性能指标</p>
    </div>
    <div class="feature-card">
      <h3>🔒 安全可靠</h3>
      <p>内置速率限制、CORS 保护和优雅关机</p>
    </div>
    <div class="feature-card">
      <h3>🐳 Docker就绪</h3>
      <p>完全容器化，支持 Docker 和 Docker Compose</p>
    </div>
  </div>
</div>

<style scoped>
.stats-section {
  margin: 1rem 0;
  padding: 0.5rem 2rem;
  background: linear-gradient(135deg, #f0f4ff 0%, #dbeafe 100%);
  border-radius: 16px;
  border: 1px solid #e0e7ff;
}

.section-header {
  text-align: center;
  margin-bottom: 2rem;
}

.section-header h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #1e40af;
}

.loading-state {
  text-align: center;
  padding: 3rem;
}

.loading-state p {
  font-size: 1.2rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid #e0e7ff;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

.error-state {
  text-align: center;
  padding: 2rem;
  background: #fee;
  border-radius: 8px;
  border: 1px solid #fca5a5;
}

.error-state h3 {
  color: #dc2626;
  margin-top: 0;
}

.error-state p {
  color: #7f1d1d;
}

.retry-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background: #4338ca;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
  animation: fadeIn 0.5s ease-out;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid #e0e7ff;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.stat-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.stat-icon span {
  font-size: 1.2rem;
}

.stat-title {
  margin: 0;
  color: #1e293b;
  font-size: 1.1rem;
  font-weight: 600;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0.5rem 0;
}

.stat-description {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0;
}

.stat-footer {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
}

.stat-subtext {
  color: #475569;
  font-size: 0.85rem;
  margin: 0;
}

.stat-dot {
  display: inline-block;
  margin-right: 6px;
}

.models-section {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin: 2rem 0;
  border: 1px solid #e0e7ff;
}

.models-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1rem;
}

.models-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.model-tag {
  background: #f0f4ff;
  color: #4f46e5;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  border: 1px solid #c7d2fe;
  cursor: default;
  transition: all 0.2s;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-tag:hover {
  background: #e0e7ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.1);
}

.view-all-link {
  display: inline-block;
  color: #4f46e5;
  font-weight: 600;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border: 2px solid #4f46e5;
  border-radius: 8px;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.view-all-link:hover {
  background: #4f46e5;
  color: white;
}

.update-time {
  text-align: center;
  margin-top: 2rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.features-section {
  margin-top: 4rem;
}

.features-title {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 3rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin-top: 0;
  margin-bottom: 1rem;
}

.feature-card p {
  color: #64748b;
  line-height: 1.6;
  margin: 0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Base URL 样式 */
.base-url-section {
  margin: 2rem 0;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border-radius: 16px;
  border: 2px solid #0ea5e9;
  animation: fadeIn 0.5s ease-out;
}

.base-url-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.base-url-header h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #0369a1;
  margin: 0;
}

.base-url-content {
  text-align: center;
}

.base-url-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin: 1.5rem 0;
}

.base-url-display code {
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-size: 1.5rem;
  font-weight: 600;
  color: #0c4a6e;
  border: 2px solid #7dd3fc;
  font-family: 'Monaco', 'Consolas', monospace;
  word-break: break-all;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1);
}

.copy-button {
  background: #0ea5e9;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-button:hover:not(:disabled) {
  background: #0284c7;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
}

.copy-button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  opacity: 0.7;
}

.base-url-description {
  font-size: 1rem;
  color: #475569;
  line-height: 1.6;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

@media (max-width: 768px) {
  .base-url-section {
    padding: 1.5rem 1rem;
    margin: 1.5rem 0;
  }
  
  .base-url-header h2 {
    font-size: 1.5rem;
  }
  
  .base-url-display {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .base-url-display code {
    font-size: 1.2rem;
    padding: 0.75rem 1rem;
    width: 100%;
  }
  
  .copy-button {
    width: 100%;
    padding: 0.5rem;
  }
}

@media (max-width: 768px) {
  .stats-section {
    padding: 2rem 1rem;
    margin: 2rem 0;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .models-tags {
    gap: 0.5rem;
  }

  .model-tag {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
