/**
 * 複数タブ禁止のための、ユーザーごとに有効な1ソケットを追跡するシンプルなトラッカー。
 *
 * 仕様 §3.2: 「複数タブ禁止：最初に接続したタブを有効とし、後から開いたタブはブロック」
 */
export class ConnectionTracker {
  private userToSocket = new Map<string, string>();
  private socketToUser = new Map<string, string>();

  /**
   * 接続を登録する。
   * @returns true=成功、false=既に同一ユーザーの別ソケットがあるためブロック
   */
  register(userId: string, socketId: string): boolean {
    const existing = this.userToSocket.get(userId);
    if (existing && existing !== socketId) return false;
    this.userToSocket.set(userId, socketId);
    this.socketToUser.set(socketId, userId);
    return true;
  }

  /**
   * 切断時にエントリを削除する
   */
  unregister(socketId: string): string | null {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return null;
    this.socketToUser.delete(socketId);
    if (this.userToSocket.get(userId) === socketId) {
      this.userToSocket.delete(userId);
    }
    return userId;
  }

  /**
   * ユーザーの現在のソケットIDを取得
   */
  getSocketId(userId: string): string | null {
    return this.userToSocket.get(userId) ?? null;
  }

  /**
   * ソケットIDからユーザーIDを取得
   */
  getUserId(socketId: string): string | null {
    return this.socketToUser.get(socketId) ?? null;
  }

  size(): number {
    return this.userToSocket.size;
  }
}

export const globalTracker = new ConnectionTracker();
