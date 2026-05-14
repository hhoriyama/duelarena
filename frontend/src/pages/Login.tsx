import { getDiscordLoginUrl } from '../api/auth';

export function LoginPage() {
  const loginUrl = getDiscordLoginUrl();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="bg-arena-surface border border-arena-border rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <h1 className="text-3xl font-bold mb-2 text-arena-text">デュエルアリーナ</h1>
        <p className="text-arena-subtext mb-8">
          Discordアカウントでログインして対戦を始めよう。
        </p>

        <a
          href={loginUrl}
          aria-label="Discordでログイン"
          className="inline-flex items-center justify-center gap-2 w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold rounded-lg px-6 py-3 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 71 55"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.4a.2.2 0 0 0-.2.1c-.6 1.1-1.4 2.6-1.9 3.8a54 54 0 0 0-16.5 0c-.5-1.2-1.3-2.7-2-3.8a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 9.9 4.9a.2.2 0 0 0-.1.1A60.4 60.4 0 0 0 .4 45.5a.2.2 0 0 0 .1.2 59 59 0 0 0 17.7 8.9.2.2 0 0 0 .2-.1c1.4-1.9 2.6-3.9 3.6-6a.2.2 0 0 0-.1-.3 39 39 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.8a.2.2 0 0 1 .2 0c11.6 5.3 24.2 5.3 35.7 0a.2.2 0 0 1 .2 0l1.1.8a.2.2 0 0 1 0 .4c-1.7 1-3.5 1.9-5.5 2.6a.2.2 0 0 0-.1.3c1 2.1 2.2 4.1 3.6 6a.2.2 0 0 0 .2.1 59 59 0 0 0 17.7-8.9.2.2 0 0 0 .1-.2 60 60 0 0 0-9.4-40.5.1.1 0 0 0-.1-.1ZM23.7 37c-3.5 0-6.4-3.2-6.4-7.1 0-3.9 2.8-7.1 6.4-7.1 3.6 0 6.5 3.2 6.4 7.1 0 4-2.8 7.1-6.4 7.1Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1 0-3.9 2.8-7.1 6.4-7.1 3.6 0 6.5 3.2 6.4 7.1 0 4-2.8 7.1-6.4 7.1Z" />
          </svg>
          Discord でログイン
        </a>

        <p className="text-arena-subtext text-xs mt-6">
          ログインすることで利用規約に同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
