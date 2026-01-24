// VibeAI Router Dashboard Application
// Main JavaScript file for the intelligent dashboard

// API Base URL
const API_BASE = window.location.origin;

// DOM Elements
const statusIndicator = document.getElementById("statusIndicator");
const modelCount = document.getElementById("modelCount");
const providerCount = document.getElementById("providerCount");
const uptime = document.getElementById("uptime");
const todayTokens = document.getElementById("todayTokens");
const responseOutput = document.getElementById("responseOutput");
const modelSelect = document.getElementById("modelSelect");
const versionEl = document.getElementById("version");
const environmentEl = document.getElementById("environment");

// State management
let appState = {
  serviceStatus: "checking",
  models: [],
  providers: [],
  stats: {
    models: 0,
    providers: 0,
    uptime: 0,
    todayTokens: 0,
    todayRequests: 0,
  },
  lastUpdate: null,
};

// Utility Functions
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
        <i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"}"></i>
        ${message}
    `;

  document.body.appendChild(notification);

  // Remove notification after animation
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function formatDate(date) {
  return new Date(date).toLocaleString();
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(ms) {
  if (ms < 1000) return ms + "ms";
  if (ms < 60000) return Math.floor(ms / 1000) + "s";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m";
  if (ms < 86400000) return Math.floor(ms / 3600000) + "h";
  return Math.floor(ms / 86400000) + "d";
}

// Tab functionality
function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all tabs and contents
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Add active class to clicked tab and corresponding content
      tab.classList.add("active");
      const tabId = tab.getAttribute("data-tab") + "Tab";
      document.getElementById(tabId).classList.add("active");

      // Load data for the tab if needed
      switch (tab.getAttribute("data-tab")) {
        case "models":
          loadModelsTable();
          break;
        case "providers":
          loadProvidersTable();
          break;
        case "analytics":
          loadAnalytics();
          break;
      }
    });
  });
}

// Service Status Functions
async function checkServiceStatus() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    if (data.status === "healthy") {
      statusIndicator.innerHTML =
        '<i class="fas fa-check-circle"></i> Service Healthy';
      statusIndicator.className = "status-badge healthy";
      appState.serviceStatus = "healthy";
    } else {
      statusIndicator.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Service Degraded';
      statusIndicator.className = "status-badge degraded";
      appState.serviceStatus = "degraded";
    }

    // Update database status if available
    if (data.database?.healthy) {
      showNotification("Database connection established", "success");
    }

    return data;
  } catch (error) {
    statusIndicator.innerHTML =
      '<i class="fas fa-times-circle"></i> Service Unavailable';
    statusIndicator.className = "status-badge unavailable";
    appState.serviceStatus = "unavailable";
    console.error("Health check failed:", error);
    showNotification("Service health check failed", "error");
    return null;
  }
}

async function loadServiceInfo() {
  try {
    // Try to get version info from root endpoint
    const response = await fetch(`${API_BASE}/`);
    const data = await response.json();

    if (data.version) {
      versionEl.textContent = data.version;
    }

    if (data.environment) {
      environmentEl.textContent = data.environment;
      environmentEl.className =
        data.environment === "production" ? "badge success" : "badge warning";
    }

    // Load additional stats
    await updateStats();

    appState.lastUpdate = new Date();
    showNotification("Service information loaded successfully", "success");
  } catch (error) {
    console.error("Failed to load service info:", error);
    showNotification("Failed to load service information", "error");
  }
}

async function updateStats() {
  try {
    // Fetch status data which includes today's statistics
    const statusResponse = await fetch(`${API_BASE}/api/v1/status`);
    const statusData = await statusResponse.json();

    // Update model and provider counts
    if (statusData.stats) {
      appState.stats.models = statusData.stats.models || 0;
      appState.stats.providers = statusData.stats.providers || 0;

      modelCount.textContent = appState.stats.models;
      providerCount.textContent = appState.stats.providers;

      // Update today's statistics
      if (statusData.stats.today) {
        appState.stats.todayTokens = statusData.stats.today.totalTokens || 0;
        appState.stats.todayRequests =
          statusData.stats.today.totalRequests || 0;

        // Format tokens for display
        todayTokens.textContent = formatTokensForDisplay(
          appState.stats.todayTokens,
        );
      }
    }

    // Update uptime from server if available
    if (statusData._meta?.uptime) {
      uptime.textContent = formatDuration(statusData._meta.uptime * 1000);
      appState.stats.uptime = statusData._meta.uptime * 1000;
    } else if (appState.lastUpdate) {
      // Fallback to local uptime calculation
      const uptimeMs = new Date() - appState.lastUpdate;
      uptime.textContent = formatDuration(uptimeMs);
      appState.stats.uptime = uptimeMs;
    }

    // Update version and environment
    if (statusData._meta?.version) {
      versionEl.textContent = statusData._meta.version;
    }

    if (statusData._meta?.environment) {
      environmentEl.textContent = statusData._meta.environment;
      environmentEl.className =
        statusData._meta.environment === "production"
          ? "badge success"
          : "badge warning";
    }
  } catch (error) {
    console.error("Failed to update stats:", error);
    // Fallback to basic data if status endpoint fails
    await updateBasicStats();
  }
}

async function updateBasicStats() {
  try {
    // Fallback: fetch models and providers separately
    const modelsResponse = await fetch(`${API_BASE}/api/v1/models`);
    const modelsData = await modelsResponse.json();

    const providersResponse = await fetch(`${API_BASE}/api/v1/providers`);
    const providersData = await providersResponse.json();

    if (modelsData.success) {
      appState.models = modelsData.data;
      appState.stats.models = modelsData.count;
      modelCount.textContent = modelsData.count;
    }

    if (providersData.success) {
      appState.providers = providersData.data;
      appState.stats.providers = providersData.count;
      providerCount.textContent = providersData.count;
    }

    // Update uptime
    if (appState.lastUpdate) {
      const uptimeMs = new Date() - appState.lastUpdate;
      uptime.textContent = formatDuration(uptimeMs);
      appState.stats.uptime = uptimeMs;
    }

    // Show placeholder for tokens
    todayTokens.textContent = "--";
  } catch (error) {
    console.error("Failed to update basic stats:", error);
  }
}

function formatTokensForDisplay(tokens) {
  if (tokens === 0) return "0";
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

// API Tester Functions
async function fetchModelsForSelect() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/models`);
    const data = await response.json();

    if (data.success && data.data) {
      modelSelect.innerHTML = '<option value="">Select a model</option>';
      data.data.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.code;
        option.textContent = `${model.name} (${model.code})`;
        if (model.provider?.name) {
          option.setAttribute("data-provider", model.provider.name);
        }
        modelSelect.appendChild(option);
      });

      // Add event listener to show model info
      modelSelect.addEventListener("change", function () {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.value) {
          showNotification(
            `Selected model: ${selectedOption.textContent}`,
            "info",
          );
        }
      });
    }
  } catch (error) {
    console.error("Failed to fetch models:", error);
    modelSelect.innerHTML = '<option value="">Failed to load models</option>';
    showNotification("Failed to load models", "error");
  }
}

