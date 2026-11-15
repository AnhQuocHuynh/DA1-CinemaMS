// src/app/(public)/home/page.jsx

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

import Navbar from "@/components/common/Navbar";
import MovieCarousel from "@/components/movies/MovieCarousel";
import { getShowingMovies, getUpcomingMovies } from "@/api/movieService";
import { getTopKRecommendations } from "@/api/recommendationService";
import Footer from "@/components/common/Footer";
import MembershipHighlight from "@/components/membership/MembershipHighlight";
import ContactSection from "@/components/contact/ContactSection";
import PromoHighlight from "@/components/promotions/PromoHighlight";

// ✅ unwrap đúng dạng response: { code, message, data }
function unwrapMovies(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

// ✅ "mới thêm" = sort theo createdAt/created_at (KHÔNG dùng updatedAt)
function sortMoviesByCreatedDesc(list) {
  const toTime = (x) => {
    const v =
      x?.createdAt ||
      x?.created_at ||
      x?.createdDate ||
      x?.created_date ||
      x?.created; // fallback hiếm
    const t = v ? new Date(v).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  };

  return [...list].sort((a, b) => {
    const diff = toTime(b) - toTime(a);
    if (diff !== 0) return diff;

    // tie-breaker ổn định nếu createdAt trùng nhau
    const ida = String(a?.movieId || a?.id || "");
    const idb = String(b?.movieId || b?.id || "");
    return idb.localeCompare(ida); // desc
  });
}

function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function clampRating(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(5, Math.round(num * 100) / 100));
}

function confidenceToneClass(confidence) {
  if (confidence > 90) return "text-emerald-400";
  if (confidence < 80) return "text-amber-400";
  return "text-cyan-300";
}

function confidenceToneColor(confidence) {
  if (confidence > 90) return "#34d399";
  if (confidence < 80) return "#f59e0b";
  return "#22d3ee";
}

