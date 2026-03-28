// src/components/Sidebar.jsx
import { useState } from "react";
import axios from "axios";
import { getAccountColor } from "../App";

export default function Sidebar({
  accounts, setAccounts,
  selectedAccountIds, onToggleAccount, onAccountAdded,
  apiBase, onAddPersonalPlace,
  personalPlaces, showPersonal, setShowPersonal, onDeletePersonalPlace,
}) {
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [crawling, setCrawling] = useState(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const searchPlace = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${apiBase}/search-place/`, {
        params: { name: searchQuery.trim() },
      });
      if (res.data) {
        await onAddPersonalPlace(res.data);
        setMessage(`'${res.data.name}' 저장됨!`);
        setSearchQuery("");
      } else {
        setMessage("가게를 찾을 수 없어요");
      }
    } catch (e) {
      setMessage("검색 실패");
    } finally {
      setSearching(false);
      setTimeout(() => setMessage(""), 2500);
    }
  };

  const addAccount = async () => {
    if (!newId.trim()) return;
    try {
      const res = await axios.post(`${apiBase}/accounts/`, {
        source: "naver_blog",
        author_id: newId.trim(),
        author_name: newName.trim() || newId.trim(),
      });
      onAccountAdded(res.data);
      setNewId(""); setNewName("");
      setMessage("계정 추가 완료!");
      setTimeout(() => setMessage(""), 2000);
    } catch (e) {
      setMessage("추가 실패");
    }
  };

  const crawlAccount = async (accountId) => {
    setCrawling(accountId);
    setMessage("크롤링 중...");
    try {
      const res = await axios.post(`${apiBase}/crawl/${accountId}?max_posts=30`);
      setMessage(res.data.message);
    } catch (e) {
      setMessage("크롤링 실패");
    } finally {
      setCrawling(null);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const deleteAccount = async (accountId, authorName) => {
    if (!window.confirm(`'${authorName}' 블로거를 삭제할까요?`)) return;
    try {
      await axios.delete(`${apiBase}/accounts/${accountId}`);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setMessage("삭제 완료!");
      setTimeout(() => setMessage(""), 2000);
    } catch (e) {
      setMessage("삭제 실패");
    }
  };

  return (
    <div style={{
      width: 280, height: "100vh", background: "white",
      boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
      display: "flex", flexDirection: "column",
      zIndex: 10, position: "relative", overflowY: "auto",
    }}>
      {/* 헤더 */}
      <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #f0f0f0" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
          🍽 맛집 지도
        </h1>
      </div>

      {/* 가게 검색 */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>가게 검색</p>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPlace()}
            placeholder="가게명 검색"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={searchPlace}
            disabled={searching}
            style={{
              padding: "7px 12px",
              background: searching ? "#f5f5f5" : "#1a1a1a",
              color: searching ? "#888" : "white",
              border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 600,
              cursor: searching ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {searching ? "..." : "검색"}
          </button>
        </div>
        {message && (
          <p style={{ fontSize: 12, color: "#E8593C", margin: "6px 0 0" }}>{message}</p>
        )}
      </div>

      {/* Personal 맛집 섹션 */}
      <div style={{ borderBottom: "1px solid #f0f0f0" }}>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px", cursor: "pointer",
          }}
          onClick={() => setShowPersonal(!showPersonal)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#555", flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>
              Personal
            </span>
            <span style={{ fontSize: 11, color: "#888" }}>({personalPlaces.length})</span>
          </div>
          <span style={{ fontSize: 11, color: "#aaa" }}>{showPersonal ? "▲" : "▼"}</span>
        </div>

        {showPersonal && (
          <div style={{ paddingBottom: 8 }}>
            {personalPlaces.length === 0 && (
              <p style={{ fontSize: 12, color: "#bbb", padding: "0 16px 8px" }}>
                가게를 검색해서 추가해보세요
              </p>
            )}
            {personalPlaces.map((place) => (
              <div
                key={place.id}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "6px 16px", gap: 8,
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#555", flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 12, fontWeight: 600, color: "#1a1a1a",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {place.name}
                  </p>
                  {place.address && (
                    <p style={{
                      margin: 0, fontSize: 10, color: "#888",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {place.address}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDeletePersonalPlace(place.id)}
                  style={{
                    fontSize: 11, padding: "3px 8px",
                    border: "1px solid #ddd", borderRadius: 6,
                    background: "white", color: "#888",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 블로거 추가 */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>블로거 추가</p>
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addAccount()}
          placeholder="블로거 ID"
          style={inputStyle}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addAccount()}
          placeholder="닉네임 (선택)"
          style={{ ...inputStyle, marginTop: 6 }}
        />
        <button onClick={addAccount} style={buttonStyle}>추가</button>
      </div>

      {/* 등록된 블로거 목록 */}
      <div style={{ flex: 1, padding: "8px 0" }}>
        <p style={{ fontSize: 12, color: "#888", padding: "4px 16px 8px" }}>
          등록된 블로거 ({accounts.length})
        </p>
        {accounts.length === 0 && (
          <p style={{ fontSize: 13, color: "#bbb", padding: "0 16px" }}>
            블로거를 추가해보세요
          </p>
        )}
        {accounts.map((acc) => {
          const color = getAccountColor(acc.id, accounts);
          const isSelected = selectedAccountIds.includes(acc.id);
          return (
            <div
              key={acc.id}
              style={{
                display: "flex", alignItems: "center",
                padding: "8px 16px",
                background: isSelected ? `${color}12` : "white",
                borderLeft: `3px solid ${isSelected ? color : "transparent"}`,
                cursor: "pointer", gap: 8,
              }}
              onClick={() => onToggleAccount(acc.id)}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4,
                border: `1.5px solid ${isSelected ? color : "#ddd"}`,
                background: isSelected ? color : "white",
                flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isSelected && <span style={{ color: "white", fontSize: 10 }}>✓</span>}
              </div>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: color, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1a1a",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {acc.author_name}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#888" }}>
                  @{acc.author_id} · 맛집 {acc.post_count}개
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); crawlAccount(acc.id); }}
                disabled={crawling === acc.id}
                style={{
                  fontSize: 11, padding: "3px 8px",
                  border: `1px solid ${color}`, borderRadius: 6,
                  background: "white", color: color,
                  cursor: crawling === acc.id ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
              >
                {crawling === acc.id ? "⏳" : "수집"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id, acc.author_name); }}
                style={{
                  fontSize: 11, padding: "3px 8px",
                  border: "1px solid #ddd", borderRadius: 6,
                  background: "white", color: "#888",
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                삭제
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "7px 10px",
  border: "1px solid #e0e0e0", borderRadius: 8,
  fontSize: 13, boxSizing: "border-box", outline: "none",
};

const buttonStyle = {
  width: "100%", marginTop: 8, padding: "8px",
  background: "#E8593C", color: "white",
  border: "none", borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
