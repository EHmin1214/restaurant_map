// src/App.js
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import RestaurantPanel from "./components/RestaurantPanel";
import "./App.css";

const API_BASE = "https://restaurantmap-production.up.railway.app";

export const ACCOUNT_COLORS = [
  "#E8593C", "#3B8BD4", "#1D9E75", "#BA7517",
  "#7F77DD", "#D4537E", "#0F6E56", "#993C1D",
];

export function getAccountColor(accountId, accounts) {
  const index = accounts.findIndex((a) => a.id === accountId);
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length] || "#888";
}

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(new Set());

  // Personal 맛집 — DB에서 불러옴
  const [personalPlaces, setPersonalPlaces] = useState([]);
  const [showPersonal, setShowPersonal] = useState(true);

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // 계정 목록 로드
  useEffect(() => {
    axios.get(`${API_BASE}/accounts/`).then((res) => setAccounts(res.data));
  }, []);

  // Personal 맛집 로드
  useEffect(() => {
    axios.get(`${API_BASE}/personal-places/`).then((res) => setPersonalPlaces(res.data));
  }, []);

  // 선택된 계정 바뀔 때마다 맛집 로드
  useEffect(() => {
    const params = selectedAccountIds.map((id) => `account_ids=${id}`).join("&");
    const url = `${API_BASE}/restaurants/${params ? "?" + params : ""}`;
    axios.get(url).then((res) => setRestaurants(res.data));
  }, [selectedAccountIds]);

  const toggleAccount = (id) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleMarkerClick = useCallback(async (restaurantId, isPersonal = false) => {
    if (isPersonal) {
      const place = personalPlaces.find((p) => `personal_${p.id}` === restaurantId);
      if (place) setSelectedRestaurant({ ...place, sources: [], isPersonal: true });
      if (window.innerWidth <= 768) setSidebarOpen(false);
      return;
    }
    const res = await axios.get(`${API_BASE}/restaurants/${restaurantId}`);
    setSelectedRestaurant(res.data);
    if (window.innerWidth <= 768) setSidebarOpen(false);
  }, [personalPlaces]);

  const hideRestaurant = useCallback((restaurantId, isPersonal = false) => {
    if (isPersonal) {
      // Personal 맛집은 숨기기 대신 삭제
      const place = personalPlaces.find((p) => `personal_${p.id}` === restaurantId || p.id === restaurantId);
      if (place) {
        axios.delete(`${API_BASE}/personal-places/${place.id}`).then(() => {
          setPersonalPlaces((prev) => prev.filter((p) => p.id !== place.id));
        });
      }
    } else {
      setHiddenIds((prev) => new Set([...prev, restaurantId]));
    }
    setSelectedRestaurant(null);
  }, [personalPlaces]);

  // 검색 결과를 Personal 맛집으로 저장
  const addPersonalPlace = useCallback(async (place) => {
    try {
      const res = await axios.post(`${API_BASE}/personal-places/`, {
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        category: place.category,
        naver_place_url: place.naver_place_url,
      });
      setPersonalPlaces((prev) => {
        const exists = prev.find((p) => p.id === res.data.id);
        if (exists) return prev;
        return [...prev, res.data];
      });
      if (window.innerWidth <= 768) setSidebarOpen(false);
    } catch (e) {
      console.error("Personal 맛집 저장 실패", e);
    }
  }, []);

  const deletePersonalPlace = useCallback(async (placeId) => {
    await axios.delete(`${API_BASE}/personal-places/${placeId}`);
    setPersonalPlaces((prev) => prev.filter((p) => p.id !== placeId));
  }, []);

  const visibleRestaurants = restaurants.filter((r) => !hiddenIds.has(r.id));
  const sidebarWidth = sidebarOpen ? 280 : 0;

  return (
    <div className="app">
      {/* 사이드바 토글 버튼 */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: "fixed",
          top: 16,
          left: sidebarOpen ? 290 : 16,
          zIndex: 30,
          width: 36, height: 36,
          borderRadius: "50%",
          background: "white",
          border: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          cursor: "pointer",
          fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "left 0.3s ease",
        }}
      >
        {sidebarOpen ? "◀" : "☰"}
      </button>

      {/* 사이드바 */}
      <div style={{
        width: sidebarOpen ? 280 : 0,
        overflow: "hidden",
        transition: "width 0.3s ease",
        flexShrink: 0,
      }}>
        <Sidebar
          accounts={accounts}
          setAccounts={setAccounts}
          selectedAccountIds={selectedAccountIds}
          onToggleAccount={toggleAccount}
          onAccountAdded={(acc) => setAccounts((prev) => [...prev, acc])}
          apiBase={API_BASE}
          onAddPersonalPlace={addPersonalPlace}
          personalPlaces={personalPlaces}
          showPersonal={showPersonal}
          setShowPersonal={setShowPersonal}
          onDeletePersonalPlace={deletePersonalPlace}
        />
      </div>

      <MapView
        restaurants={visibleRestaurants}
        personalPlaces={showPersonal ? personalPlaces : []}
        accounts={accounts}
        onMarkerClick={handleMarkerClick}
      />

      {selectedRestaurant && (
        <RestaurantPanel
          restaurant={selectedRestaurant}
          accounts={accounts}
          onClose={() => setSelectedRestaurant(null)}
          onHide={hideRestaurant}
          apiBase={API_BASE}
          sidebarWidth={sidebarWidth}
        />
      )}
    </div>
  );
}
