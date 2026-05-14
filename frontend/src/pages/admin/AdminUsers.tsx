import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchAdminUsers,
  banAdminUser,
  unbanAdminUser,
  adjustAdminRating,
  type AdminUser,
} from '../../api/admin';

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSearching(true);
    try {
      const result = await searchAdminUsers(query);
      setUsers(result.users);
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">ユーザー管理</h1>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="text-sm text-arena-subtext hover:text-arena-text"
        >
          戻る
        </button>
      </header>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="search"
          className="flex-1 bg-arena-surface border border-arena-border rounded p-2"
          placeholder="ユーザー名 または Discord ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-arena-accent hover:bg-arena-accentHover text-white font-bold px-4 rounded"
        >
          検索
        </button>
      </form>

      {error && <p className="text-arena-accent mb-4">{error}</p>}

      {users.length === 0 && !searching && (
        <p className="text-arena-subtext text-center py-8">
          検索ワードを入れてユーザーを検索してください
        </p>
      )}

      <ul className="space-y-3">
        {users.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}
      </ul>
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();
  const [adjusting, setAdjusting] = useState(false);
  const [newRating, setNewRating] = useState(user.currentRating);
  const [reason, setReason] = useState('');

  const banMut = useMutation({
    mutationFn: () => banAdminUser(user.id, '管理者によるBAN'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  const unbanMut = useMutation({
    mutationFn: () => unbanAdminUser(user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  const adjustMut = useMutation({
    mutationFn: () => adjustAdminRating(user.id, newRating, reason || '管理者調整'),
    onSuccess: () => {
      setAdjusting(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  return (
    <li className="bg-arena-surface border border-arena-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <img
          src={user.avatarUrl}
          alt=""
          className="w-12 h-12 rounded-full border border-arena-border"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">
            {user.username}
            {user.isBanned && (
              <span className="ml-2 text-xs text-rose-400">BAN中</span>
            )}
          </p>
          <p className="text-arena-subtext text-xs truncate">
            Discord: {user.discordId} / レート: {user.currentRating} / {user.wins}勝
            {user.losses}敗
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {user.isBanned ? (
          <button
            type="button"
            onClick={() => unbanMut.mutate()}
            disabled={unbanMut.isPending}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 rounded text-sm"
          >
            BAN解除
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`${user.username} をBANしますか？`)) banMut.mutate();
            }}
            disabled={banMut.isPending}
            className="bg-rose-700 hover:bg-rose-800 text-white font-semibold py-2 rounded text-sm"
          >
            BAN
          </button>
        )}
        <button
          type="button"
          onClick={() => setAdjusting(!adjusting)}
          className="bg-arena-border hover:bg-arena-border/80 text-arena-text font-semibold py-2 rounded text-sm"
        >
          {adjusting ? '閉じる' : 'レート調整'}
        </button>
      </div>

      {adjusting && (
        <div className="mt-3 bg-arena-bg border border-arena-border rounded p-3 space-y-2">
          <input
            type="number"
            className="w-full bg-arena-surface border border-arena-border rounded p-2"
            value={newRating}
            min={0}
            onChange={(e) => setNewRating(Number(e.target.value))}
            placeholder="新しいレート"
          />
          <input
            type="text"
            className="w-full bg-arena-surface border border-arena-border rounded p-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="理由（任意）"
          />
          <button
            type="button"
            onClick={() => adjustMut.mutate()}
            disabled={adjustMut.isPending}
            className="w-full bg-arena-accent hover:bg-arena-accentHover text-white font-semibold py-2 rounded"
          >
            適用
          </button>
        </div>
      )}
    </li>
  );
}

export default AdminUsersPage;
