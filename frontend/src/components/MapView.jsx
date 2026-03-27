// src/components/MapView.jsx
import { useEffect, useRef, useState } from "react";
import { getAccountColor } from "../App";

export default function MapView({ restaurants, searchMarkers = [], accounts, onMarkerClick }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const searchMarkersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const hasFitBounds = useRef(false);

  // 지도 초기화 (최초 1회)
  useEffect(() => {
    const checkNaver = setInterval(() => {
      if (window.naver && window.naver.maps) {
        clearInterval(checkNaver);
        mapInstance.current = new window.naver.maps.Map(mapRef.current, {
          center: new window.naver.maps.LatLng(37.5665, 126.978),
          zoom: 13,
        });
        setMapReady(true);
      }
    }, 100);
    return () => clearInterval(checkNaver);
  }, []);

  // 블로거 맛집 마커 업데이트
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (restaurants.length === 0) {
      hasFitBounds.current = false;
    }

    restaurants.forEach((r) => {
      const mentions = r.account_mentions || [];
      const primaryAccountId = mentions.length > 0 ? mentions[0].account_id : null;
      const color = primaryAccountId ? getAccountColor(primaryAccountId, accounts) : "#888";
      const hasMultiMention = mentions.some((m) => m.mention_count >= 2);
      const isMultiAccount = mentions.length >= 2;

      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(r.lat, r.lng),
        map: mapInstance.current,
        title: r.name,
        icon: {
          content: `
            <div style="
              background:${color};color:white;padding:4px 8px;
              border-radius:12px;font-size:12px;font-weight:600;
              white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);
              cursor:pointer;
              border:${isMultiAccount ? "2px solid white" : "none"};
              outline:${isMultiAccount ? `2px solid ${color}` : "none"};
            ">${r.name}${hasMultiMention ? " ✶" : ""}</div>
          `,
          anchor: new window.naver.maps.Point(0, 0),
        },
      });

      window.naver.maps.Event.addListener(marker, "click", () => {
        const panelHeight = window.innerHeight * 0.25;
        const projection = mapInstance.current.getProjection();
        const point = projection.fromCoordToOffset(
          new window.naver.maps.LatLng(r.lat, r.lng)
        );
        const adjustedPoint = new window.naver.maps.Point(
          point.x,
          point.y + panelHeight
        );
        const adjustedCoord = projection.fromOffsetToCoord(adjustedPoint);
        mapInstance.current.panTo(adjustedCoord);
        onMarkerClick(r.id, false);
      });

      markersRef.current.push(marker);
    });

    if (restaurants.length > 0 && !hasFitBounds.current) {
      const bounds = new window.naver.maps.LatLngBounds();
      restaurants.forEach((r) =>
        bounds.extend(new window.naver.maps.LatLng(r.lat, r.lng))
      );
      mapInstance.current.fitBounds(bounds, { padding: 60 });
      hasFitBounds.current = true;
    }
  }, [restaurants, accounts, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 검색 결과 마커 업데이트
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    searchMarkersRef.current.forEach((m) => m.setMap(null));
    searchMarkersRef.current = [];

    searchMarkers.forEach((r) => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(r.lat, r.lng),
        map: mapInstance.current,
        title: r.name,
        icon: {
          content: `
            <div style="
              background:#444;color:white;padding:4px 8px;
              border-radius:12px;font-size:12px;font-weight:600;
              white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);
              cursor:pointer;border:2px dashed white;
            ">🔍 ${r.name}</div>
          `,
          anchor: new window.naver.maps.Point(0, 0),
        },
      });

      window.naver.maps.Event.addListener(marker, "click", () => {
        const panelHeight = window.innerHeight * 0.25;
        const projection = mapInstance.current.getProjection();
        const point = projection.fromCoordToOffset(
          new window.naver.maps.LatLng(r.lat, r.lng)
        );
        const adjustedPoint = new window.naver.maps.Point(
          point.x,
          point.y + panelHeight
        );
        const adjustedCoord = projection.fromOffsetToCoord(adjustedPoint);
        mapInstance.current.panTo(adjustedCoord);
        onMarkerClick(r.id, true);
      });

      searchMarkersRef.current.push(marker);
    });
  }, [searchMarkers, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ flex: 1, height: "100vh", position: "relative" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      {!mapReady && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#f5f5f5", fontSize: 14, color: "#888",
        }}>
          지도 로딩 중...
        </div>
      )}
      {/* 범례 */}
      {(accounts.length > 0 || searchMarkers.length > 0) && (
        <div style={{
          position: "absolute", bottom: 24, right: 16,
          background: "white", borderRadius: 12,
          padding: "10px 14px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          fontSize: 12,
        }}>
          {accounts.map((acc) => (
            <div key={acc.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{
                width: 12, height: 12, borderRadius: "50%",
                background: getAccountColor(acc.id, accounts), flexShrink: 0,
              }} />
              <span style={{ color: "#333" }}>{acc.author_name}</span>
            </div>
          ))}
          {searchMarkers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{
                width: 12, height: 12, borderRadius: "50%",
                background: "#444", flexShrink: 0,
              }} />
              <span style={{ color: "#333" }}>검색 결과</span>
            </div>
          )}
          <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 6, paddingTop: 6, color: "#888" }}>
            ✶ 여러 글에서 언급
          </div>
        </div>
      )}
    </div>
  );
}
