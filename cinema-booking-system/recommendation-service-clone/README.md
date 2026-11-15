# Recommendation service — bản trích để tích hợp

Bản này là hồ sơ tham chiếu, copy từ project `SE400_MovieBookingUncertaintyScore` vào ngày 2026-10-25. Project gốc không bị sửa. Folder này không build và không chạy một mình: một số class dùng chung vẫn trỏ sang domain đặt vé (`User`, `Showtime`, `MovieService`).

Nguồn gốc:

`D:\UNI_DOCS\HK6\Seminar CNPM\SE400_MovieBookingUncertaintyScore`

## Ba luồng, không phải một API

Người dùng nhớ một service “lọc theo sở thích rồi lấy top-k neighbor”. Trong code, đó là ba luồng tách nhau.

1. **Tìm phim theo bộ lọc.** Ô tìm trên navbar gửi từ khóa tới `/movie/search?q=...`. Trang kết quả có hai dropdown: trạng thái (`SHOWING` / `UPCOMING`) và thể loại. Cả hai gọi API catalog (`/movies/search/title`, `/movies/filter/status`, `/movies/filter/genre`). Luồng này không đụng uncertainty score.
2. **Admin mass import IMDb.** Form trên trang quản trị phim chọn một hoặc nhiều thể loại, rồi gọi `POST /movies/bulk-import`. Backend lấy danh sách title từ `https://api.imdbapi.dev` theo thể loại và lát năm, sau đó upsert vào bảng `movies`.
3. **Gợi ý theo uncertainty và nearest neighbor.** `MovieRecommendationService` chỉ nhận `userId` và `k`. Sở thích là các dòng trong `user_ratings`. Service không nhận genre, status, hay bộ lọc từ form tìm kiếm.

Đặt vé, thanh toán, ghế, suất chiếu nằm ngoài bản trích này. `MovieController`, `Movie.java`, `Navbar.jsx`, trang chi tiết phim và trang admin phim được copy vì có endpoint hoặc UI của ba luồng trên, nhưng phần lớn nội dung các file đó là CRUD và booking.

```text
Đánh giá sao (trang chi tiết phim)
        |
        v
user_ratings  ----->  nearest neighbor (dissimilarity thấp nhất)
                              |
                              v
                    uncertainty + điểm dự đoán
                              |
                              v
                    top-k phim SHOWING chưa xem

IMDb API --bulk import--> bảng movies --cùng catalog--> cả gợi ý và form lọc

Form lọc (navbar + /movie/search) --> chỉ đọc catalog, không vào thuật toán
```

## Thuật toán

File: `backend/src/main/java/com/api/moviebooking/services/MovieRecommendationService.java`
Độ lệch: `MovieDissimilarityCalculator.java`
Ngưỡng toàn cục: `AlgorithmScheduledTasks.java`

### Độ lệch giữa hai phim

Độ lệch số là khoảng cách Euclid của `duration`, `releaseYear`, `imdbRating` (null được tính là 0):

```text
sqrt( (d1-d2)^2 + (y1-y2)^2 + (r1-r2)^2 )
```

Độ lệch hạng mục, với từng field `genre`, `language`, `region` (chuỗi CSV, so khớp không phân biệt hoa thường):

```text
max(|A|, |B|) - |A ∩ B|
```

Tổng độ lệch = độ lệch số + tổng ba độ lệch hạng mục.

### Uncertainty

Job tính độ lệch lớn nhất giữa mọi cặp phim trong catalog và lưu vào `system_config` với key `MAX_MOVIE_DISSIMILARITY`.

- Chạy lúc app sẵn sàng nếu chưa có config, hoặc config cũ hơn 7 ngày.
- Cron: 03:00 thứ Hai hàng tuần (`0 0 3 * * MON`).
- Admin gọi tay: `POST /recommendations/max-dissimilarity/recalculate`.
- Catalog dưới 2 phim thì fallback `1.0`.
- Quét cặp là O(n²).

```text
uncertaintyScore = clamp( minDissimilarity / maxDissimilarity * 100 , 0 , 100 )
```

`UNCERTAINTY_THRESHOLD` đọc từ `system_config`, mặc định `12` nếu thiếu hoặc không parse được số. `MAX_MOVIE_DISSIMILARITY` mặc định `1000` khi giá trị lưu <= 0 hoặc thiếu.

