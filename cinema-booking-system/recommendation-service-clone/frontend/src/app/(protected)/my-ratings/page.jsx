import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import { getMyRatingsPage } from "@/api/userRatingService";

function StarInline({ rating }) {
  const score = Number.isFinite(Number(rating)) ? Math.max(0, Math.min(5, Number(rating))) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(0, Math.min(1, score - (star - 1)));
          const widthPercent = `${fill * 100}%`;
          return (
            <span key={star} className="relative inline-block text-sm leading-none">
              <span className="text-white/25">★</span>
              <span
                className="absolute inset-y-0 left-0 overflow-hidden text-[#ffe700]"
                style={{ width: widthPercent }}
              >
                ★
              </span>
            </span>
          );
        })}
      </div>
      <span className="text-[12px] text-white/70">{score}/5</span>
    </div>
  );
}

export default function MyRatingsPage() {
  const [pageData, setPageData] = useState({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchPage = async () => {
      setLoading(true);
      try {
        const p = await getMyRatingsPage(0, 50);
        if (mounted) setPageData(p);
      } catch (e) {
        console.error(e);
        if (mounted) setError("Không thể tải danh sách đánh giá của bạn.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchPage();
    return () => (mounted = false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050024] via-[#0b0630] to-[#020015] text-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Phim bạn đã đánh giá</h1>
        {loading ? (
          <p className="text-white/70">Đang tải...</p>
        ) : error ? (
          <p className="text-[#ff9aa2]">{error}</p>
        ) : pageData.items.length === 0 ? (
          <p className="text-white/70">Bạn chưa đánh giá phim nào.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pageData.items.map((r) => (
              <article
                key={r.ratingId || r.movieId}
                className="flex gap-4 items-center rounded-xl p-3 bg-white/[0.03] border border-white/10 cursor-pointer"
                onClick={() => r.movieId && navigate(`/movie/${r.movieId}`)}
              >
                <div className="w-[90px] h-[130px] rounded-lg overflow-hidden bg-[#0b0a26] border border-white/10">
                  <img
                    src={r.posterUrl || "/movies/placeholder-poster.jpg"}
                    alt={r.movieTitle}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{r.movieTitle || "Không rõ tên"}</h3>
                  <div className="mt-2 flex items-center gap-4">
                    <StarInline rating={r.ratingValue} />
                    <div className="text-sm text-white/60">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