function MatchRing({ percentage, compact = false, ringColor = "#43e1ff", valueClass = "text-[#43e1ff]" }) {
  const p = clampPercent(percentage);
  const size = 50;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (p / 100) * circumference;

  return (
    <div
      className={`relative flex items-center justify-center ${
        compact ? "h-7 w-7" : "h-[50px] w-[50px]"
      }`}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={`${compact ? "h-7 w-7" : "h-[50px] w-[50px]"} -rotate-90`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <span className={`${compact ? "text-[8px]" : "text-[10px]"} absolute font-extrabold ${valueClass}`}>
        {p}%
      </span>
    </div>
  );
}

function StarRating({ rating }) {
  const score = clampRating(rating);

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
      <span className="text-[11px] text-white/70">{score}/5</span>
    </div>
  );
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [showingMovies, setShowingMovies] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [topKMovies, setTopKMovies] = useState([]);
  const [loadingTopK, setLoadingTopK] = useState(false);
  const [topKError, setTopKError] = useState("");

  const [activeMembership, setActiveMembership] = useState(null);

  const membershipRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [showingRes, upcomingRes] = await Promise.all([
          getShowingMovies(),
          getUpcomingMovies(),
        ]);

        const showingArr = unwrapMovies(showingRes);
        const upcomingArr = unwrapMovies(upcomingRes);

        setShowingMovies(sortMoviesByCreatedDesc(showingArr));
        setUpcomingMovies(sortMoviesByCreatedDesc(upcomingArr));

        // DEBUG nếu vẫn thấy "chưa đảo"
        // console.table(
        //   sortMoviesByCreatedDesc(showingArr).map((x) => ({
        //     title: x.title,
        //     createdAt: x.createdAt || x.created_at,
        //     updatedAt: x.updatedAt || x.updated_at,
        //   }))
        // );
      } catch (e) {
        console.error("HomePage fetch movies error:", e);
        setShowingMovies([]);
        setUpcomingMovies([]);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchTopK = async () => {
      if (!isAuthenticated) {
        if (mounted) {
          setTopKMovies([]);
          setTopKError("");
          setLoadingTopK(false);
        }
        return;
      }

      setLoadingTopK(true);
      try {
        const list = await getTopKRecommendations(5);
        if (mounted) {
          setTopKMovies(Array.isArray(list) ? list : []);
          setTopKError("");
        }
      } catch (err) {
        if (mounted) {
          setTopKMovies([]);
          setTopKError(err?.message || "Không thể tải danh sách đề xuất.");
        }
      } finally {
        if (mounted) setLoadingTopK(false);
      }
    };

    fetchTopK();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const scrollInto = (ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  function smoothScrollToTop() {
    animate(window.scrollY, 0, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => window.scrollTo(0, latest),
    });
  }

  const handleSelectMembership = (id) => {
    setActiveMembership(id);
    setTimeout(() => scrollInto(membershipRef), 0);
  };

  const handleBackMembership = () => {
    setActiveMembership(null);
    scrollInto(membershipRef);
  };

  return (
    <div className=" min-h-screen bg-gradient-to-b from-[#050024] via-[#0b0630] to-[#020015] text-white relative overflow-hidden ">
      {" "}
      <div className="pointer-events-none absolute inset-0">
        <div
          className=" absolute left-1/2 top-[6%] -translate-x-1/2 -translate-y-1/2 w-[220vw] h-[95vh]
 md:w-[115vw] md:h-[80vh] bg-[radial-gradient(ellipse_at_center,#7b5cff9a,transparent_45%)] blur-[110px] opacity-100 "
        />{" "}
        <div className=" absolute left-1/2 top-[6%] -translate-x-1/2 -translate-y-1/2 w-[165vw] h-[95vh] md:w-[115vw] md:h-[80vh] bg-[radial-gradient(ellipse_at_center,#7b5cff9a,transparent_45%)] blur-[110px] opacity-100 " />{" "}
        <div className=" absolute left-1/2 top-[8%] -translate-x-1/2 -translate-y-1/2 w-[130vw] h-[85vh] md:w-[105vw] md:h-[70vh] bg-[radial-gradient(ellipse_at_center,#ff7af64d,transparent_55%)] blur-[135px] opacity-80 " />{" "}
      </div>{" "}
      <div className=" absolute left-1/2 top-[12%] -translate-x-1/2 -translate-y-1/2 w-[165vw] h-[95vh] md:w-[115vw] md:h-[80vh] bg-[radial-gradient(ellipse_at_center,#7b5cff9a,transparent_45%)] blur-[110px] opacity-100 " />{" "}
      <div className=" absolute left-1/2 top-[12%] -translate-x-1/2 -translate-y-1/2 w-[130vw] h-[85vh] md:w-[105vw] md:h-[70vh] bg-[radial-gradient(ellipse_at_center,#ff7af64d,transparent_55%)] blur-[135px] opacity-80 " />{" "}
      <div className="pointer-events-none absolute inset-0">
        {" "}
        <div className=" absolute left-1/2 top-[16%] -translate-x-1/2 -translate-y-1/2 w-[380vw] h-[95vh] md:w-[115vw] md:h-[80vh] bg-[radial-gradient(ellipse_at_center,#7b5cff9a,transparent_45%)] blur-[110px] opacity-100 " />{" "}
        <div className=" absolute left-1/2 top-[18%] -translate-x-1/2 -translate-y-1/2 w-[130vw] h-[85vh] md:w-[105vw] md:h-[70vh] bg-[radial-gradient(ellipse_at_center,#ff7af64d,transparent_55%)] blur-[135px] opacity-80 " />{" "}
      </div>{" "}
      <div className=" absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 w-[165vw] h-[95vh] md:w-[115vw] md:h-[80vh] bg-[radial-gradient(ellipse_at_center,#7b5cff9a,transparent_45%)] blur-[110px] opacity-100 " />{" "}
      <div className=" absolute left-1/2 top-[24%] -translate-x-1/2 -translate-y-1/2 w-[130vw] h-[85vh] md:w-[105vw] md:h-[70vh] bg-[radial-gradient(ellipse_at_center,#ff7af64d,transparent_55%)] blur-[135px] opacity-80 " />{" "}
      <div className=" absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[165vw] h-[90vh] md:w-[110vw] md:h-[75vh] bg-[radial-gradient(ellipse_at_center,#43e1ff66,transparent_50%)] blur-[120px] opacity-90 " />{" "}
      <div className=" absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 w-[165vw] h-[95vh] md:w-[115vw] md:h-[80vh] bg-[radial-gradient(ellipse_at_center,#7b5cff9a,transparent_45%)] blur-[110px] opacity-100 " />{" "}
      <div className=" absolute left-1/2 top-[32%] -translate-x-1/2 -translate-y-1/2 w-[130vw] h-[85vh] md:w-[105vw] md:h-[70vh] bg-[radial-gradient(ellipse_at_center,#ff7af64d,transparent_55%)] blur-[135px] opacity-80 " />
      {/* đến đây */}
      <Navbar />
      {/* MAIN */}
      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto px-4 pt-10 md:pt-12">
          <div className="rounded-3xl border border-white/12 bg-[#0b0a26]/75 backdrop-blur-xl p-4 md:p-6 shadow-[0_22px_60px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg md:text-xl font-extrabold tracking-[0.18em] uppercase bg-gradient-to-r from-[#43e1ff] via-[#7b5cff] to-[#ff7af6] bg-clip-text text-transparent">
                Top phim dành cho bạn
              </h2>
              <div className="flex items-center gap-2">
                {isAuthenticated ? (
                  <button
                    onClick={() => navigate("/my-ratings")}
                    className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
                  >
                    Phim tôi đã đánh giá
                  </button>
                ) : null}
                {!isAuthenticated ? (
                <button
                  onClick={() => navigate("/login")}
                  className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
                >
                  Đăng nhập
                </button>
                ) : null}
              </div>
            </div>

            {!isAuthenticated ? (
              <p className="text-sm text-white/70">
                Đăng nhập để xem bảng gợi ý phim cá nhân hóa theo lịch sử đánh giá.
              </p>
            ) : loadingTopK ? (
              <p className="text-sm text-white/70">Đang tải đề xuất dành cho bạn...</p>
            ) : topKError ? (
              <p className="text-sm text-[#ff9aa2]">{topKError}</p>
            ) : topKMovies.length === 0 ? (
              <p className="text-sm text-white/70">
                Chưa có đủ dữ liệu để gợi ý. Hãy đánh giá vài bộ phim để hệ thống học sở thích của bạn.
              </p>
            ) : (
              <div className="space-y-3">
                {topKMovies.map((item, idx) => {
                  const predictedRating = clampRating(item.predictedRating || 0);
                  const uncertaintyScore = clampPercent(item.uncertaintyScore || 0);
                  const confidence = clampPercent(100 - uncertaintyScore);
                  const confidenceClass = confidenceToneClass(confidence);
                  const confidenceColor = confidenceToneColor(confidence);
                  const matchPercentage = clampPercent(predictedRating * 20);

                  return (
                    <article
                      key={item.movieId || `${item.title}-${idx}`}
                      className="group rounded-3xl border border-white/60 bg-white/[0.04] hover:bg-white/[0.08] transition-all p-3 md:p-4 cursor-pointer"
                      onClick={() => item.movieId && navigate(`/movie/${item.movieId}`)}
                    >
                      <div className="grid grid-cols-[110px_1fr] md:grid-cols-[120px_1fr] gap-4 md:gap-5 items-stretch">
                        <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-[#0b0a26] shadow-[0_0_18px_rgba(123,92,255,0.42)]">
                          <img
                            src={item.posterUrl || "/movies/placeholder-poster.jpg"}
                            alt={item.title || "Movie poster"}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-[#ffe700] text-black text-[10px] font-extrabold shadow-[0_0_10px_rgba(255,231,0,0.4)]">
                            #{idx + 1}
                          </div>
                        </div>

                        <div className="min-w-0 flex flex-col justify-between py-1">
                          <div>
                            <h3 className="text-2xl md:text-[34px] leading-tight font-extrabold text-white line-clamp-2 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                              {item.title || "Không rõ tên phim"}
                            </h3>

                            <div className="mt-3 flex flex-wrap items-center gap-2.5">

                              <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border font-semibold text-[12px] ${
                                confidence > 90
                                  ? "bg-emerald-400/15 border-emerald-400/45 text-emerald-300"
                                  : confidence < 80
                                  ? "bg-amber-400/15 border-amber-400/45 text-amber-300"
                                  : "bg-cyan-400/15 border-cyan-400/45 text-cyan-300"
                              }`}>
                                Độ tin cậy:
                                <MatchRing
                                  percentage={confidence}
                                  compact
                                  ringColor={confidenceColor}
                                  valueClass={confidenceClass}
                                />
                              </span>

                              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#ffe7001f] text-[#ffe700] border border-[#ffe70055] font-semibold text-[12px]">
                                Dự đoán:
                                <StarRating rating={predictedRating} />
                              </span>

                              {item.nearestMovieTitle ? (
                                <span className="w-full block text-sm text-white/70 mt-2">
                                  Vì bạn đã đánh giá{' '}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (item.nearestMovieId) navigate(`/movie/${item.nearestMovieId}`);
                                    }}
                                    className="underline font-semibold text-white hover:text-[#ffe700]"
                                  >
                                    {item.nearestMovieTitle}
                                  </button>
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.movieId) navigate(`/movie/${item.movieId}`);
                              }}
                              className="px-4 py-2 rounded-xl text-[12px] font-semibold border border-white/25 bg-white/10 hover:bg-white/20 transition-all"
                            >
                              Xem chi tiết
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.movieId) navigate(`/movie/${item.movieId}`);
                              }}
                              className="px-4 py-2 rounded-xl text-[12px] font-bold bg-gradient-to-r from-[#43e1ff] via-[#7b5cff] to-[#ff7af6] text-white shadow-[0_0_14px_rgba(123,92,255,0.75)] hover:brightness-110 transition-all"
                            >
                              Đặt vé ngay
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ✅ PHIM ĐANG CHIẾU: đã sort sẵn trong state */}
        <div className="mt-8">
          <MovieCarousel
            title="PHIM ĐANG CHIẾU"
            movies={showingMovies}
            onShowAll={() => {
              smoothScrollToTop();
              navigate("/movie/moviesShowing");
            }}
            titleClass="bg-gradient-to-r from-[#43e1ff] via-[#7b5cff] to-[#ff7af6] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(123,92,255,0.7)]"
          />
        </div>

        {/* ✅ PHIM SẮP CHIẾU */}
        <div className="mt-1">
          <MovieCarousel
            title="PHIM SẮP CHIẾU"
            movies={upcomingMovies}
            onShowAll={() => {
              smoothScrollToTop();
              navigate("/movie/moviesUpComming");
            }}
            titleClass="bg-gradient-to-r from-[#ff7af6] via-[#7b5cff] to-[#43e1ff] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,122,246,0.7)]"
          />
        </div>

        {/* KHUYẾN MÃI */}
        <div className="mt-14">
          <PromoHighlight />
        </div>

        {/* MEMBERSHIP  */}
        <div className="mt-16">
          <MembershipHighlight
            onSelect={(id) => {
              smoothScrollToTop();
              navigate(`/membership?type=${id}`);
            }}
          />
        </div>

        {/* LIÊN HỆ */}
        <div className="mt-16">
          <ContactSection />
        </div>
      </main>
      {/* FOOTER */}
      <Footer />
    </div>
  );
}
