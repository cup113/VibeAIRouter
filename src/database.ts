import PocketBase from "pocketbase";
import { TypedPocketBase } from "./types/pocketbase-types";

/**
 * PocketBase 数据库客户端管理器
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private pb: TypedPocketBase | null = null;
  private isConnected = false;

  private constructor() {}

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
   * 初始化数据库连接
   */
  public async initialize(): Promise<TypedPocketBase> {
    if (this.pb && this.isConnected) {
      return this.pb;
    }

    const pocketbaseUrl = process.env.POCKETBASE_URL || "http://localhost:8090";
    const adminEmail =
      process.env.POCKETBASE_ADMIN_EMAIL || "admin@example.com";
    const adminPassword =
      process.env.POCKETBASE_ADMIN_PASSWORD || "adminpassword123";

    try {
      // 创建 PocketBase 实例
      this.pb = new PocketBase(pocketbaseUrl) as TypedPocketBase;

      // 设置自动取消认证（token 过期时）
      this.pb.authStore.onChange(() => {
        if (!this.pb?.authStore.isValid) {
          this.pb?.authStore.clear();
        }
      });

      // 尝试使用管理员身份认证
      await this.pb.admins.authWithPassword(adminEmail, adminPassword);

      console.log(`✅ Connected to PocketBase at ${pocketbaseUrl}`);
      this.isConnected = true;

      return this.pb;
    } catch (error: any) {
      console.error("❌ Failed to connect to PocketBase:", error.message);

      // 如果认证失败，仍然创建实例但不进行认证
      this.pb = new PocketBase(pocketbaseUrl) as TypedPocketBase;
      this.isConnected = false;

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
      await this.pb.collection("providers").getList(1, 1);
      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  // --- 特定集合的辅助方法 ---

  /**
   * 获取所有模型
   */
  public async getAllModels(filters?: { providerId?: string }): Promise<any[]> {
    const pb = this.getClient();

    let filter = "";
    if (filters?.providerId) {
      filter = `provider = "${filters.providerId}"`;
    }

    try {
      const records = await pb.collection("models").getFullList({
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
  public async getAllProviders(): Promise<any[]> {
    const pb = this.getClient();

    try {
      const records = await pb.collection("providers").getFullList({
        sort: "-created",
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
  public async getOrCreateGuest(ip: string): Promise<any> {
    const pb = this.getClient();

    try {
      // 尝试查找现有访客
      const existingGuests = await pb.collection("guests").getList(1, 1, {
        filter: `ip = "${ip}"`,
      });

      if (existingGuests.items.length > 0) {
        return existingGuests.items[0];
      }

      // 创建新访客
      const guestData = {
        ip,
        requests: 0,
        tokens: 0,
        blacklisted: false,
      };

      const newGuest = await pb.collection("guests").create(guestData);
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
    guestId: string,
    tokensUsed: number,
    requestsIncrement: number = 1,
  ): Promise<void> {
    const pb = this.getClient();

    try {
      const guest = await pb.collection("guests").getOne(guestId);

      await pb.collection("guests").update(guestId, {
        requests: (guest.requests || 0) + requestsIncrement,
        tokens: (guest.tokens || 0) + tokensUsed,
      });
    } catch (error: any) {
      console.error("Error updating guest usage:", error.message);
    }
  }

  /**
   * 创建使用日志
   */
  public async createUsageLog(data: {
    guestId: string;
    modelId: string;
    tokenInput?: number;
    tokenOutput?: number;
    duration?: number;
    firstTokenLatency?: number;
  }): Promise<void> {
    const pb = this.getClient();

    try {
      await pb.collection("usageLogs").create({
        guest: data.guestId,
        model: data.modelId,
        tokenInput: data.tokenInput || 0,
        tokenOutput: data.tokenOutput || 0,
        duration: data.duration || 0,
        firstTokenLatency: data.firstTokenLatency || 0,
      });
    } catch (error: any) {
      console.error("Error creating usage log:", error.message);
    }
  }

  /**
   * 获取提供商 API 密钥（安全地）
   */
  public async getProviderApiKey(providerId: string): Promise<string | null> {
    const pb = this.getClient();

    try {
      const provider = await pb.collection("providers").getOne(providerId);
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
}

// 导出单例实例和类型
export const db = DatabaseManager.getInstance();
export { TypedPocketBase };
export * from "./types/pocketbase-types";
