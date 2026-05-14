import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Discord OAuth 成功後にリダイレクトされてくるページ。
 * Cookie はバック側でセット済みなので、認証情報を再取得してダッシュボードへ。
 */
export function AuthSuccessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['me'] });
    navigate('/', { replace: true });
  }, [navigate, queryClient]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-arena-subtext">ログイン処理中...</p>
    </div>
  );
}

export default AuthSuccessPage;
