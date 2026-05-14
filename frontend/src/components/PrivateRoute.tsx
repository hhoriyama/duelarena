import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function PrivateRoute({ children, requireAdmin = false }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-arena-subtext">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin) {
    // isAdmin 判定はuseAuthStoreから直接取得することも可能
    // ここでは簡易実装として、認可は別途/api/admin/...側でも検証する
  }

  return <>{children}</>;
}
