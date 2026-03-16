'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';
import { ArchitectureInit, UserLocation, MapCommand } from '../types';

// アイコン設定
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const HighlightIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const UserIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [1, -34],
  shadowSize: [32, 32]
});

L.Marker.prototype.options.icon = DefaultIcon;

function MapController({ 
  userLocation, 
  command,
  routePoints
}: { 
  userLocation: UserLocation | null, 
  command: MapCommand | null,
  routePoints: [number, number][] | null
}) {
  const map = useMap();

  // 中心座標の計算 (targetZoom を指定できるように変更)
  const getOffsetCenter = useCallback((lat: number, lng: number, targetZoom?: number) => {
    if (isNaN(lat) || isNaN(lng)) return null;
    
    const zoom = targetZoom || map.getZoom();
    // 目標地点のピクセル座標
    const pixelPoint = map.project([lat, lng], zoom);
    
    const isPC = window.innerWidth >= 768;
    
    if (isPC) {
      const offsetInPixels = map.getSize().x / 6; 
      const targetPixelCenter = pixelPoint.subtract([offsetInPixels, 0]);
      return map.unproject(targetPixelCenter, zoom);
    } else {
      return L.latLng(lat, lng);
    }
  }, [map]);

  // userLocation の変化による useEffect (自動 setView) は完全に削除しました。
  // 地図の移動は以下の command による useEffect のみが担当します。

  useEffect(() => {
    if (!command) return;

    if (command.type === 'FLY_TO') {
      const { lat, lng, zoom } = command.payload;
      const targetZoom = zoom || 17;
      // 移動先のズームレベルを使ってオフセットを再計算
      const offsetCenter = getOffsetCenter(lat, lng, targetZoom);
      if (offsetCenter) map.flyTo(offsetCenter, targetZoom);
    } 
    else if (command.type === 'SHOW_ROUTE' && routePoints && routePoints.length > 0) {
      const bounds = L.latLngBounds(routePoints);
      const isPC = window.innerWidth >= 768;
      const padding: [number, number] = [50, 50];
      const paddingTopLeft: [number, number] = isPC ? [50, map.getSize().x / 3 + 50] : [50, 50];
      map.fitBounds(bounds, { padding, paddingTopLeft });
    }
    else if (command.type === 'FIT_BOUNDS') {
      const locs = command.payload.filter((l: [number, number]) => !isNaN(l[0]) && !isNaN(l[1]));
      if (locs.length > 0) {
        const bounds = L.latLngBounds(locs);
        const isPC = window.innerWidth >= 768;
        const padding: [number, number] = [80, 80];
        const paddingTopLeft: [number, number] = isPC ? [80, map.getSize().x / 3 + 80] : [80, 80];
        map.flyToBounds(bounds, { padding, paddingTopLeft, duration: 1.5 });
      }
    }
    else if (command.type === 'RESET_VIEW' && userLocation) {
      const targetZoom = 13;
      const offsetCenter = getOffsetCenter(userLocation.lat, userLocation.lng, targetZoom);
      if (offsetCenter) map.flyTo(offsetCenter, targetZoom);
    }
  }, [command, routePoints, map, getOffsetCenter, userLocation]);

  return null;
}

interface MapProps {
  onSelectArchitecture: (title: string) => void;
  userLocation: UserLocation | null;
  setUserLocation: (loc: UserLocation) => void;
  radius: number;
  command: MapCommand | null;
  highlightTitle: string | null;
  displayData: ArchitectureInit[];
}

const Map = ({ onSelectArchitecture, userLocation, setUserLocation, radius, command, highlightTitle, displayData }: MapProps) => {
  const [route, setRoute] = useState<[number, number][] | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      }, (err) => console.error(err), { enableHighAccuracy: true });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [setUserLocation]);

  useEffect(() => {
    if (command?.type === 'SHOW_ROUTE' && userLocation) {
      const to = command.payload.to;
      if (isNaN(to.lat) || isNaN(to.lng)) return;

      const url = `https://router.project-osrm.org/route/v1/walking/${userLocation.lng},${userLocation.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const coordinates = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
            setRoute(coordinates);
          } else {
            setRoute([[userLocation.lat, userLocation.lng], [to.lat, to.lng]]);
          }
        })
        .catch(() => {
          setRoute([[userLocation.lat, userLocation.lng], [to.lat, to.lng]]);
        });
    } else if (command?.type === 'FLY_TO' || command?.type === 'FIT_BOUNDS' || command?.type === 'RESET_VIEW') {
      setRoute(null);
    }
  }, [command, userLocation]);

  return (
    <div className="h-full w-full">
      <MapContainer 
        center={[51.5074, -0.1278]} 
        zoom={13} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <MapController userLocation={userLocation} command={command} routePoints={route} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {userLocation && (
          <Circle 
            center={[userLocation.lat, userLocation.lng]} 
            radius={radius * 1000} 
            pathOptions={{ fillColor: '#1e3a8a', fillOpacity: 0.05, color: '#1e3a8a', weight: 1, dashArray: '5, 10' }} 
          />
        )}

        {route && (
          <Polyline 
            positions={route} 
            pathOptions={{ color: '#1e3a8a', weight: 5, opacity: 0.8 }} 
          />
        )}

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={UserIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {displayData.map((arch, idx) => {
          const lat = parseFloat(arch.location[0]);
          const lng = parseFloat(arch.location[1]);
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker 
              key={idx} 
              position={[lat, lng]}
              icon={arch.title === highlightTitle ? HighlightIcon : DefaultIcon}
              eventHandlers={{ click: () => onSelectArchitecture(arch.title) }}
              zIndexOffset={arch.title === highlightTitle ? 1000 : 0}
            >
              <Popup>
                <div className="text-xs font-bold text-black">{arch.title}</div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default Map;