### Điểm dự đoán

Với mỗi phim ứng viên, service duyệt mọi rating của user và giữ phim lịch sử có tổng độ lệch nhỏ nhất. Đó là nearest neighbor. Không có bước lọc top-k neighbor: chỉ giữ **một** neighbor gần nhất.

- Điểm thô = `ratingValue` của neighbor đó, kẹp trong `[1, 5]`.
- Nếu `uncertaintyScore` lớn hơn ngưỡng:

```text
final = raw - (raw - userMean) * (uncertaintyScore / 100)
```

- `userMean` là trung bình rating của user. User chưa có rating thì mean mặc định `3.0`.
- Không vượt ngưỡng thì điểm cuối bằng điểm thô.

### Top-k

`GET /recommendations/top-k?k=10` (backend mặc định `k=10`; homepage gọi `k=5`).

- User chưa rate phim nào (cold start): lấy tối đa `k` phim `SHOWING`, sort IMDb giảm dần. Điểm dự đoán = `imdbRating / 2` (thiếu IMDb thì `3.0`). `uncertaintyScore = 100`. Không có neighbor.
- User đã có rating: ứng viên là tối đa 1000 phim `SHOWING`, loại phim user đã rate, ưu tiên IMDb rating cao khi cắt tập ứng viên. Mỗi ứng viên được dự đoán như trên. Sort `predictedRating` giảm dần, rồi `uncertaintyScore` tăng dần, cắt `k`.
- Response kèm `nearestMovieId`, `nearestMovieTitle`, `nearestMoviePosterUrl` để UI giải thích “Vì bạn đã đánh giá …”.

`GET /recommendations/predict?targetMovieId=` dùng cùng công thức cho một phim, kể cả phim user đã xem.

## API

Controller không gắn prefix `/api`. Client tự ghép base URL. README gốc gợi ý `VITE_API_BASE_URL=http://localhost:8080/api`, còn `fetchConfig.js` mặc định `http://localhost:8081` và không có `server.servlet.context-path` trong properties. Khi sang project khác, giữ một base URL thống nhất với mapping thật.

Quyền lấy từ `@PreAuthorize`. User id lấy bằng `UserService.getCurrentUser()`: email trong `SecurityContext`, rồi tìm `User`.

| Method | Path | Quyền | Việc |
| --- | --- | --- | --- |
| GET | `/recommendations/top-k?k=10` | đã đăng nhập | Top-k cá nhân hóa |
| GET | `/recommendations/predict?targetMovieId=` | đã đăng nhập | Dự đoán một phim |
| GET | `/recommendations/imdb/titles?query=&limit=` | đã đăng nhập | Tìm title trên IMDb |
| POST | `/recommendations/imdb-sync/{imdbId}` | `ADMIN` | Upsert một phim từ IMDb |
| POST | `/recommendations/max-dissimilarity/recalculate` | `ADMIN` | Tính lại max dissimilarity |
| GET | `/user-ratings/me` | đã đăng nhập | Mọi rating của user |
| GET | `/user-ratings/me/list?page=0&size=20` | đã đăng nhập | Rating phân trang |
| POST | `/user-ratings` | đã đăng nhập | Tạo hoặc cập nhật rating |
| DELETE | `/user-ratings/{movieId}` | đã đăng nhập | Xóa rating của user cho phim |
| GET | `/movies/search/title?title=` | public trong controller này | Tìm theo tên |
| GET | `/movies/filter/status?status=` | public trong controller này | Lọc `SHOWING` hoặc `UPCOMING` |
| GET | `/movies/filter/genre?genre=` | public trong controller này | Lọc genre, `LIKE` không phân biệt hoa thường |
| POST | `/movies/bulk-import?genre=&limit=20` | `ADMIN` | `202 Accepted`, import chạy `@Async` |

`POST /user-ratings` body:

```json
{ "movieId": "uuid", "ratingValue": 4.0 }
```

`ratingValue` phải nằm trong `[1.0, 5.0]`. Cùng user và cùng phim thì cập nhật bản ghi mới nhất, không tạo thêm dòng.

Một phần tử top-k:

