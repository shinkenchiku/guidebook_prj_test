'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { ArchitectureInit, ArchitectureMain, UserLocation, MapCommand } from '../types';
import { MapPin, Trophy, Info, ExternalLink, Navigation, Route, Crosshair, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

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

  // モバイル向けUI管理用のステート
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState(false);
  const [activeMobileMenu, setActiveMobileMenu] = useState<'nearby' | 'achievements' | null>(null);

  // 接近通知用のステート
  const [approachingArch, setApproachingArch] = useState<ArchitectureInit | null>(null);

  // マウント状態の管理
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // データの読み込み
  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchJson = async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Fetch failed: ${url}`);
          return res.json();
        };

        const [init, main, photos] = await Promise.all([
          fetchJson('/data/init.json').catch(() => []),
          fetchJson('/data/main.json').catch(() => []),
          fetchJson('/data/photo.json').catch(() => [])
        ]);

        const mergedMain = main.map((item: ArchitectureMain) => {
          const photoData = Array.isArray(photos) ? photos.find((p: any) => p.title === item.title) : null;
          return {
            ...item,
            images: photoData?.url?.length > 0 ? photoData.url : (item.image ? [item.image] : [])
          };
        });

        setInitData(init);
        setMainData(mergedMain);

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

  // 画像切り替え
  const nextImage = useCallback(() => {
    if (!selectedArch?.images || selectedArch.images.length <= 1) return;
    setCurrentImgIdx(prev => (prev + 1) % selectedArch.images!.length);
  }, [selectedArch]);

  const prevImage = useCallback(() => {
    if (!selectedArch?.images || selectedArch.images.length <= 1) return;
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

  // UI排他制御
  const toggleMobileMenu = (menu: 'nearby' | 'achievements' | null) => {
    if (menu) {
      setActiveMobileMenu(menu);
      setSelectedArch(null);
      setIsMobilePanelExpanded(false);
    } else {
      setActiveMobileMenu(null);
    }
  };

  const handleSelectArchitecture = (title: string, zoom = true) => {
    const detail = mainData.find(item => item.title === title);
    const initInfo = initData.find(item => item.title === title);
    
    if (detail) {
      setSelectedArch(detail);
      setCurrentImgIdx(0);
      setRouteDestTitle(null); 
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsMobilePanelExpanded(false);
        setActiveMobileMenu(null);
      }
      if (zoom && initInfo?.location?.[0]) {
        setMapCommand({ 
          type: 'FLY_TO', 
          payload: { lat: parseFloat(initInfo.location[0]), lng: parseFloat(initInfo.location[1]), zoom: 17 } 
        });
      }
    }
  };

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
      setMapCommand({ type: 'RESET_VIEW', payload: null });
    } else {
      setSelectedTag(tag);
      const filteredTitles = mainData.filter(item => item.tags?.includes(tag)).map(item => item.title);
      const filteredLocs = initData
        .filter(item => filteredTitles.includes(item.title) && item.location?.[0])
        .map(item => [parseFloat(item.location[0]), parseFloat(item.location[1])] as [number, number]);
      if (filteredLocs.length > 0) setMapCommand({ type: 'FIT_BOUNDS', payload: filteredLocs });
    }
  };

  const handleShowRoute = (e: React.MouseEvent | null, item: ArchitectureInit | ArchitectureMain) => {
    if (e) e.stopPropagation();
    if (!userLocation) return;
    const init = initData.find(i => i.title === item.title);
    if (!init?.location?.[0]) return;
    setRouteDestTitle(item.title);
    setMapCommand({ type: 'SHOW_ROUTE', payload: { to: { lat: parseFloat(init.location[0]), lng: parseFloat(init.location[1]) } } });
  };

  const handleCenterUser = () => {
    if (userLocation) {
      setMapCommand({ type: 'FLY_TO', payload: { lat: userLocation.lat, lng: userLocation.lng, zoom: 17 } });
    }
  };

  const displayArchitectures = useMemo(() => {
    if (!selectedTag) return initData;
    const filteredTitles = mainData.filter(item => item.tags?.includes(selectedTag)).map(item => item.title);
    return initData.filter(item => filteredTitles.includes(item.title));
  }, [initData, mainData, selectedTag]);

  const suggestions = useMemo(() => {
    if (!userLocation) return [];
    return initData
      .map(item => ({ ...item, distance: calculateDistance(userLocation.lat, userLocation.lng, parseFloat(item.location[0]), parseFloat(item.location[1])) }))
      .filter(item => item.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 15);
  }, [userLocation, initData, radius]);

  // 接近判定
  useEffect(() => {
    if (!userLocation || initData.length === 0) return;
    const nearby = initData.find(item => {
      if (visitedTitles.includes(item.title)) return false;
      return calculateDistance(userLocation.lat, userLocation.lng, parseFloat(item.location[0]), parseFloat(item.location[1])) < 0.005;
    });
    if (nearby) {
      if (approachingArch?.title !== nearby.title) setApproachingArch(nearby);
    } else if (approachingArch) {
      setApproachingArch(null);
    }
  }, [userLocation, initData, visitedTitles, approachingArch]);

  const handleConfirmVisit = (title: string) => {
    const newVisited = [...visitedTitles, title];
    setVisitedTitles(newVisited);
    localStorage.setItem('visited_architectures', JSON.stringify(newVisited));
    setApproachingArch(null);
    toggleMobileMenu('achievements');
  };

  // タッチ制御
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.targetTouches[0].clientY;
    if (diff > 50 && !isMobilePanelExpanded) { setIsMobilePanelExpanded(true); setTouchStart(null); }
    else if (diff < -50 && isMobilePanelExpanded) { setIsMobilePanelExpanded(false); setTouchStart(null); }
  };

  if (!isMounted) return null;

  return (
    <main className="relative w-full h-screen overflow-hidden bg-gray-50 font-sans text-black">
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-gray-100">読み込み中...</div>}>
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
      </div>

      {/* 接近通知ポップアップ */}
      {approachingArch && (
        <div className="absolute top-6 left-4 right-4 z-[2000] animate-in slide-in-from-top duration-500 pointer-events-auto">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-green-500 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0"><MapPin size={20} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-green-600 uppercase mb-0.5">Arrived!</p>
              <h3 className="text-sm font-bold text-black truncate">{approachingArch.title}</h3>
            </div>
            <button onClick={() => handleConfirmVisit(approachingArch.title)} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg active:scale-95">VISIT</button>
            <button onClick={() => setApproachingArch(null)} className="text-gray-300 p-1"><X size={18} /></button>
          </div>
        </div>
      )}

      {/* 左上メニューボタン */}
      <div className="md:hidden absolute top-4 left-4 z-[1100] flex flex-col gap-2">
        <button onClick={() => toggleMobileMenu(activeMobileMenu === 'nearby' ? null : 'nearby')} className={`p-3 rounded-full shadow-2xl border flex items-center justify-center ${activeMobileMenu === 'nearby' ? 'bg-blue-900 text-white' : 'bg-white text-blue-900'}`}><Navigation size={20} /></button>
        <button onClick={() => toggleMobileMenu(activeMobileMenu === 'achievements' ? null : 'achievements')} className={`p-3 rounded-full shadow-2xl border relative flex items-center justify-center ${activeMobileMenu === 'achievements' ? 'bg-blue-900 text-white' : 'bg-white text-blue-900'}`}><Trophy size={20} />{visitedTitles.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white">{visitedTitles.length}</span>}</button>
      </div>

      {/* スライドメニュー */}
      <div className={`md:hidden absolute inset-0 z-[1200] flex transition-all duration-300 ${activeMobileMenu ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${activeMobileMenu ? 'opacity-100' : 'opacity-0'}`} onClick={() => toggleMobileMenu(null)}></div>
        <div className={`relative w-[85%] h-full bg-white shadow-2xl p-6 overflow-y-auto flex flex-col gap-6 transition-transform duration-300 transform ${activeMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              {activeMobileMenu === 'nearby' ? <Navigation className="text-blue-900" size={20} /> : <Trophy className="text-blue-900" size={20} />}
              <h2 className="text-lg font-bold text-blue-900 uppercase">{activeMobileMenu === 'nearby' ? 'Nearby' : 'Achievements'}</h2>
            </div>
            <button onClick={() => toggleMobileMenu(null)} className="p-2 text-gray-400"><X size={24} /></button>
          </div>
          {activeMobileMenu === 'nearby' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl"><span className="text-xs font-bold text-blue-900">Radius</span><select className="text-xs font-bold border-2 border-blue-900 rounded-full px-3 py-1" value={radius} onChange={(e) => setRadius(Number(e.target.value))}><option value={0.5}>500m</option><option value={1}>1km</option><option value={2}>2km</option><option value={5}>5km</option></select></div>
              <div className="flex flex-col gap-2">{suggestions.map((item, idx) => (<button key={idx} onClick={() => handleSelectArchitecture(item.title, true)} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border text-left active:bg-blue-100"><div className="flex-1 min-w-0 pr-2"><div className="font-bold text-sm truncate">{item.title}</div><div className="text-[11px] opacity-60 truncate">{item.architect}</div></div><div className="text-xs font-black text-blue-900">{item.distance < 1 ? `${(item.distance * 1000).toFixed(0)}m` : `${item.distance.toFixed(1)}km`}</div></button>))}</div>
            </div>
          )}
          {activeMobileMenu === 'achievements' && (
            <div className="flex flex-col gap-4">
              <div className="bg-blue-50 p-4 rounded-xl"><div className="flex justify-between text-[11px] mb-2 font-black text-blue-900"><span>Progress</span><span>{Math.round((visitedTitles.length / (initData.length || 1)) * 100)}%</span></div><div className="w-full bg-white h-2 rounded-full overflow-hidden"><div className="bg-blue-900 h-full transition-all duration-1000" style={{ width: `${(visitedTitles.length / (initData.length || 1)) * 100}%` }}></div></div></div>
              <div className="flex flex-col gap-2">{visitedTitles.map((title, i) => (<div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border"><div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-white shrink-0"><Trophy size={14} /></div><div className="text-xs font-bold truncate">{title}</div></div>)).reverse()}</div>
            </div>
          )}
        </div>
      </div>

      {/* プルアップタブ */}
      {selectedArch && !activeMobileMenu && (
        <div 
          className={`md:hidden absolute left-0 right-0 bottom-0 z-[1300] bg-white shadow-2xl rounded-t-[32px] transition-all duration-500 ease-out flex flex-col ${isMobilePanelExpanded ? 'h-[85%]' : 'h-[20vh]'}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setTouchStart(null)}
        >
          <div className="w-full h-12 flex flex-col items-center justify-center shrink-0" onClick={() => setIsMobilePanelExpanded(!isMobilePanelExpanded)}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-1"></div>
            <div className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-1">
              {isMobilePanelExpanded ? <><ChevronDown size={14} /> CLOSE</> : <><ChevronUp size={14} /> TAP FOR DETAILS</>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-10">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex-1 min-w-0"><h3 className="text-xl font-black text-blue-900 leading-tight mb-1">{selectedArch.title}</h3><p className="text-black text-xs font-bold opacity-70">{selectedArch.architect}</p></div>
              <div className="flex gap-2 shrink-0"><button onClick={() => handleShowRoute(null, selectedArch)} className="p-3 bg-blue-900 rounded-2xl text-white shadow-lg active:scale-95"><Route size={20} /></button><button onClick={() => setSelectedArch(null)} className="p-3 bg-gray-100 rounded-2xl text-gray-400 active:scale-95"><X size={20} /></button></div>
            </div>
            <div className={`transition-opacity duration-300 flex flex-col gap-6 ${isMobilePanelExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
              <div className="w-full aspect-video bg-gray-100 rounded-2xl overflow-hidden relative group shadow-inner">
                <img src={(selectedArch.images && selectedArch.images.length > 0) ? selectedArch.images[currentImgIdx] : '/img/noimage.jpg'} alt={selectedArch.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/img/noimage.jpg'; }} />
                {selectedArch.images && selectedArch.images.length > 1 && (
                  <><button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full"><ChevronLeft size={24} /></button><button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full"><ChevronRight size={24} /></button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">{selectedArch.images.map((_, i) => (<div key={i} className={`w-2 h-2 rounded-full transition-all ${i === currentImgIdx ? 'bg-white scale-125' : 'bg-white/40'}`} />))}</div></>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100"><div className="text-blue-900 font-black text-[10px] uppercase mb-1 opacity-50">Completion</div><div className="text-black font-bold text-sm">{selectedArch.completion || '-'}</div></div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100"><div className="text-blue-900 font-black text-[10px] uppercase mb-1 opacity-50">Building Use</div><div className="text-black font-bold text-sm truncate">{Array.isArray(selectedArch.builduse) ? selectedArch.builduse.join(', ') : (selectedArch.builduse || '-')}</div></div>
                <div className="col-span-2 bg-gray-50 p-4 rounded-2xl border border-gray-100"><div className="text-blue-900 font-black text-[10px] uppercase mb-1 opacity-50">Address</div><div className="text-black font-bold text-sm leading-snug">{selectedArch.address}</div></div>
              </div>
              {selectedArch.memo && <div className="text-sm bg-blue-50/50 p-4 rounded-2xl border border-blue-100 text-black leading-relaxed italic">{selectedArch.memo}</div>}
              <div className="flex flex-wrap gap-2">{selectedArch.tags?.map((tag, i) => tag && (<button key={i} onClick={() => { handleTagClick(tag); setIsMobilePanelExpanded(false); }} className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${selectedTag === tag ? 'bg-blue-900 text-white' : 'bg-gray-100 text-black'}`}>#{tag}</button>))}</div>
              {selectedArch.link && <a href={selectedArch.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 py-4 bg-blue-900 text-white rounded-2xl font-black text-sm shadow-xl mt-2 active:scale-[0.98]"> <ExternalLink size={18} /> VISIT OFFICIAL WEBSITE </a>}
            </div>
          </div>
        </div>
      )}

      {/* デスクトップ専用UI */}
      <div className="hidden md:flex relative w-[30%] h-full z-10 p-4 pointer-events-none flex-col gap-4 overflow-y-auto custom-scrollbar bg-white/5 backdrop-blur-[2px]">
        <div className="pointer-events-auto flex flex-col gap-4">
          <header className="bg-white shadow-xl rounded-xl p-6 border-t-4 border-blue-900 shrink-0"><h1 className="text-2xl font-bold tracking-tight text-blue-900">ARCHI-GUIDE</h1><p className="text-[10px] font-bold text-black uppercase tracking-wider mt-1">Digital Guidebook v1.0</p></header>
          {selectedArch ? (
            <section className="bg-white shadow-xl rounded-xl p-4 shrink-0">
              <div className="flex items-center gap-2 mb-3 border-b pb-2"><Info className="text-blue-900" size={18} /><h2 className="text-sm font-bold text-blue-900 uppercase">Architecture Info</h2></div>
              <div className="flex flex-col gap-3">
                <div className="w-full aspect-[21/9] bg-gray-100 rounded-lg overflow-hidden border relative group">
                  <img src={(selectedArch.images && selectedArch.images.length > 0) ? selectedArch.images[currentImgIdx] : '/img/noimage.jpg'} alt={selectedArch.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/img/noimage.jpg'; }} />
                  {selectedArch.images && selectedArch.images.length > 1 && (<><button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/30 text-white rounded-full opacity-0 group-hover:opacity-100"><ChevronLeft size={20} /></button><button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/30 text-white rounded-full opacity-0 group-hover:opacity-100"><ChevronRight size={20} /></button></>)}
                </div>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1"><h3 className="text-lg font-bold text-blue-900 leading-tight">{selectedArch.title}</h3><p className="text-black text-[10px] font-bold mt-0.5 opacity-80">{selectedArch.architect}</p></div>
                  <button onClick={() => handleShowRoute(null, selectedArch)} className="p-2 bg-blue-900 rounded-lg text-white hover:bg-black"><Route size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-gray-50 p-2 rounded-lg border"><div className="text-blue-900 font-bold mb-0.5 opacity-60">Completion</div><div className="text-black font-bold">{selectedArch.completion || '-'}</div></div>
                  <div className="bg-gray-50 p-2 rounded-lg border"><div className="text-blue-900 font-bold mb-0.5 opacity-60">Building Use</div><div className="text-black font-bold truncate">{Array.isArray(selectedArch.builduse) ? selectedArch.builduse.join(', ') : (selectedArch.builduse || '-')}</div></div>
                  <div className="col-span-2 bg-gray-50 p-2 rounded-lg border"><div className="text-blue-900 font-bold mb-0.5 opacity-60">Address</div><div className="text-black font-bold leading-tight">{selectedArch.address}</div></div>
                </div>
                {selectedArch.memo && <div className="text-[11px] bg-gray-50 p-2 rounded-lg border text-black italic line-clamp-3">{selectedArch.memo}</div>}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t">{selectedArch.tags?.map((tag, i) => tag && (<button key={i} onClick={() => handleTagClick(tag)} className={`px-2 py-0.5 rounded-full text-[9px] font-black ${selectedTag === tag ? 'bg-blue-900 text-white' : 'bg-gray-100'}`}>#{tag}</button>))}</div>
                {selectedArch.link && <a href={selectedArch.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2.5 bg-blue-900 text-white rounded-lg font-bold text-[10px]"> <ExternalLink size={12} /> MORE INFORMATION </a>}
              </div>
            </section>
          ) : (
            <section className="bg-white shadow-xl rounded-xl p-10 flex flex-col items-center justify-center opacity-30"><MapPin size={32} className="text-blue-900" /><p className="text-[10px] font-bold mt-2 uppercase text-center">Select a pin</p></section>
          )}
          <section className="bg-white shadow-xl rounded-xl p-6 flex flex-col gap-4 shrink-0">
            <div className="flex items-center justify-between border-b pb-2"><div className="flex items-center gap-2"><Navigation className="text-blue-900" size={18} /><h2 className="text-sm font-bold text-blue-900 uppercase">Nearby</h2></div><select className="text-[10px] font-bold border-2 border-blue-900 rounded-full px-3 py-1" value={radius} onChange={(e) => setRadius(Number(e.target.value))}><option value={0.5}>500m</option><option value={1}>1km</option><option value={2}>2km</option><option value={5}>5km</option></select></div>
            <div className="flex flex-col gap-2">{suggestions.map((item, idx) => (<button key={idx} onClick={() => handleSelectArchitecture(item.title, true)} className="group flex items-center justify-between p-3 bg-white hover:bg-blue-900 rounded-lg border transition-all shadow-sm"><div className="flex-1 min-w-0 pr-2"><div className="font-bold text-[11px] truncate group-hover:text-white">{item.title}</div><div className="text-[9px] font-bold truncate opacity-60 group-hover:text-blue-100">{item.architect}</div></div><div className="text-[10px] font-bold text-blue-900 group-hover:text-white">{item.distance < 1 ? `${(item.distance * 1000).toFixed(0)}m` : `${item.distance.toFixed(1)}km`}</div></button>))}</div>
          </section>
          <section className="bg-white shadow-xl rounded-xl p-6 shrink-0 mb-4">
            <button onClick={() => setIsAchievementOpen(!isAchievementOpen)} className="w-full flex items-center justify-between border-b pb-2 mb-4 group"><div className="flex items-center gap-2"><Trophy className="text-blue-900" size={18} /><h2 className="text-sm font-bold text-blue-900 uppercase">Achievements</h2><span className="ml-2 text-[11px] font-bold px-2 py-0.5 bg-blue-100 rounded-full">{visitedTitles.length}</span></div>{isAchievementOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
            <div className="mb-2"><div className="flex justify-between text-[10px] mb-1 font-bold opacity-60"><span>Progress</span><span>{Math.round((visitedTitles.length / (initData.length || 1)) * 100)}%</span></div><div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-900 h-full transition-all duration-1000" style={{ width: `${(visitedTitles.length / (initData.length || 1)) * 100}%` }}></div></div></div>
            {isAchievementOpen && (<div className="mt-4 flex flex-col gap-2">{visitedTitles.map((title, i) => (<div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border"><div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-white shrink-0"><Trophy size={12} /></div><div className="text-[10px] font-bold truncate">{title}</div></div>)).reverse()}</div>)}
          </section>
        </div>
      </div>

      {/* 現在地ボタン */}
      <div className={`absolute right-6 md:right-10 md:bottom-10 z-[1000] pointer-events-auto transition-all duration-500 ease-out ${selectedArch && !activeMobileMenu ? (isMobilePanelExpanded ? 'bottom-[88vh]' : 'bottom-[23vh]') : 'bottom-6'}`}>
        <button onClick={handleCenterUser} className="p-4 bg-white shadow-2xl rounded-full text-blue-900 hover:bg-blue-900 hover:text-white transition-all border active:scale-90 flex items-center justify-center"><Crosshair size={28} /></button>
      </div>

      {/* タグフィルター */}
      {selectedTag && (<div className="absolute top-4 right-4 md:top-10 md:right-32 z-[1000] pointer-events-auto"><button onClick={() => setSelectedTag(null)} className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-full shadow-xl font-bold text-xs hover:bg-black transition-colors">#{selectedTag} フィルター中 <X size={14} /></button></div>)}
    </main>
  );
}
