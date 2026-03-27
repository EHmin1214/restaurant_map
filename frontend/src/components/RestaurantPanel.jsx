// src/components/RestaurantPanel.jsx
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { getAccountColor } from "../App";

export default function RestaurantPanel({ restaurant, accounts, onClose, onHide, apiBase }) {
  const r = restaurant;
  const [adResult, setAdResult] = useState(null);
  const [adLoading, setAdLoading] = useState(false);

  const checkAds = useCallback(async () => {
    setAdLoading(true);
    try {
      const res = await axios.post(`${apiBase}/ad-check/`, {
        restaurant_name: r.name,
        address_hint: r.address ? r.address.split(" ").slice(0, 2).join(" ") : null,
      });
      setAdResult(res.data);
    } catch (e) {
      console.error("광고 분석 실패", e);
    } finally {
      setAdLoading(false);
    }
  }, [r, apiBase]); // eslint-disable-line react-hooks/exhaustive-deps

  // 패널 열리면 자동으로 광고 분석 실행
  useEffect(() => {
    if (!r) return;
    setAdResult(null);
    checkAds();
  }, [r?.id, checkAds]); // eslint-disable-line react-hooks/exhaustive-deps

  const verdictInfo = adResult ? {
    clean:     { label: "✅ 광고 적음", color: "#1D9E75", bg: "#E1F5EE" },
    suspicious:{ label: "⚠️ 광고 의심", color: "#BA7517", bg: "#FAEEDA" },
    heavy_ad:  { label: "🚨 광고 많음", color: "#993C1D", bg: "#FAECE7" },
  }[adResult.verdict] : null;

  const isSearchResult = r.isSearchResult || false;

  return (
    <div style={{
      position: "absolute",
      bottom: 0, left: 280, right: 0,
      background: "white",
      borderRadius: "16px 16px 0 0",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.12)",
      padding: "20px 24px",
      zIndex: 20,
      maxHeight: "50vh",
      overflowY: "auto",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          {isSearchResult && (
            <span style={{
              fontSize: 10, background: "#444", color: "white",
              padding: "2px 6px", borderRadius: 4, marginBottom: 4,
              display: "inline-block",
            }}>검색 결과</span>
          )}
          <p style={{ margin: "4px 0 4px", fontSize: 11, color: "#E8593C", fontWeight: 600 }}>
            {r.category || "맛집"}
          </p>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1a1a1a" }}>
            {r.name}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            📍 {r.address || "주소 정보 없음"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {/* 지도에서 숨기기 */}
          <button
            onClick={() => onHide(r.id, isSearchResult)}
            title="지도에서 숨기기"
            style={{
              background: "#f5f5f5", border: "none", borderRadius: "50%",
              width: 32, height: 32, cursor: "pointer", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#888",
            }}
          >🗑</button>

          {/* 닫기 */}
          <button
            onClick={onClose}
            style={{
              background: "#f5f5f5", border: "none", borderRadius: "50%",
              width: 32, height: 32, cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>
      </div>

      {/* 네이버 지도 버튼 */}
      {r.naver_place_url && (
        <a href={r.naver_place_url} target="_blank" rel="noreferrer" style={{
          display: "inline-block", marginBottom: 16,
          padding: "7px 14px", background: "#03C75A",
          color: "white", borderRadius: 8, fontSize: 12,
          fontWeight: 600, textDecoration: "none",
        }}>
          네이버 지도에서 보기
        </a>
      )}

      {/* 광고 분석 결과 — 자동 실행 */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px", fontWeight: 600 }}>
          광고 분석
        </p>

        {adLoading && (
          <div style={{
            background: "#f5f5f5", borderRadius: 12,
            padding: "14px 16px", fontSize: 13, color: "#888",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            블로그 100개 분석 중... (잠시 기다려주세요)
          </div>
        )}

        {!adLoading && adResult && verdictInfo && (
          <div style={{
            background: verdictInfo.bg, borderRadius: 12,
            padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: verdictInfo.color }}>
                {verdictInfo.label}
              </span>
              <span style={{ fontSize: 12, color: verdictInfo.color }}>
                블로그 {adResult.total_posts}개 분석
                {adResult.cached && (
                  <span style={{ fontSize: 10, color: "#aaa", marginLeft: 6 }}>
                    ({adResult.checked_at} 기준)
                  </span>
                )}
              </span>
            </div>

            {/* 비율 바 */}
            <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              {adResult.ad_count > 0 && (
                <div style={{ flex: adResult.ad_count, background: "#E24B4A" }} />
              )}
              {adResult.suspicious_count > 0 && (
                <div style={{ flex: adResult.suspicious_count, background: "#EF9F27" }} />
              )}
              {adResult.genuine_count > 0 && (
                <div style={{ flex: adResult.genuine_count, background: "#1D9E75" }} />
              )}
            </div>

            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#555" }}>
              <span>🔴 광고 {adResult.ad_count}개</span>
              <span>🟡 의심 {adResult.suspicious_count}개</span>
              <span>🟢 순수 {adResult.genuine_count}개</span>
            </div>

            {/* 광고/의심 게시물 목록 */}
            {adResult.posts.filter(p => p.is_ad || p.is_suspicious).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#555", margin: "0 0 6px" }}>
                  광고/의심 게시물
                </p>
                {adResult.posts
                  .filter(p => p.is_ad || p.is_suspicious)
                  .slice(0, 5)
                  .map((p, i) => (
                    <a key={i} href={p.post_url} target="_blank" rel="noreferrer" style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 8px", marginBottom: 4,
                      background: "rgba(255,255,255,0.7)", borderRadius: 8,
                      textDecoration: "none",
                    }}>
                      <span style={{ fontSize: 12 }}>{p.is_ad ? "🔴" : "🟡"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontSize: 11, color: "#333",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{p.post_title}</p>
                        {p.matched_keywords.length > 0 && (
                          <p style={{ margin: 0, fontSize: 10, color: "#888" }}>
                            키워드: {p.matched_keywords.join(", ")}
                          </p>
                        )}
                      </div>
                    </a>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 소개한 블로거 목록 */}
      {r.sources && r.sources.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px", fontWeight: 600 }}>
            소개한 블로거 ({r.sources.length})
          </p>
          {r.sources.map((s, i) => {
            const acc = accounts.find(a => a.author_id === s.author_id);
            const color = acc ? getAccountColor(acc.id, accounts) : "#888";
            return (
              <a key={i} href={s.post_url} target="_blank" rel="noreferrer" style={{
                display: "flex", alignItems: "center",
                padding: "10px 12px", marginBottom: 6,
                background: "#fafafa", borderRadius: 10,
                textDecoration: "none", border: "1px solid #f0f0f0",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: color, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, marginRight: 10, flexShrink: 0,
                }}>
                  {(s.author_name || "?")[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>
                    {s.author_name || s.author_id}
                  </p>
                  <p style={{
                    margin: 0, fontSize: 11, color: "#888",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {s.post_title}
                  </p>
                </div>
                <span style={{ fontSize: 16, color: "#ccc" }}>›</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