```json
{
  "movieId": "uuid",
  "title": "string",
  "posterUrl": "string",
  "predictedRating": 4.2,
  "uncertaintyScore": 18.5,
  "nearestMovieId": "uuid",
  "nearestMovieTitle": "string",
  "nearestMoviePosterUrl": "string"
}
```

`RatingPredictionDTO` thêm `rawPrediction`, `finalPrediction`, `userMeanRating`, `minDissimilarity`, `thresholdApplied`. UI homepage dùng `predictedRating` (= `finalPrediction`) và `uncertaintyScore`.

Bulk import trả ngay:

```json
{ "message": "Bulk import started in background", "genre": "Action", "limit": 20 }
```

`limit` bị kẹp 1–100, mặc định 20. Mỗi thể loại là một request. UI admin gọi song song nhiều thể loại, mỗi thể loại một limit.

Property, đều có default trong code nên không bắt buộc có trong `application.properties`:

```properties
imdb.api.base-url=https://api.imdbapi.dev
imdb.bulk-import.delay-ms=1200
imdb.seed.enabled=false
imdb.seed.admin-email=admin@gmail.com
imdb.seed.ids=tt12042730,tt15398776
```

`ImdbMovieRatingSeeder` chỉ chạy khi `imdb.seed.enabled=true`. Nó sync từng id trong `imdb.seed.ids` lúc startup.

`RestTemplate` trong bản gốc: connect timeout 5 giây, read timeout 8 giây (`RestTemplateConfig`).

## UI gốc đang hiển thị gì

Homepage, khối “Top phim dành cho bạn” (`frontend/src/app/(public)/home/page.jsx`, khoảng dòng 190–220 và 277–421):

- Chưa đăng nhập: nhắc đăng nhập, không gọi API.
- Độ tin cậy = `100 - uncertaintyScore`.
- Độ phù hợp trên vòng tròn match = `predictedRating * 20` (thang 0–5 thành phần trăm).
- Dòng giải thích: “Vì bạn đã đánh giá {nearestMovieTitle}”, bấm vào mở trang phim neighbor.
- Nút “Phim tôi đã đánh giá” tới `/my-ratings`.

Trang `/my-ratings` gọi `GET /user-ratings/me/list`.

Trang chi tiết phim, `HeroSection` từ khoảng dòng 758, widget sao khoảng dòng 850–885: user đăng nhập chọn 1–5 sao, gọi `POST /user-ratings`. Phần còn lại của file là suất chiếu và đặt vé.

Form lọc: `Navbar.jsx` hàm `handleSearch` (khoảng dòng 46–50) và ô input khoảng dòng 102–129. Dropdown trạng thái và thể loại nằm ở `app/(public)/movie/search/page.jsx` khoảng dòng 191–236. Có từ khóa thì search title trước, rồi lọc status/genre trên client. Không có từ khóa thì gọi API filter và lấy giao nếu cả hai khác `ALL`.

Admin: `handleMassImport` khoảng dòng 169, nút mở modal khoảng dòng 489, `MassImportModal` từ dòng 1042 trong `app/(admin)/movies/page.jsx`. Hàm HTTP là `massImportByGenre` trong `adminMovieService.js` khoảng dòng 73.

## Bản đồ file

Đường dẫn dưới đây là tương đối trong folder clone. Trong project gốc, backend nằm dưới `MovieBooking/backend/...`, frontend dưới `movie-booking-frontend/...`.

### Backend — thuộc recommendation và dữ liệu nuôi nó

| File clone | Vai trò |
| --- | --- |
| `services/MovieRecommendationService.java` | Predict và top-k |
| `services/MovieDissimilarityCalculator.java` | Độ lệch số và hạng mục |
| `services/AlgorithmScheduledTasks.java` | Tính và lưu max dissimilarity |
| `services/UserRatingService.java` | CRUD rating và trung bình user |
| `services/ImdbSyncService.java` | Đọc IMDb và upsert `Movie` |
| `services/MovieBulkImportService.java` | Import nền theo thể loại |
| `controllers/RecommendationController.java` | `/recommendations/**` |
| `controllers/UserRatingController.java` | `/user-ratings/**` |
| `helpers/constants/AlgorithmConfigKeys.java` | Hai key config |
| `models/dtos/recommendation/*.java` | Bốn DTO |
| `models/dtos/imdb/ImdbTitleDTO.java` | Title IMDb |
| `models/entities/UserRating.java` | Bảng `user_ratings` |
| `models/entities/SystemConfig.java` | Bảng `system_config` |
| `repositories/UserRatingRepository.java` | Query rating, mean, phim đã xem |
| `repositories/SystemConfigRepository.java` | `JpaRepository<SystemConfig, String>` |
| `configs/ImdbMovieRatingSeeder.java` | Seed IMDb theo property |
| `configs/RestTemplateConfig.java` | Bean HTTP client |
| `helpers/exceptions/ResourceNotFoundException.java` | Lỗi không tìm thấy |
| `helpers/exceptions/CustomException.java` | Lỗi IMDb / timeout |

