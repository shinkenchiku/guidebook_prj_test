'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// マップコンポーネントをSSRなしで動的にインポート
const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-gray-100 flex items-center justify-center rounded-lg">マップを読み込み中...</div>
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-white text-gray-900">
      <div className="z-10 max-w-5xl w-full flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">建築ガイドブック デジタル版</h1>
          <p className="text-gray-500">マップから建築物を探索し、あなたの足跡を残しましょう。</p>
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">現在地付近のマップ</h2>
            <div className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">
              GPS連動中
            </div>
          </div>
          
          {/* マップコンポーネントの表示 */}
          <Suspense fallback={<div>読み込み中...</div>}>
            <MapWithNoSSR />
          </Suspense>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border rounded-xl hover:shadow-md transition-shadow">
            <h3 className="font-bold mb-2">📍 ピンを読み込む</h3>
            <p className="text-sm text-gray-600">JSONファイルから建築情報を読み込み、マップ上に表示します。</p>
          </div>
          <div className="p-6 border rounded-xl hover:shadow-md transition-shadow">
            <h3 className="font-bold mb-2">🏆 アチーブメント</h3>
            <p className="text-sm text-gray-600">訪れた建築物の記録を確認し、バッジを獲得しましょう。</p>
          </div>
        </section>
      </div>
    </main>
  );
}