async function testChatCompletion() {
  const message = document.getElementById("messageInput").value;
  const model = document.getElementById("modelSelect").value;
  const apiKey = document.getElementById("apiKey").value;

  if (!message) {
    showNotification("Please enter a message", "error");
    return;
  }

  if (!model) {
    showNotification("Please select a model", "error");
    return;
  }

  showLoading();

  try {
    const response = await fetch(`${API_BASE}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        model: model,
        stream: false,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      displayResponse({
        success: true,
        model: data.model,
        response: data.choices?.[0]?.message?.content || "No response content",
        usage: data.usage,
        _meta: data._meta,
        timestamp: new Date().toISOString(),
      });
      showNotification("Chat completion successful!", "success");

      // Update today's tokens and requests in UI
      // Note: This is just UI update, actual stats come from server
      if (data.usage?.total_tokens) {
        const newTokens = appState.stats.todayTokens + data.usage.total_tokens;
        todayTokens.textContent = formatTokensForDisplay(newTokens);
      }
    } else {
      displayResponse({
        error: data.error,
        message: data.message,
        code: data.code,
        timestamp: new Date().toISOString(),
      });
      showNotification(`API Error: ${data.error}`, "error");
    }
  } catch (error) {
    displayResponse({
      error: "Request failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
    showNotification("Request failed: " + error.message, "error");
  }
}

// Data Display Functions
async function fetchModels() {
  showLoading();
  try {
    const response = await fetch(`${API_BASE}/api/v1/models`);
    const data = await response.json();
    displayResponse(data);
    showNotification("Models loaded successfully", "success");
  } catch (error) {
    displayResponse({
      error: "Failed to fetch models",
      message: error.message,
    });
    showNotification("Failed to fetch models", "error");
  }
}

async function fetchProviders() {
  showLoading();
  try {
    const response = await fetch(`${API_BASE}/api/v1/providers`);
    const data = await response.json();
    displayResponse(data);
    showNotification("Providers loaded successfully", "success");
  } catch (error) {
    displayResponse({
      error: "Failed to fetch providers",
      message: error.message,
    });
    showNotification("Failed to fetch providers", "error");
  }
}

async function checkHealth() {
  showLoading();
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    displayResponse(data);
    showNotification("Health check completed", "success");
  } catch (error) {
    displayResponse({
      error: "Health check failed",
      message: error.message,
    });
    showNotification("Health check failed", "error");
  }
}

function loadModelsTable() {
  const modelsTable = document.getElementById("modelsTable");
  if (!modelsTable) return;

  if (appState.models.length === 0) {
    modelsTable.innerHTML =
      '<tr><td colspan="5" class="text-center">No models loaded. Click "Refresh" to load models.</td></tr>';
    return;
  }

  let tableHTML = `
        <thead>
            <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Provider</th>
                <th>Created</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
    `;

  appState.models.forEach((model) => {
    tableHTML += `
            <tr>
                <td><strong>${model.name}</strong></td>
                <td><code>${model.code}</code></td>
                <td>${model.provider?.name || "Unknown"}</td>
                <td>${formatDate(model.created)}</td>
                <td>
                    <button class="btn btn-sm secondary" onclick="testModel('${model.code}')">
                        <i class="fas fa-test"></i> Test
                    </button>
                </td>
            </tr>
        `;
  });

  tableHTML += "</tbody>";
  modelsTable.innerHTML = tableHTML;
}

function loadProvidersTable() {
  const providersTable = document.getElementById("providersTable");
  if (!providersTable) return;

  if (appState.providers.length === 0) {
    providersTable.innerHTML =
      '<tr><td colspan="4" class="text-center">No providers loaded. Click "Refresh" to load providers.</td></tr>';
    return;
  }

  let tableHTML = `
        <thead>
            <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Configuration</th>
            </tr>
        </thead>
        <tbody>
    `;

  appState.providers.forEach((provider) => {
    const statusBadge = provider._meta?.hasApiKey
      ? '<span class="badge success">Configured</span>'
      : '<span class="badge warning">No API Key</span>';

    tableHTML += `
            <tr>
                <td><strong>${provider.name}</strong></td>
                <td>${statusBadge}</td>
                <td>${formatDate(provider.created)}</td>
                <td>
                    <span class="badge info">Models: ${appState.models.filter((m) => m.provider?.id === provider.id).length}</span>
                </td>
            </tr>
        `;
  });

  tableHTML += "</tbody>";
  providersTable.innerHTML = tableHTML;
}

function loadAnalytics() {
  const analyticsContent = document.getElementById("analyticsContent");
  if (!analyticsContent) return;

  // 计算平均每个请求的token数
  const avgTokensPerRequest =
    appState.stats.todayRequests > 0
      ? Math.round(appState.stats.todayTokens / appState.stats.todayRequests)
      : 0;

  // 计算token使用率（假设每个请求平均1000个token作为基准）
  const tokenUsageRate =
    appState.stats.todayRequests > 0
      ? Math.round((avgTokensPerRequest / 1000) * 100)
      : 0;

  analyticsContent.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${appState.stats.models}</div>
                <div class="stat-label">Total Models</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${appState.stats.providers}</div>
                <div class="stat-label">AI Providers</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${formatTokensForDisplay(appState.stats.todayTokens)}</div>
                <div class="stat-label">Today's Tokens</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${appState.stats.todayRequests.toLocaleString()}</div>
                <div class="stat-label">Today's Requests</div>
            </div>
        </div>

        <div style="margin-top: 30px;">
            <h3><i class="fas fa-chart-bar"></i> Usage Statistics</h3>

            <div style="margin-top: 20px; background: var(--light-color); padding: 20px; border-radius: 10px;">
                <h4><i class="fas fa-calculator"></i> Token Analysis</h4>
                <div style="margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Average tokens per request:</span>
                        <strong>${avgTokensPerRequest.toLocaleString()}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Token usage rate:</span>
                        <strong>${tokenUsageRate}%</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Estimated cost (approx):</span>
                        <strong>$${(appState.stats.todayTokens * 0.000002).toFixed(4)}</strong>
                    </div>
                </div>
            </div>

            <div style="margin-top: 20px; background: var(--light-color); padding: 20px; border-radius: 10px;">
                <h4><i class="fas fa-info-circle"></i> System Information</h4>
                <div style="margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Service uptime:</span>
                        <strong>${formatDuration(appState.stats.uptime)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Last updated:</span>
                        <strong>${appState.lastUpdate ? new Date(appState.lastUpdate).toLocaleTimeString() : "--"}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Service status:</span>
                        <strong><span class="badge ${appState.serviceStatus === "healthy" ? "success" : appState.serviceStatus === "degraded" ? "warning" : "error"}">${appState.serviceStatus}</span></strong>
                    </div>
                </div>
            </div>

            <div style="margin-top: 20px;">
                <h4><i class="fas fa-lightbulb"></i> Insights</h4>
                <ul style="margin-left: 20px; margin-top: 10px;">
                    <li>Total token usage today: ${formatTokensForDisplay(appState.stats.todayTokens)}</li>
                    <li>Average request size: ${avgTokensPerRequest.toLocaleString()} tokens</li>
                    <li>Request frequency: ${appState.stats.todayRequests > 0 ? Math.round(appState.stats.todayRequests / (new Date().getHours() + 1)) : 0} requests/hour</li>
                    <li>System running for: ${formatDuration(appState.stats.uptime)}</li>
                </ul>
            </div>
        </div>
    `;
}

// UI Helper Functions
function showLoading() {
  responseOutput.textContent = "Loading...";
  responseOutput.style.color = "#666";
  responseOutput.innerHTML = '<div class="loading"></div> Loading...';
}

function displayResponse(data) {
  try {
    responseOutput.textContent = JSON.stringify(data, null, 2);
    responseOutput.style.color = "#e5e7eb";

    // Syntax highlighting for JSON
    responseOutput.innerHTML = syntaxHighlight(JSON.stringify(data, null, 2));

    // Scroll to response
    responseOutput.parentElement.scrollTop = 0;
  } catch (error) {
    responseOutput.textContent = "Error displaying response: " + error.message;
    responseOutput.style.color = "#ef4444";
  }
}

function clearResponse() {
  responseOutput.textContent = "Response cleared";
  responseOutput.style.color = "#666";
  showNotification("Response cleared", "info");
}

function syntaxHighlight(json) {
  json = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    function (match) {
      let cls = "number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "key";
        } else {
          cls = "string";
        }
      } else if (/true|false/.test(match)) {
        cls = "boolean";
      } else if (/null/.test(match)) {
        cls = "null";
      }
      return '<span class="' + cls + '">' + match + "</span>";
    },
  );
}

