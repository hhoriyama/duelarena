import { Link } from 'react-router-dom';

export function AuthErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="bg-arena-surface border border-arena-border rounded-2xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-2 text-arena-accent">ログインに失敗しました</h1>
        <p className="text-arena-subtext mb-6">
          Discord認証中に問題が発生しました。もう一度お試しください。
        </p>
        <Link
          to="/login"
          className="inline-block bg-arena-accent hover:bg-arena-accentHover text-white font-semibold px-6 py-3 rounded-lg"
        >
          ログイン画面へ戻る
        </Link>
      </div>
    </div>
  );
}

export default AuthErrorPage;