### Backend — file dùng chung, chỉ một phần thuộc service này

| File clone | Phần cần |
| --- | --- |
| `controllers/MovieController.java` | `@RequestMapping("/movies")`. Search/filter khoảng dòng 96–115. Bulk import khoảng dòng 132–146. Phần còn lại là CRUD phim và suất chiếu. |
| `repositories/MovieRepo.java` | `findByImdbId`, `existsByImdbId`, `findTop1000ByStatusOrderByImdbRatingDesc`, `findByStatusAndIdNotInOrderByImdbRatingDesc` cho gợi ý. `findByTitleContainingIgnoreCase`, `findByStatus`, `findByGenreContainingIgnoreCase`, `searchMovies` cho form lọc. |
| `models/entities/Movie.java` | Field thuật toán dùng: `title`, `genre`, `duration`, `imdbId`, `releaseYear`, `imdbRating`, `region`, `posterUrl`, `status`, `language`. Quan hệ `showtimes` không thuộc thuật toán. |
| `models/enums/MovieStatus.java` | `SHOWING`, `UPCOMING` |

Không copy, nhưng code trong bản này vẫn import:

- `User`, `UserRepo`, `UserService.getCurrentUser()`
- `MovieService` và DTO phim (`MovieDataResponse`, `AddMovieRequest`, `UpdateMovieRequest`) — chỉ vì `MovieController` đầy đủ được giữ lại
- `Showtime` — field trên `Movie`

### Frontend

| File clone | Vai trò |
| --- | --- |
| `api/recommendationService.js` | `getTopKRecommendations(k)` |
| `api/userRatingService.js` | `getMyRatings`, `getMyRatingsPage`, `upsertMovieRating` |
| `api/movieService.js` | Search/filter catalog cho form tìm phim |
| `api/adminservice/adminMovieService.js` | `massImportByGenre`; file còn nhiều hàm CRUD khác |
| `app/(public)/home/page.jsx` | Khối Top-K. Phần carousel đang chiếu / sắp chiếu không thuộc thuật toán |
| `app/(public)/home/tests/HomePage.test.jsx` | Mock `getTopKRecommendations` |
| `app/(public)/movie/search/page.jsx` | Form lọc trạng thái và thể loại |
| `app/(public)/movie/[id]/page.jsx` | Widget đánh giá trong `HeroSection`. Phần dưới là đặt vé |
| `app/(protected)/my-ratings/page.jsx` | Danh sách phim user đã rate |
| `app/(admin)/movies/page.jsx` | `MassImportModal`. Phần còn lại là CRUD phim |
| `components/common/Navbar.jsx` | Ô tìm kiếm. Menu, login, logout không thuộc service |

Các trang UI import thêm `Navbar`, `Footer`, `MovieCard`, `AuthContext`, `apiFetch`. Những file đó không nằm trong bản clone.

## Cách gắn sang project khác

Làm theo thứ tự này. Không copy nguyên `MovieController`, trang admin, trang chi tiết phim, hay navbar: chúng trộn booking.