// Model testing function
async function testModel(modelCode) {
  const messageInput = document.getElementById("messageInput");
  const modelSelect = document.getElementById("modelSelect");

  // Set the model
  modelSelect.value = modelCode;

  // Set a test message if empty
  if (!messageInput.value.trim()) {
    messageInput.value =
      "Hello! Please introduce yourself and tell me what you can do.";
  }

  // Switch to chat tab
  document.querySelector('[data-tab="chat"]').click();

  showNotification(`Testing model: ${modelCode}`, "info");
}

// Auto-refresh functionality
let refreshInterval;
function startAutoRefresh(interval = 30000) {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(async () => {
    console.log("Auto-refreshing service status...");
    await checkServiceStatus();
    await updateStats();
  }, interval);

  showNotification(`Auto-refresh enabled (every ${interval / 1000}s)`, "info");
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    showNotification("Auto-refresh disabled", "info");
  }
}

// Initialize application
function initApp() {
  console.log("Initializing VibeAI Router Dashboard...");

  // Initialize tabs
  initTabs();

  // Load initial data
  checkServiceStatus();
  fetchModelsForSelect();
  loadServiceInfo();

  // Set up auto-refresh
  startAutoRefresh(60000); // Refresh every minute

  // Set up refresh button
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
      await Promise.all([
        checkServiceStatus(),
        fetchModelsForSelect(),
        updateStats(),
      ]);
      refreshBtn.innerHTML = '<i class="fas fa-sync"></i>';
      showNotification("Data refreshed successfully", "success");
    });
  }

  // Set up auto-refresh toggle
  const autoRefreshToggle = document.getElementById("autoRefreshToggle");
  if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener("change", function () {
      if (this.checked) {
        startAutoRefresh(60000);
      } else {
        stopAutoRefresh();
      }
    });
  }

  // Add CSS for syntax highlighting
  const style = document.createElement("style");
  style.textContent = `
        .response-area pre .string { color: #a5d6ff; }
        .response-area pre .number { color: #b5cea8; }
        .response-area pre .boolean { color: #569cd6; }
        .response-area pre .null { color: #569cd6; }
        .response-area pre .key { color: #9cdcfe; }
    `;
  document.head.appendChild(style);

  console.log("Dashboard initialized successfully");
  showNotification("Dashboard loaded and ready!", "success");
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initApp);

// Export for debugging
window.app = {
  state: appState,
  checkServiceStatus,
  updateStats,
  testChatCompletion,
  fetchModels,
  fetchProviders,
  checkHealth,
  startAutoRefresh,
  stopAutoRefresh,
};
