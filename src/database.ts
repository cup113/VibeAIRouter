import PocketBase from "pocketbase";
import {
  TypedPocketBase,
  ModelsResponse,
  ProvidersResponse,
  GuestsResponse,
  UsageLogsResponse,
  RecordIdString,
  Create,
  Update,
} from "./types/pocketbase-types";

/**
 * PocketBase 数据库客户端管理器
 * 使用单例模式，不进行管理员认证，允许所有用户访问
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private pb: TypedPocketBase | null = null;
  private isConnected = false;

  /**
   * 私有构造函数，防止外部实例化
   */
  private constructor() {
    // 初始化时不进行任何操作
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * 初始化数据库连接（不进行管理员认证）
   */
  public async initialize(): Promise<TypedPocketBase> {
    if (this.pb && this.isConnected) {
      return this.pb;
    }

    const pocketbaseUrl =
      process.env.POCKETBASE_URL ||
      (process.env.NODE_ENV === "production"
        ? "http://pocketbase:8090"
        : "http://localhost:4162");

    try {
      // 创建 PocketBase 实例
      this.pb = new PocketBase(pocketbaseUrl) as TypedPocketBase;

      // 设置自动取消认证（token 过期时）
      this.pb.authStore.onChange(() => {
        if (!this.pb?.authStore.isValid) {
          this.pb?.authStore.clear();
        }
      });

      // 不进行管理员认证，允许所有用户访问
      console.log(
        `✅ Connected to PocketBase at ${pocketbaseUrl} (unauthenticated mode)`,
      );
      this.isConnected = true;

      return this.pb;
    } catch (error: any) {
      console.error("❌ Failed to connect to PocketBase:", error.message);

      // 如果连接失败，仍然创建实例但不标记为已连接
      this.pb = new PocketBase(pocketbaseUrl) as TypedPocketBase;
      this.isConnected = false;

      console.warn(
        "⚠️  PocketBase connection failed, but instance created (may not be functional)",
      );
      return this.pb;
    }
  }

  /**
   * 获取数据库客户端
   */
  public getClient(): TypedPocketBase {
    if (!this.pb) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.pb;
  }

  /**
   * 检查数据库连接状态
   */
  public isInitialized(): boolean {
    return this.isConnected && this.pb !== null;
  }

  /**
   * 断开数据库连接
   */
  public async disconnect(): Promise<void> {
    if (this.pb) {
      this.pb.authStore.clear();
      this.pb = null;
      this.isConnected = false;
      console.log("✅ Disconnected from PocketBase");
    }
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    if (!this.pb) {
      return { healthy: false, error: "Database not initialized" };
    }

    try {
      // 发送一个简单的请求来检查连接
      await this.pb.collection("providers").getList(1, 1, {
        requestKey: null,
      });
      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  // --- 特定集合的辅助方法 ---

  /**
   * 获取所有模型
   */
  public async getAllModels(filters?: { providerId?: RecordIdString }): Promise<
    ModelsResponse<{
      provider: ProvidersResponse;
    }>[]
  > {
    const pb = this.getClient();

    let filter = "";
    if (filters?.providerId) {
      filter = `provider = "${filters.providerId}"`;
    }

    try {
      const records = await pb.collection("models").getFullList<
        ModelsResponse<{
          provider: ProvidersResponse;
        }>
      >({
        filter,
        sort: "-created",
        expand: "provider",
      });
      return records;
    } catch (error) {
      console.error("Error fetching models:", error);
      return [];
    }
  }

  /**
   * 获取所有提供商
   */
  public async getAllProviders(): Promise<ProvidersResponse[]> {
    const pb = this.getClient();

    try {
      const records = await pb.collection("providers").getFullList({
        sort: "-created",
        requestKey: null,
      });
      return records;
    } catch (error) {
      console.error("Error fetching providers:", error);
      return [];
    }
  }

  /**
   * 获取或创建访客记录
   */
  public async getOrCreateGuest(ip: string): Promise<GuestsResponse> {
    const pb = this.getClient();

    try {
      // 尝试查找现有访客
      const existingGuests = await pb.collection("guests").getList(1, 1, {
        filter: `ip = "${ip}"`,
        requestKey: null,
      });

      if (existingGuests.items.length > 0) {
        return existingGuests.items[0];
      }

      // 创建新访客
      const guestData: Create<"guests"> = {
        ip,
        requests: 0,
        tokens: 0,
        blacklisted: false,
      };

      const newGuest = await pb.collection("guests").create(guestData, {
        requestKey: null,
      });
      return newGuest;
    } catch (error: any) {
      console.error("Error getting/creating guest:", error.message);
      throw error;
    }
  }

  /**
   * 更新访客使用统计
   */
  public async updateGuestUsage(
    guestId: RecordIdString,
    tokensUsed: number,
    requestsIncrement: number = 1,
  ): Promise<void> {
    const pb = this.getClient();

    try {
      const guest = await pb.collection("guests").getOne(guestId, {
        requestKey: null,
      });

      const updateData: Update<"guests"> = {
        requests: (guest.requests || 0) + requestsIncrement,
        tokens: (guest.tokens || 0) + tokensUsed,
      };

      await pb.collection("guests").update(guestId, updateData, {
        requestKey: null,
      });
    } catch (error: any) {
      console.error("Error updating guest usage:", error.message);
    }
  }

  /**
   * 创建使用日志
   */
  public async createUsageLog(data: {
    guestId: RecordIdString;
    modelId: RecordIdString;
    tokenInput?: number;
    tokenOutput?: number;
    duration?: number;
    firstTokenLatency?: number;
  }): Promise<UsageLogsResponse> {
    const pb = this.getClient();

    try {
      const logData: Create<"usageLogs"> = {
        guest: data.guestId,
        model: data.modelId,
        tokenInput: data.tokenInput || 0,
        tokenOutput: data.tokenOutput || 0,
        duration: data.duration || 0,
        firstTokenLatency: data.firstTokenLatency || 0,
      };

      const usageLog = await pb.collection("usageLogs").create(logData, {
        requestKey: null,
      });
      return usageLog;
    } catch (error: any) {
      console.error("Error creating usage log:", error.message);
      throw error;
    }
  }

  /**
   * 获取提供商 API 密钥（安全地）
   */
  public async getProviderApiKey(
    providerId: RecordIdString,
  ): Promise<string | null> {
    const pb = this.getClient();

    try {
      const provider = await pb.collection("providers").getOne(providerId, {
        requestKey: null,
      });
      return provider.apiKey || null;
    } catch (error: any) {
      console.error("Error fetching provider API key:", error.message);
      return null;
    }
  }

  /**
   * 检查访客是否被列入黑名单
   */
  public async isGuestBlacklisted(ip: string): Promise<boolean> {
    const pb = this.getClient();

    try {
      const guests = await pb.collection("guests").getList(1, 1, {
        filter: `ip = "${ip}"`,
        requestKey: null,
      });

      if (guests.items.length === 0) {
        return false;
      }

      return guests.items[0].blacklisted === true;
    } catch (error: any) {
      console.error("Error checking guest blacklist:", error.message);
      return false;
    }
  }

  /**
   * 获取今日 token 使用统计
   */
  public async getTodayTokenStats(): Promise<{
    totalTokens: number;
    totalRequests: number;
    today: string;
  }> {
    const pb = this.getClient();

    try {
      // 获取今天的日期（YYYY-MM-DD格式）
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000)
        .toISOString()
        .split("T")[0];

      // 查询今日的使用日志
      const usageLogs = await pb.collection("usageLogs").getFullList({
        filter: `created >= "${today}" && created < "${tomorrow}"`,
        requestKey: null,
      });

      // 计算总 token 数和请求数
      let totalTokens = 0;
      let totalRequests = 0;

      usageLogs.forEach((log) => {
        totalTokens += (log.tokenInput || 0) + (log.tokenOutput || 0);
        totalRequests += 1;
      });

      return {
        totalTokens,
        totalRequests,
        today,
      };
    } catch (error: any) {
      console.error("Error fetching today's token stats:", error.message);
      return {
        totalTokens: 0,
        totalRequests: 0,
        today: new Date().toISOString().split("T")[0],
      };
    }
  }

  /**
   * 获取今日访客请求统计
   */
  public async getTodayGuestStats(): Promise<{
    uniqueGuests: number;
    totalGuestRequests: number;
    totalGuestTokens: number;
  }> {
    const pb = this.getClient();

    try {
      // 获取今天的日期
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000)
        .toISOString()
        .split("T")[0];

      // 查询今日有活动的访客
      const usageLogs = await pb.collection("usageLogs").getFullList({
        filter: `created >= "${today}" && created < "${tomorrow}"`,
        requestKey: null,
        expand: "guest",
      });

      // 统计唯一访客和总请求/总 token
      const uniqueGuestIds = new Set<string>();
      let totalGuestRequests = 0;
      let totalGuestTokens = 0;

      usageLogs.forEach((log) => {
        if (log.guest) {
          uniqueGuestIds.add(log.guest);
          totalGuestRequests += 1;
          totalGuestTokens += (log.tokenInput || 0) + (log.tokenOutput || 0);
        }
      });

      return {
        uniqueGuests: uniqueGuestIds.size,
        totalGuestRequests,
        totalGuestTokens,
      };
    } catch (error: any) {
      console.error("Error fetching today's guest stats:", error.message);
      return {
        uniqueGuests: 0,
        totalGuestRequests: 0,
        totalGuestTokens: 0,
      };
    }
  }
}

// 导出单例实例和类型
export const db = DatabaseManager.getInstance();
export { TypedPocketBase };
export * from "./types/pocketbase-types";
