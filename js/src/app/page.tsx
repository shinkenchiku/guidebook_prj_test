'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { ArchitectureInit, ArchitectureMain, UserLocation, MapCommand } from '../types';
import { MapPin, Trophy, Info, ExternalLink, Navigation, Route, Crosshair, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight } from 'lucide-react';

// マップコンポーネントをSSRなしで動的にインポート
const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-[400px] md:h-full w-full bg-gray-100 flex items-center justify-center text-black">マップを読み込み中...</div>
});

// 2地点間の距離を計算する関数 (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return Infinity;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Home() {
  const [initData, setInitData] = useState<ArchitectureInit[]>([]);
  const [mainData, setMainData] = useState<ArchitectureMain[]>([]);
  const [selectedArch, setSelectedArch] = useState<ArchitectureMain | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [visitedTitles, setVisitedTitles] = useState<string[]>([]);
  const [radius, setRadius] = useState<number>(2); // km
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const [isAchievementOpen, setIsAchievementOpen] = useState(false);
  const [routeDestTitle, setRouteDestTitle] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [currentImgIdx, setCurrentImgIdx] = useState(0);

  // マウント状態の管理（Hydrationエラー対策）
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // データの読み込み
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching data...");
        
        // 各データを個別に取得し、失敗しても他を巻き込まないようにする
        const fetchJson = async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
          const text = await res.text();
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error(`JSON Parse Error for ${url}:`, text.substring(0, 100));
            throw e;
          }
        };

        const [init, main, photos] = await Promise.all([
          fetchJson('/data/init.json').catch(e => { console.error(e); return []; }),
          fetchJson('/data/main.json').catch(e => { console.error(e); return []; }),
          fetchJson('/data/photo.json').catch(e => { console.error("Photo data fetch skipped or failed:", e); return []; })
        ]);

        console.log(`Data loaded: init=${init.length}, main=${main.length}, photos=${photos.length}`);

        if (init.length === 0) {
          console.warn("init.json is empty or failed to load. Pins will not be displayed.");
        }

        // main.jsonにphoto.jsonの画像URLを統合
        const mergedMain = main.map((item: ArchitectureMain) => {
          const photoData = Array.isArray(photos) ? photos.find((p: any) => p.title === item.title) : null;
          return {
            ...item,
            images: photoData && photoData.url && photoData.url.length > 0 ? photoData.url : (item.image ? [item.image] : [])
          };
        });

        setInitData(init);
        setMainData(mergedMain);

        const saved = localStorage.getItem('visited_architectures');
        if (saved) {
          setVisitedTitles(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Critical data fetch error:", e);
      }
    };
    
    fetchData();
  }, []);

  // 画像切り替え処理
  const nextImage = useCallback(() => {
    if (!selectedArch || !selectedArch.images || selectedArch.images.length <= 1) return;
    setCurrentImgIdx(prev => (prev + 1) % selectedArch.images!.length);
  }, [selectedArch]);

  const prevImage = useCallback(() => {
    if (!selectedArch || !selectedArch.images || selectedArch.images.length <= 1) return;
    setCurrentImgIdx(prev => (prev - 1 + selectedArch.images!.length) % selectedArch.images!.length);
  }, [selectedArch]);

  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedArch) return;
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedArch, nextImage, prevImage]);

  // 建築物が選択された時の処理
  const handleSelectArchitecture = (title: string, zoom = true) => {
    const detail = mainData.find(item => item.title === title);
    const initInfo = initData.find(item => item.title === title);
    
    if (detail) {
      setSelectedArch(detail);
      setCurrentImgIdx(0); // インデックスをリセット
      setRouteDestTitle(null); 
      if (zoom && initInfo && initInfo.location && initInfo.location[0]) {
        const lat = parseFloat(initInfo.location[0]);
        const lng = parseFloat(initInfo.location[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          setMapCommand({ 
            type: 'FLY_TO', 
            payload: { lat, lng, zoom: 17 } 
          });
        }
        
        // モバイルで選択された場合に詳細が見えるよう少しスクロール
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setTimeout(() => {
            const el = document.getElementById('arch-info');
            el?.scrollIntoView({ behavior: 'smooth' });
          }, 500);
        }
      }
    }
  };

  // タグクリック時の処理
  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
      setMapCommand({ type: 'RESET_VIEW', payload: null });
    } else {
      setSelectedTag(tag);
      const filteredTitles = mainData
        .filter(item => item.tags && item.tags.includes(tag))
        .map(item => item.title);
      
      const filteredLocs = initData
        .filter(item => filteredTitles.includes(item.title) && item.location && item.location[0])
        .map(item => {
          const lat = parseFloat(item.location[0]);
          const lng = parseFloat(item.location[1]);
          return [lat, lng] as [number, number];
        })
        .filter(loc => !isNaN(loc[0]) && !isNaN(loc[1]));

      if (filteredLocs.length > 0) {
        setMapCommand({ type: 'FIT_BOUNDS', payload: filteredLocs });
      }
    }
  };

  // ルート表示
  const handleShowRoute = (e: React.MouseEvent | null, item: ArchitectureInit | ArchitectureMain) => {
    if (e) e.stopPropagation();
    if (!userLocation) return;
    
    let targetLoc: [string, string] | null = null;
    if ('location' in item) {
      targetLoc = item.location;
    } else {
      const init = initData.find(i => i.title === item.title);
      if (init) targetLoc = init.location;
    }

    if (!targetLoc || !targetLoc[0]) return;
    
    const lat = parseFloat(targetLoc[0]);
    const lng = parseFloat(targetLoc[1]);
    if (isNaN(lat) || isNaN(lng)) return;

    setRouteDestTitle(item.title);
    setMapCommand({
      type: 'SHOW_ROUTE',
      payload: { to: { lat, lng } }
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 現在地へ移動
  const handleCenterUser = () => {
    if (userLocation) {
      setMapCommand({
        type: 'FLY_TO',
        payload: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          zoom: 17
        }
      });
    }
  };

  // 表示するピンのフィルタリング
  const displayArchitectures = useMemo(() => {
    if (!selectedTag) return initData;
    const filteredTitles = mainData
      .filter(item => item.tags && item.tags.includes(selectedTag))
      .map(item => item.title);
    return initData.filter(item => filteredTitles.includes(item.title));
  }, [initData, mainData, selectedTag]);

  // サジェスト計算
  const suggestions = useMemo(() => {
    if (!userLocation || initData.length === 0) return [];
    return initData
      .map(item => {
        if (!item.location || !item.location[0]) return { ...item, distance: Infinity };
        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          parseFloat(item.location[0]),
          parseFloat(item.location[1])
        );
        return { ...item, distance: dist };
      })
      .filter(item => item.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 15);
  }, [userLocation, initData, radius]);

  // 訪問判定
  useEffect(() => {
    if (!userLocation || initData.length === 0) return;
    
    const checkCheckin = () => {
      let changed = false;
      const newVisited = [...visitedTitles];
      
      initData.forEach(item => {
        if (!item.location || !item.location[0] || visitedTitles.includes(item.title)) return;
        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          parseFloat(item.location[0]),
          parseFloat(item.location[1])
        );
        if (dist < 0.05) {
          newVisited.push(item.title);
          changed = true;
        }
      });

      if (changed) {
        setVisitedTitles(newVisited);
        localStorage.setItem('visited_architectures', JSON.stringify(newVisited));
      }
    };

    checkCheckin();
  }, [userLocation, initData, visitedTitles]);

  // Hydration対策: マウント前は最小限のレンダリング
  if (!isMounted) return <div className="bg-gray-50 min-h-screen" />;

  return (
    <main className="relative w-full min-h-screen md:h-screen overflow-x-hidden md:overflow-hidden bg-gray-50 font-sans flex flex-col md:block text-black">
      
      {/* マップセクション */}
      <div className="relative w-full h-[400px] md:h-full md:absolute md:inset-0 z-0 shrink-0">
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-gray-100 text-black">読み込み中...</div>}>
          <MapWithNoSSR 
            onSelectArchitecture={(title) => handleSelectArchitecture(title, true)} 
            userLocation={userLocation}
            setUserLocation={setUserLocation}
            radius={radius}
            command={mapCommand}
            highlightTitle={routeDestTitle || selectedArch?.title || null}
            displayData={displayArchitectures}
          />
        </Suspense>
        
        <div className="absolute bottom-6 right-6 z-[1000] pointer-events-auto">
          <button 
            onClick={handleCenterUser}
            className="p-3 bg-white shadow-2xl rounded-full text-black hover:text-blue-900 transition-all border border-gray-100 active:scale-90 flex items-center justify-center"
            title="現在地を表示"
          >
            <Crosshair size={24} />
          </button>
        </div>

        {selectedTag && (
          <div className="absolute top-6 right-6 z-[1000] pointer-events-auto">
            <button 
              onClick={() => setSelectedTag(null)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-full shadow-xl font-bold text-xs hover:bg-black transition-colors"
            >
              #{selectedTag} フィルター中
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* コンテンツセクション */}
      <div className="relative w-full md:absolute md:top-0 md:left-0 md:h-full md:w-[30%] z-10 p-4 pointer-events-auto flex flex-col gap-4 md:overflow-y-auto custom-scrollbar md:bg-white/5 md:backdrop-blur-[2px]">
        
        <header className="hidden md:block bg-white shadow-xl rounded-xl p-6 border-t-4 border-blue-900 shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-blue-900">ARCHI-GUIDE</h1>
          <p className="text-[10px] font-bold text-black uppercase tracking-wider mt-1">Digital Guidebook v1.0</p>
        </header>

        {(selectedArch || (isMounted && window.innerWidth >= 768)) && (
          <section id="arch-info" className={`bg-white shadow-xl rounded-xl p-4 min-h-[140px] transition-all duration-300 shrink-0 ${!selectedArch && 'hidden md:block'}`}>
            <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
              <Info className="text-blue-900" size={18} />
              <h2 className="text-sm font-bold text-blue-900 uppercase">Architecture Info</h2>
            </div>

            {selectedArch ? (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-left-2">
                {/* 建築画像表示セクション (スライダー) - アスペクト比をさらに薄く調整 */}
                <div className="w-full aspect-[21/9] bg-gray-100 rounded-lg overflow-hidden border border-gray-100 relative group">
                  <img 
                    src={(selectedArch.images && selectedArch.images.length > 0) ? selectedArch.images[currentImgIdx] : '/img/noimage.jpg'} 
                    alt={selectedArch.title}
                    className="w-full h-full object-cover transition-opacity duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/img/noimage.jpg';
                    }}
                  />
                  
                  {/* 切り替えボタン (複数枚ある場合) */}
                  {selectedArch.images && selectedArch.images.length > 1 && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); prevImage(); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/30 text-white rounded-full hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); nextImage(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/30 text-white rounded-full hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <ChevronRight size={20} />
                      </button>
                      
                      {/* インジケーター */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {selectedArch.images.map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentImgIdx ? 'bg-white scale-125' : 'bg-white/40'}`}
                          />
                        ))}
                      </div>
                      
                      {/* カウンター */}
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 text-white text-[10px] font-bold rounded-full">
                        {currentImgIdx + 1} / {selectedArch.images.length}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-between items-start gap-2 text-black">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-blue-900 leading-tight">{selectedArch.title}</h3>
                    <p className="text-black text-[10px] font-bold mt-0.5 opacity-80">{selectedArch.architect}</p>
                  </div>
                  <button 
                    onClick={() => handleShowRoute(null, selectedArch)}
                    className="p-2 bg-blue-900 rounded-lg text-white hover:bg-black transition-all shadow-md shrink-0"
                    title="ここへのルートを表示"
                  >
                    <Route size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-black">
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="text-blue-900 font-bold mb-0.5 opacity-60">Completion</div>
                    <div className="text-black font-bold">{selectedArch.completion || '-'}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="text-blue-900 font-bold mb-0.5 opacity-60">Building Use</div>
                    <div className="text-black font-bold line-clamp-1">
                      {Array.isArray(selectedArch.builduse) 
                        ? (selectedArch.builduse.length > 0 ? selectedArch.builduse.join(', ') : '-') 
                        : (selectedArch.builduse || '-')}
                    </div>
                  </div>
                  <div className="col-span-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="text-blue-900 font-bold mb-0.5 opacity-60">Address</div>
                    <div className="text-black font-bold leading-tight">{selectedArch.address}</div>
                  </div>
                </div>

                {selectedArch.memo && (
                  <div className="text-[11px] bg-gray-50 p-2 rounded-lg border border-gray-200 text-black leading-relaxed italic line-clamp-3">
                    {selectedArch.memo}
                  </div>
                )}

                {selectedArch.tags && selectedArch.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
                    {selectedArch.tags.map((tag, i) => tag && (
                      <button 
                        key={i} 
                        onClick={() => handleTagClick(tag)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black transition-all ${selectedTag === tag ? 'bg-blue-900 text-white' : 'bg-gray-100 text-black hover:bg-blue-100 hover:text-blue-900'}`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {selectedArch.link && (
                  <a 
                    href={selectedArch.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 bg-blue-900 text-white rounded-lg font-bold hover:bg-black transition-all text-[10px] shadow-md mt-1"
                  >
                    <ExternalLink size={12} /> MORE INFORMATION
                  </a>
                )}
              </div>
            ) : (
              <div className="hidden md:flex flex-col items-center justify-center py-10 opacity-30">
                <MapPin size={32} className="text-blue-900" />
                <p className="text-[10px] font-bold mt-2 uppercase tracking-widest text-black text-center">Select a pin for details</p>
              </div>
            )}
          </section>
        )}

        {/* 近くの建築 */}
        <section className="bg-white shadow-xl rounded-xl p-6 flex flex-col gap-4 shrink-0">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <Navigation className="text-blue-900" size={18} />
              <h2 className="text-sm font-bold text-blue-900 uppercase">Nearby</h2>
            </div>
            <select 
              className="text-[10px] font-bold border-2 border-blue-900 rounded-full px-3 py-1 bg-white text-blue-900 focus:outline-none"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            >
              <option value={0.5}>500m</option>
              <option value={1}>1km</option>
              <option value={2}>2km</option>
              <option value={5}>5km</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-2 text-black">
            {userLocation ? (
              suggestions.length > 0 ? (
                suggestions.map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSelectArchitecture(item.title, true)}
                    className="group flex items-center justify-between p-3 bg-white hover:bg-blue-900 rounded-lg border border-gray-100 transition-all text-left shadow-sm active:scale-[0.98]"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-bold text-[11px] truncate text-black group-hover:text-white transition-colors">{item.title}</div>
                      <div className="text-[9px] font-bold truncate text-black opacity-60 group-hover:text-blue-100 group-hover:opacity-100 transition-colors">{item.architect}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-black group-hover:text-white">
                      <div className="text-[10px] font-bold text-blue-900 group-hover:text-white">
                        {item.distance < 1 ? `${(item.distance * 1000).toFixed(0)}m` : `${item.distance.toFixed(1)}km`}
                      </div>
                      <div 
                        onClick={(e) => handleShowRoute(e, item)}
                        className="p-1.5 bg-blue-900 rounded shadow text-white group-hover:bg-white group-hover:text-blue-900 md:hidden group-hover:block transition-all"
                        title="Show Route"
                      >
                        <Route size={14} />
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-[10px] text-center py-6 font-bold text-black opacity-30 uppercase tracking-widest">No buildings found nearby</p>
              )
            ) : (
              <p className="text-[10px] text-center py-6 font-bold text-blue-900 uppercase tracking-widest animate-pulse">Syncing GPS location...</p>
            )}
          </div>
        </section>

        {/* アチーブメント */}
        <section className="bg-white shadow-xl rounded-xl p-6 shrink-0 mb-4">
          <button 
            onClick={() => setIsAchievementOpen(!isAchievementOpen)}
            className="w-full flex items-center justify-between border-b border-gray-100 pb-2 mb-4 group"
          >
            <div className="flex items-center gap-2">
              <Trophy className="text-blue-900" size={18} />
              <h2 className="text-sm font-bold text-blue-900 uppercase text-left">Achievements</h2>
              <span className="ml-2 text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded-full">
                {visitedTitles.length}
              </span>
            </div>
            {isAchievementOpen ? <ChevronUp size={18} className="text-gray-400 group-hover:text-blue-900" /> : <ChevronDown size={18} className="text-gray-400 group-hover:text-blue-900" />}
          </button>

          <div className="mb-2">
            <div className="flex justify-between text-[10px] mb-1 font-bold text-black opacity-60">
              <span>Collection Progress</span>
              <span>{Math.round((visitedTitles.length / (initData.length || 1)) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-900 h-full transition-all duration-1000 ease-out" 
                style={{ width: `${(visitedTitles.length / (initData.length || 1)) * 100}%` }}
              ></div>
            </div>
          </div>

          {isAchievementOpen && (
            <div className="mt-4 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
              {visitedTitles.length > 0 ? (
                visitedTitles.map((title, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-black">
                    <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-white shrink-0">
                      <Trophy size={12} />
                    </div>
                    <div className="text-[10px] font-bold text-black line-clamp-1">{title}</div>
                  </div>
                )).reverse()
              ) : (
                <p className="text-[10px] text-center text-gray-400 py-4 italic text-black">No achievements yet</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
