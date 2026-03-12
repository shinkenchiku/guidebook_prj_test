'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState, useMemo } from 'react';
import { ArchitectureInit, ArchitectureMain, UserLocation, MapCommand } from '../types';
import { MapPin, Trophy, Info, ExternalLink, Navigation, Route, Crosshair, ChevronDown, ChevronUp, X } from 'lucide-react';

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

  // マウント状態の管理（Hydrationエラー対策）
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // データの読み込み
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [init, main] = await Promise.all([
          fetch('/data/init.json').then(res => res.json()),
          fetch('/data/main.json').then(res => res.json())
        ]);
        setInitData(init);
        setMainData(main);

        const saved = localStorage.getItem('visited_architectures');
        if (saved) {
          setVisitedTitles(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Data fetch error:", e);
      }
    };
    
    fetchData();
  }, []);

  // 建築物が選択された時の処理
  const handleSelectArchitecture = (title: string, zoom = true) => {
    const detail = mainData.find(item => item.title === title);
    const initInfo = initData.find(item => item.title === title);
    
    if (detail) {
      setSelectedArch(detail);
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
      <div className="relative w-full md:absolute md:top-0 md:left-0 md:h-full md:w-1/3 z-10 p-4 pointer-events-none flex flex-col gap-4 md:overflow-y-auto no-scrollbar md:bg-gradient-to-r md:from-white/20 md:to-transparent">
        
        <header className="hidden md:block bg-white shadow-xl rounded-xl p-6 pointer-events-auto border-t-4 border-blue-900">
          <h1 className="text-2xl font-bold tracking-tight text-blue-900">ARCHI-GUIDE</h1>
          <p className="text-[10px] font-bold text-black uppercase tracking-wider mt-1">Digital Guidebook v1.0</p>
        </header>

        {(selectedArch || window.innerWidth >= 768) && (
          <section id="arch-info" className={`bg-white shadow-xl rounded-xl p-6 pointer-events-auto min-h-[140px] transition-all duration-300 ${!selectedArch && 'hidden md:block'}`}>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
              <Info className="text-blue-900" size={18} />
              <h2 className="text-sm font-bold text-blue-900 uppercase">Architecture Info</h2>
            </div>

            {selectedArch ? (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-left-2">
                <div className="flex justify-between items-start gap-2 text-black">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-blue-900 leading-snug">{selectedArch.title}</h3>
                    <p className="text-black text-xs font-bold mt-1 opacity-80">{selectedArch.architect}</p>
                  </div>
                  <button 
                    onClick={() => handleShowRoute(null, selectedArch)}
                    className="p-2.5 bg-blue-900 rounded-lg text-white hover:bg-black transition-all shadow-md shrink-0"
                    title="ここへのルートを表示"
                  >
                    <Route size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] text-black">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-blue-900 font-bold mb-1 opacity-60">Completion</div>
                    <div className="text-black font-bold">{selectedArch.completion || '-'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-blue-900 font-bold mb-1 opacity-60">Building Use</div>
                    <div className="text-black font-bold line-clamp-1">
                      {Array.isArray(selectedArch.builduse) 
                        ? (selectedArch.builduse.length > 0 ? selectedArch.builduse.join(', ') : '-') 
                        : (selectedArch.builduse || '-')}
                    </div>
                  </div>
                  <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-blue-900 font-bold mb-1 opacity-60">Region</div>
                    <div className="text-black font-bold">{selectedArch.region || '-'}</div>
                  </div>
                  <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-blue-900 font-bold mb-1 opacity-60">Address</div>
                    <div className="text-black font-bold leading-tight">{selectedArch.address}</div>
                  </div>
                </div>

                {selectedArch.memo && (
                  <div className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 text-black leading-relaxed italic">
                    {selectedArch.memo}
                  </div>
                )}

                {selectedArch.tags && selectedArch.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                    {selectedArch.tags.map((tag, i) => tag && (
                      <button 
                        key={i} 
                        onClick={() => handleTagClick(tag)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${selectedTag === tag ? 'bg-blue-900 text-white' : 'bg-gray-100 text-black hover:bg-blue-100 hover:text-blue-900'}`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {selectedArch.link && (
                  <a 
                    href={selectedArch.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 bg-blue-900 text-white rounded-lg font-bold hover:bg-black transition-all text-xs shadow-md"
                  >
                    <ExternalLink size={14} /> MORE INFORMATION
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
        <section className="bg-white shadow-xl rounded-xl p-6 pointer-events-auto flex flex-col gap-4">
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
          
          <div className="flex flex-col gap-2 max-h-[400px] md:max-h-[250px] overflow-y-auto pr-1 no-scrollbar text-black">
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
        <section className="bg-white shadow-xl rounded-xl p-6 pointer-events-auto">
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
            <div className="mt-4 flex flex-col gap-2 max-h-[200px] overflow-y-auto no-scrollbar animate-in slide-in-from-top-2 duration-300">
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