1. **Bảng dữ liệu.** Tạo `user_ratings` (`rating_id`, `user_id`, `movie_id`, `rating_value` 1–5, `created_at`) và `system_config` (`config_key` PK, `config_value` text, `created_at`, `updated_at`). Phim cần các field dissimilarity đọc: thời lượng, năm, điểm IMDb, genre, ngôn ngữ, vùng, trạng thái, poster, title, `imdb_id` unique.
2. **Hằng và repository.** Mang `AlgorithmConfigKeys`, `SystemConfig`, `SystemConfigRepository`, `UserRating`, `UserRatingRepository`, bốn DTO recommendation. Đổi package cho khớp project đích. `UserRating.user` và `UserRating.movie` phải trỏ entity user và movie của project đó.
3. **Service thuật toán.** Mang `MovieDissimilarityCalculator`, `MovieRecommendationService`, `UserRatingService`, `AlgorithmScheduledTasks`. Thêm hai method vào movie repository: top 1000 theo status sort IMDb, và cùng query nhưng loại một tập id. Bật `@EnableScheduling` trên application class.
4. **API.** Mang hai controller recommendation và user-rating, hoặc viết lại endpoint mỏng gọi service. Thay `UserService.getCurrentUser()` bằng cách project đích lấy user đang đăng nhập. Gắn security: user thường cho predict, top-k, rating; admin cho tính lại max dissimilarity.
5. **Catalog cho form lọc**, nếu project đích cũng cần ô tìm và dropdown. Ba query là đủ: title contains, status bằng, genre contains. Không nối chúng vào `recommendTopKMovies`.
6. **IMDb**, nếu cần nạp phim. Mang `ImdbSyncService`, `MovieBulkImportService`, `ImdbTitleDTO`, `RestTemplateConfig`. Bật `@EnableAsync`. Endpoint admin `POST /movies/bulk-import` chỉ cần gọi `importMoviesByGenre`. UI chỉ cần form thể loại + limit, không cần cả trang CRUD. Seeder là tùy chọn.
7. **Client.** `recommendationService.js` và `userRatingService.js` chỉ phụ thuộc `apiFetch` (Bearer token, base URL). Đổi đường dẫn import. Homepage chỉ cần đoạn fetch top-k và công thức hiển thị `predictedRating * 20` với `100 - uncertaintyScore`. Widget sao chỉ cần `upsertMovieRating(movieId, star)`.
8. **Sau khi có dữ liệu phim.** Gọi một lần `POST /recommendations/max-dissimilarity/recalculate`, hoặc để job startup tự tính. Chưa có dòng này thì service dùng max mặc định `1000`, uncertainty sẽ rất thấp và ngưỡng 12 gần như không kéo điểm về mean.
9. **Kiểm tra.** User chưa rate: top-k là phim đang chiếu điểm IMDb cao, uncertainty 100. User rate một phim: phim catalog gần nó (cùng genre, năm, thời lượng, điểm IMDb) phải đứng trước và hiện đúng tên phim neighbor. Đổi rating rồi gọi lại top-k phải đổi điểm dự đoán. Bulk import một thể loại phải trả 202 và sau đó có dòng mới với `imdb_id`.

## Git log của phần này

Lịch sử nằm trên repo gốc, không copy commit sang folder này.

| Commit | Nội dung |
| --- | --- |
| `184ec3a` | Bulk import, dissimilarity, recommendation service |
| `59a5282` | Client recommendation và rating |
| `fc53c85` | Merge PR #1 `RecommendationSystem` |
| `ea3b30a`, `a0f2958`, `110388d`, `04cafa6`, `651d08c`, `21b52e3` | UI mass import |
| `e18bb19` | Phân trang rating và giải thích nearest movie trên Top-K |
| `d95a90e` | Merge PR #3 `RecommendationSystem` |
| `bbe2ec0` | Comment trong sync IMDb, dissimilarity, recommendation |

## Giới hạn

- `/recommendations/top-k` không có query genre, năm, hay “sở thích”. Form lọc và gợi ý không nối với nhau.
- Neighbor là argmin trên toàn bộ lịch sử rating, không phải top-k neighbor rồi vote.
- Ứng viên top-k chỉ là phim `SHOWING`, tối đa 1000, đã sort theo IMDb trước khi chấm điểm. Một phim đang chiếu nhưng IMDb thấp có thể không vào tập ứng viên.
- Max dissimilarity quét mọi cặp. Catalog lớn sẽ chậm lúc startup và lúc cron.
- IMDb mặc định `https://api.imdbapi.dev`. Không có API key trong code.
- Bản clone không đủ classpath để `javac`: thiếu `User`, `Showtime`, `MovieService`, và các DTO movie của controller dùng chung.
