import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が設定されていない場合は、セキュリティのため認証を通過させない（またはデフォルト値を設定する）
  if (!user || !password) {
    console.warn('Basic Auth credentials are not set in environment variables.');
    return NextResponse.next(); // 開発中の便宜上、設定がない場合は通過させる設定（必要に応じて変更してください）
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [inputUser, inputPassword] = Buffer.from(authValue, 'base64').toString().split(':');

    if (inputUser === user && inputPassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  // すべてのリクエストに適用。静的ファイル等は除外。
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg).*)'],
};
