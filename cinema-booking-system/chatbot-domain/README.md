# Domain Chatbot AI — phân tích và hướng dẫn tái sử dụng

Tài liệu này mô tả domain chatbot đang chạy trong AI Tutor, rồi chỉ cách mang **kernel hội thoại + RAG** sang một sản phẩm khác. Sản phẩm đích không phải ứng dụng gia sư: không học sinh, không môn học, không sách giáo khoa, không XP.

Nguồn sự thật là mã đang chạy, đối chiếu với `.docs/AI_Tutor_SRS_MVP.md` mục 5.4, 5.5 và 10. Chỗ SRS và mã lệch nhau được ghi riêng, vì mang nhầm hành vi “trên giấy” sẽ tạo một hệ thống khác hệ thống gốc.

---

## 1. Kết luận để mang đi

Domain này là một **trợ lý hỏi đáp trên kho tài liệu**, gồm bốn phần:

1. Nạp tài liệu bất đồng bộ: tách chữ, cắt đoạn, nhúng vector, lưu chunk.
2. Phiên hội thoại của một người, kèm lịch sử tin và trích dẫn.
3. Truy hồi top-K trên PostgreSQL/pgvector, rồi gọi LLM.
4. Đẩy kết quả ra client bằng sự kiện `token` / `citations` / `done` / `error`.

Phần gắn chết vào gia sư nằm ở **chủ sở hữu phiên**, **khóa lọc kho** và **lời thoại hệ thống**. Cơ chế phiên, sự kiện stream, truy hồi vector và pipeline nạp tài liệu đứng riêng được.

Khi sang dự án khác, giữ cơ chế. Đổi ba khái niệm:

| Trong AI Tutor | Trong sản phẩm khác |
| --- | --- |
| `student_id` | `actor_id` của người đã đăng nhập, trong một `tenant_id` |
| `subject` + `grade_level` | `knowledge_base_id` và các thẻ phạm vi (sản phẩm, ngôn ngữ, quyền xem) |
| “gia sư, sách giáo khoa, LaTeX, emoji” | hồ sơ prompt của sản phẩm đích |

Đừng copy nguyên bảng `students`, `books`, `lessons`, `skills`, hay các query tính giờ học từ `chat_sessions`.

---

## 2. Bản đồ mã

### 2.1. Hội thoại — đây là domain chatbot

| Vai trò | File |
| --- | --- |
| API REST + SSE | `ai-tutor-service/src/main/java/com/vn/aitutor/controller/ChatController.java` |
| API STOMP | `controller/ChatWebSocketController.java` |
| Nghiệp vụ phiên | `service/chat/IChatService.java`, `ChatServiceImpl.java` |
| Một lượt hỏi–đáp | `service/chat/ChatStreamProcessor.java` |
| Truy hồi | `service/chat/CustomPostgresRetriever.java` |
| Lọc từ khóa | `service/chat/ContentSafetyService.java` |
| Lời thoại + hợp đồng LLM | `ai/agent/AiTutorChatAgent.java` |
| Gắn model, bộ nhớ, retriever | `config/ChatbotConfig.java` |
| Model Gemini đổi theo cấu hình | `config/DynamicGeminiChatLanguageModel.java` |
| Chọn model / key / temperature | `ai/resolver/AiModelResolver.java` |
| Bộ lọc RAG theo luồng | `context/RagContextHolder.java` |
| Phiên / tin | `entity/ChatSession.java`, `entity/ChatMessage.java` |
| Sự kiện | `dto/response/chat/ChatStreamEvent.java` |
| Quyền STOMP | `security/websocket/OwnedChatDestinationAuthorization.java`, `WebSocketSecurityConfig.java` |

### 2.2. Kho tri thức — chatbot chỉ đọc được sau khi phần này chạy xong

| Vai trò | File |
| --- | --- |
| Nhận file, đẩy queue | `service/curriculum/DocumentIngestionServiceImpl.java` |
| Worker | `listener/DocumentIngestionMessageListener.java` |
| Tách chữ, cắt, nhúng, ghi chunk | `service/curriculum/DocumentIngestionProcessor.java` |
| Tách chữ | `service/curriculum/DocumentTextExtractor.java` |
| Cắt đoạn, giữ công thức | `curriculum/LatexAwareSplitter.java` |
| Nhúng | `ai/client/ChunkEmbeddingService.java`, `config/OllamaEmbeddingConfig.java` |
| Tìm vector | `repository/DocumentChunkRepository.java` |
| Hàng đợi | `config/RabbitMQConfig.java` — queue `document.ingestion.queue` |
| Schema | `src/main/resources/db/migration/V1__init_schema.sql` |

### 2.3. Client đang dùng

| Vai trò | File |
| --- | --- |
| Trang chat, đọc SSE bằng `fetch` | `ai-tutor-frontend/src/pages/Student/AIChat/AIChatPage.tsx` |
| REST + client STOMP (STOMP không được trang gọi) | `src/services/chatApi.ts` |
| Popup trích dẫn | `pages/Student/AIChat/components/CitationModal.tsx` |

### 2.4. AI khác trong cùng repo — không thuộc domain này

`ai/advisor/*` sinh lời khuyên lỗ hổng kiến thức. `ai/agent/GeminiQuestionGeneratorAgent.java` sinh câu hỏi. Queue `quiz.generation.queue` phục vụ đề thi. Chúng dùng chung Gemini và embedding, nhưng hợp đồng, dữ liệu và prompt khác chatbot. Sang dự án mới thì không kéo theo.

---

## 3. Kiến trúc đang chạy

```text
Người dùng
  │  POST /api/v1/chat-sessions/{id}/chat/stream     (trang đang dùng)
  │  STOMP /app/chat-sessions/{id}/messages          (đã làm, trang không gọi)
  ▼
ChatServiceImpl
  │  kiểm tra chủ phiên, cắt tin nhắn
  │  đưa việc sang ExecutorService (cached pool, không giới hạn)
  ▼
ChatStreamProcessor.process          @Transactional
  │  1. ghi tin USER
  │  2. ContentSafetyService
  │  3. RagContextHolder.set(subject, gradeLevel)
  │  4. AiTutorChatAgent.chat(sessionId, message)
  │       ├─ MessageWindowChatMemory, tối đa 20 tin, chỉ trong RAM
  │       ├─ CustomPostgresRetriever
  │       │    ├─ Ollama bge-m3 → vector 1024
  │       │    └─ SELECT ... ORDER BY embedding <=> vector LIMIT 5
  │       └─ Gemini, chờ cả câu rồi mới trả
  │  5. cắt câu trả lời theo khoảng trắng, bắn từng mẩu
  │  6. ghi tin AI + citation JSON
  │  7. sự kiện citations, rồi done
  ▼
SSE: event message | citations | done | error
STOMP: ChatStreamEvent JSON tới /user/queue/chat-sessions/{id}/stream
```

Nạp tài liệu là đường riêng:

```text
Upload
  → lưu file (Cloudinary)
  → documents.status = PROCESSING
  → RabbitMQ document.ingestion.queue
  → tải file về
  → txt/md đọc UTF-8; file khác qua LlamaParse
  → LatexAwareSplitter: 1000 ký tự, chồng 150, không cắt đôi công thức $...$
  → nhúng theo lô 100 đoạn
  → INSERT document_chunks
  → status = SUCCESS
Lỗi → transaction rollback, listener gọi markFailed
Tiến độ → STOMP /user/queue/document-progress
```

Hai đường chỉ gặp nhau ở bảng `document_chunks`. Chatbot không biết sách, chương, bài. Nó chỉ thấy đoạn chữ, vector và metadata.

Hạ tầng: Spring Boot, Java 17, LangChain4j **0.35.0** (`langchain4j`, `langchain4j-google-ai-gemini`, `langchain4j-ollama`), PostgreSQL 16 + pgvector, RabbitMQ (vừa queue nạp, vừa STOMP relay cổng 61613), Redis không nằm trên đường chat.

---

## 4. Dữ liệu và chỗ bị khóa vào gia sư

### 4.1. Phiên và tin

`chat_sessions`

| Cột | Ý nghĩa khi tái sử dụng |
| --- | --- |
| `id` UUID | Giữ |
| `student_id` → `students` | Đổi thành `actor_id`. API hiện từ chối mọi user không có dòng `students` |
| `subject` VARCHAR(64) | Nhãn phiên **và** khóa lọc kho. Tách làm hai: `title`/`topic` cho người dùng, `knowledge_base_id` cho truy hồi |
| `title` | Giữ. Tạo phiên đang đặt `"Trò chuyện: " + subject` |
| `status` `OPEN` / `CLOSED` | Cột có check constraint. Mã tạo phiên luôn ghi `OPEN`. Không có API đóng phiên |
| `created_at`, `last_message_at` | Giữ. `last_message_at` cập nhật khi có tin mới |

`chat_messages`

| Cột | Thực tế trong mã |
| --- | --- |
| `sender_type` | Chỉ `STUDENT` hoặc `AI` |
| `content` | Nguyên văn. Tin người dùng tối đa 1000 ký tự, kiểm tra ở DTO và ở service |
| `citation_links` JSONB | Danh sách `{ "text", "metadata" }`. `text` là cả chunk, nên dòng tin AI nhân đôi nội dung kho |
| `audio_url`, `intent` | Có cột, đường stream không ghi |
| `created_at` | Trigger cấm `UPDATE` và `DELETE` |

Trigger `trg_chat_messages_immutable` gọi `reject_history_mutation()`. Sửa hoặc xóa tin ném `HISTORY_IMMUTABLE` (SQLSTATE `42501`), `GlobalExceptionHandler` đổi thành HTTP 403. Xóa phiên đi đường tắt: trong transaction gọi `set_config('app.allow_history_maintenance', 'true', true)` rồi xóa tin, rồi xóa phiên. Cờ này chỉ sống trong transaction hiện tại.

Index đáng giữ: `(owner, last_message_at)` và `(session_id, created_at)`.

### 4.2. Kho

`documents` đang có `lesson_id`, `subject`, `grade_level`, `document_type` (`THEORY` / `EXERCISE` / `EXAM`), `status` (`PROCESSING` / `SUCCESS` / `FAILED`), `created_by_id`.

`document_chunks`

- `embedding vector(1024)`, hằng số Java `DocumentChunk.EMBEDDING_DIMENSIONS = 1024`
- Index HNSW `vector_cosine_ops`
- Unique `(document_id, chunk_index)`
- `metadata` JSONB do worker ghi: `source` (tên file), `title`, `subject`, `gradeLevel`, `url`, `documentType`, `lessonId`, `lessonTitle`

Trang trích dẫn tìm `metadata.file_name`, `page`, `page_label`. Worker không ghi ba khóa đó. Popup rơi về `metadata.source` và không có số trang.

### 4.3. Query học tập bám vào phiên chat

`ChatSessionRepository.sumCappedChatSeconds` và `chatSecondsByWeekday` cộng thời gian từ `created_at` tới `last_message_at`, trần 7200 giây, lọc theo lớp và môn, timezone `Asia/Ho_Chi_Minh`. Đó là giờ tự học của dashboard giáo viên. Domain chatbot không cần hai query này.

---

## 5. Hợp đồng đang chạy

Base path: `/api/v1/chat-sessions`. Mọi route đòi JWT (`anyRequest().authenticated()`). Không có `@PreAuthorize` theo role trên controller. Quyền thật là “user này có hồ sơ học sinh và phiên thuộc học sinh đó”.

| Method | Path | Việc |
| --- | --- | --- |
| `GET` | `/api/v1/chat-sessions` | Phiên của chủ, mới nhất trước (`last_message_at`, không có thì `created_at`) |
| `POST` | `/api/v1/chat-sessions?subject=` | Tạo phiên. Thiếu query thì mặc định `Toán học` |
| `PATCH` | `/api/v1/chat-sessions/{id}` | Đổi `title`, 1–255 ký tự |
| `DELETE` | `/api/v1/chat-sessions/{id}` | Xóa cứng tin và phiên, 204 |
| `GET` | `/api/v1/chat-sessions/{id}/messages` | Tin tăng dần theo thời gian |
| `POST` | `/api/v1/chat-sessions/{id}/chat/stream` | SSE. Body `{ "message" }`, 1–1000 ký tự. Timeout emitter 120 giây |

Danh sách phiên và tin trả **mảng JSON thô**, không bọc `ApiResponse`. `chatApi.ts` chấp nhận cả `payload.data` lẫn body trần. Dự án mới nên chọn một kiểu và giữ suốt.

SSE (`ChatServiceImpl.sendSseEvent`):

| `event:` | `data:` |
| --- | --- |
| `message` | một mẩu chữ |
| `citations` | JSON mảng citation |
| `done` | `[DONE]` |
| `error` | chuỗi lỗi, hiện chỉ có `"Lỗi kết nối AI"` khi ngoại lệ trong nhánh an toàn |

STOMP, nếu dùng:

- Client gửi tới `/app/chat-sessions/{sessionId}/messages`, body `{ "message" }`
- Server đẩy `ChatStreamEvent` tới `/user/queue/chat-sessions/{sessionId}/stream`
- `type` là `token` | `citations` | `done` | `error`
- JWT nằm ở header CONNECT `Authorization: Bearer`
- `OwnedChatDestinationAuthorization` chỉ cho subscribe/send đúng phiên của user, destination phải khớp UUID
- Spring Security 7 gắn CSRF channel interceptor. Project tắt bằng bean tên `csrfChannelInterceptor` (no-op), vì HTTP đã tắt CSRF. Thiếu bean này thì STOMP đứt ở `clientInboundChannel`
- Broker là RabbitMQ STOMP relay, prefix `/app` và `/user`, endpoint `/ws`

Trang `AIChatPage` đi SSE. `createChatStompClient` / `publishChatMessage` có trong `chatApi.ts` nhưng trang không gọi. Mang một kênh là đủ. SSE đơn giản hơn nếu sản phẩm đã có REST. STOMP hợp khi đã có broker và cần nhiều loại sự kiện trên một socket.

---

## 6. Hành vi thật — đọc trước khi copy

Những điểm dưới đây là mã, không phải SRS. SRS mục 10.2 nói có ngưỡng tương đồng và lịch sử đưa vào prompt. Mã làm khác.

### 6.1. Stream là stream giả

`AiTutorChatAgent.chat` trả `Result<String>`. `DynamicGeminiChatLanguageModel` bọc `ChatLanguageModel` đồng bộ, timeout 2 phút. `ChatStreamProcessor.emitChunks` chạy **sau khi** cả câu đã về, cắt bằng `split("(?<=\\s)")`, rồi gửi từng mảnh.

Hệ quả: thời gian tới ký tự đầu bằng thời gian sinh cả câu. Người dùng thấy chữ chảy ra chỉ vì server nhả dần một chuỗi đã có sẵn. LangChain4j 0.35 có `StreamingChatLanguageModel`; project không dùng.

`AIChatPage` còn cộng thêm một dấu cách sau mỗi dòng `data:`. Backend đã giữ khoảng trắng trong mảnh, nên câu trên UI dễ thừa space. Parser cắt theo `\n` của từng lần `read()`, không ghép frame SSE bị cắt giữa chừng. Sự kiện `error` không được xử lý. `fetch` không gửi `Authorization`. Các API khác trong frontend gửi `Bearer`; đường chat HTTP thì không. Security đòi JWT trên HTTP, nên bản sao phải gắn token vào `fetch` (cách STOMP đang làm) nếu không muốn 401.

`fetch` cũng không kiểm tra `response.ok` trước khi đọc body.

### 6.2. Bộ nhớ mô hình không phải lịch sử trong database

`ChatbotConfig` đăng ký:

```text
chatMemoryProvider(memoryId -> MessageWindowChatMemory.withMaxMessages(20))
```

LangChain4j 0.35 giữ map bộ nhớ trong singleton `AiServices`, khóa bằng `memoryId` (ở đây là `sessionId`). Provider chỉ được gọi lần đầu mỗi khóa. Bộ nhớ:

- sống trong RAM của một process
- mất khi restart
- không chia sẻ giữa nhiều instance
- không được nạp lại từ `chat_messages`
- đếm theo số message, trần 20, không theo token

UI đọc full lịch sử từ database. Model chỉ thấy cửa sổ RAM kể từ lúc process chạy, cộng system prompt, cộng chunk truy hồi. Sau restart, câu tiếp theo đi vào model như một câu mới, trong khi sidebar vẫn hiện hội thoại cũ.

`@MemoryId` bảo đảm không trộn phiên với nhau **trên cùng một JVM**. Nó không phải bộ nhớ bền.

### 6.3. Transaction ôm cả lần gọi LLM

`ChatStreamProcessor.process` có `@Transactional`. Trong transaction đó có: ghi tin người dùng, nhúng câu hỏi, query pgvector, gọi Gemini tới 2 phút, ghi tin AI. Một kết nối JDBC bị giữ suốt thời gian model. Pool nhỏ sẽ nghẽn khi nhiều người hỏi cùng lúc.

Tin người dùng được ghi trước khi gọi model. Nhánh lỗi nuốt exception, gửi `error`, không ném lại, nên transaction vẫn commit: còn tin người dùng, không có tin AI. Reload trang sẽ mất bong bóng AI lạc quan trên UI.

Pool worker là `Executors.newCachedThreadPool()`, không trần, không hàng đợi có giới hạn.

### 6.4. Truy hồi luôn lấy 5 đoạn, không có ngưỡng

`CustomPostgresRetriever` nhúng `query.text()`, đổi `float[]` thành chuỗi `Arrays.toString` (dạng `[0.1, 0.2, ...]`), rồi:

```sql
ORDER BY embedding <=> cast(:vector AS vector)
LIMIT 5
```

Toán tử `<=>` với `vector_cosine_ops` là **khoảng cách cosine** (càng nhỏ càng gần). Không có `WHERE` khoảng cách. Năm đoạn xa vẫn vào prompt.

Có bộ lọc khi `RagContextHolder` có `subject` hoặc `gradeLevel`:

```sql
JOIN documents d ON dc.document_id = d.id
WHERE (:subject IS NULL OR d.subject = :subject)
  AND (:gradeLevel IS NULL OR d.grade_level = :gradeLevel)
```

SQL này không kiểm tra `d.status = 'SUCCESS'`. Chunk chỉ được insert trong transaction thành công, ngay trước lúc status chuyển `SUCCESS`, nên lần nạp lỗi thường không để lại chunk. Nếu sau đó có ai đổi status mà không xóa chunk, đoạn đó vẫn bị tìm thấy.

Không có ACL. Mọi phiên cùng môn và cùng khối nhìn cùng một kho toàn hệ thống. Không lọc theo người tải, theo lớp, theo tenant.

`subject` lấy từ phiên. `gradeLevel` lấy từ hồ sơ học sinh, không lấy từ phiên. Tạo phiên bắt buộc có subject, nên đường có lọc là đường sống. Khối null thì điều kiện khối thành true, chỉ còn lọc môn.

`RagContextHolder` là `ThreadLocal`. Retriever chạy đồng bộ trên đúng worker thread, nên lọc có hiệu lực. Nếu lần sau nhúng hoặc search bị chuyển sang thread khác, lọc biến mất và query rơi vào bản không `WHERE`. `finally` có `clearContext()`. Thiếu bước đó thì thread pool tái sử dụng sẽ dính phạm vi của request trước.

### 6.5. Model, key, temperature

`DynamicGeminiChatLanguageModel` đọc mỗi lần gọi:

- key: `ai.api_key`, rồi `ai.custom_api_key`, rồi `GEMINI_API_KEY`
- model: `ai.default_model`, rồi `ai.model`
- temperature: `ai.temperature`

Seed trong `V1__init_schema.sql` ghi `ai.default_model = gemini-1.5-flash` và `ai.temperature = 0.7`. `AiModelResolver` coi tên chứa `1.5`, `2.5`, hoặc bắt đầu bằng `gpt-` / `ollama:` là không dùng, và đổi về `gemini-flash-lite-latest`. Temperature 0.3 trong code chỉ là default khi setting trống; seed 0.7 thắng.

Khi message lỗi chứa 503, unavailable, overloaded, 429, quota, rate limit, và model hiện tại khác default, wrapper gọi lại default model một lần. Key rỗng bị thay bằng `DUMMY_KEY_NOT_CONFIGURED` để process vẫn lên.

Embedding đang gắn là bean `OllamaEmbeddingModel`: `langchain4j.ollama.embedding-model.base-url` (mặc định `http://localhost:11434`), model `bge-m3`, timeout 2 phút. `ChunkEmbeddingService` retry 2 lần, delay 200 ms, nhân 2, khi `IngestionException`.

`OpenAiEmbeddingClient` khai báo `text-embedding-3-small`, **1536** chiều. `GeminiEmbeddingClient` cũng tồn tại. Không bean nào trong hai class đó được `ChunkEmbeddingService` dùng. Đổi model nhúng mà không tạo cột vector mới và nạp lại toàn bộ chunk sẽ làm search vô nghĩa hoặc vỡ lúc insert.

### 6.6. Prompt đang khóa nghiệp vụ gia sư

`AiTutorChatAgent` gắn `@SystemMessage` cố định lúc build:

- xưng là gia sư, trả lời tiếng Việt, được dùng emoji
- bám `[Tài liệu tham khảo]`, nếu không có thì nói rõ và vẫn được gợi ý ngoài sách
- Markdown, xuống dòng kép
- mọi công thức nằm trong `$...$` hoặc `$$...$$`

SRS nói ưu tiên kho và không bịa citation. Prompt lại cho phép trả lời ngoài kho. Với bot nội quy, hợp đồng, hoặc hỗ trợ khách hàng, câu “vẫn gợi ý theo hiểu biết” cần bỏ. `@SystemMessage` của LangChain4j 0.35 là chuỗi tĩnh trên interface. Nhiều sản phẩm hoặc nhiều giọng trên một process thì đừng dùng một interface annotation; dựng prompt trong code theo hồ sơ.

Chunk đưa vào prompt không có hàng rào chống prompt injection. Tài liệu độc có thể ra lệnh cho model.

### 6.7. An toàn nội dung

`ContentSafetyService` là danh sách từ khóa tiếng Việt, viết cho lớp học. Cụm nhiều chữ so khớp `contains`. Từ một chữ so khớp biên từ. Khớp thì ghi `audit_logs` action `CONTENT_SAFETY_VIOLATION` kèm **nguyên văn tin**, trả một câu từ chối về môi trường giáo dục, không gọi LLM.

Hàm này không đọc output của model. Từ ngắn trong danh sách dễ chặn nhầm câu bình thường. Danh sách và câu từ chối không mang sang sản phẩm khác; thay bằng chính sách của sản phẩm đó. Cân nhắc không lưu nguyên văn tin bị chặn nếu tin có thể chứa dữ liệu nhạy cảm.

### 6.8. Cắt đoạn đang phục vụ toán

`LatexAwareSplitter`: cửa sổ 1000 ký tự, chồng 150, ưu tiên ngắt ở xuống dòng, che công thức `$...$` và `$$...$$` để không cắt đôi. `DocumentTextExtractor` đọc `.txt` / `.md` tại chỗ. Phần còn lại gửi LlamaParse với chỉ thị giữ LaTeX. File Cloudinary thường mất đuôi, nên extractor nhìn `originalName` và copy ra file tạm đúng extension.

Sản phẩm không có công thức thì thay splitter này bằng cutter theo heading hoặc đoạn văn. Giữ overlap và batch embed.

### 6.9. Những cột và trạng thái chưa có hành vi

- `CLOSED` không được gán ở đâu
- `audio_url`, `intent` không được stream path ghi
- không có sửa tin, sinh lại, dừng giữa chừng, đính kèm trong phiên
- không có bộ 20 câu đánh giá retrieval mà SRS mục 10.4 yêu cầu

---

## 7. Cái giữ, cái đổi tên, cái bỏ

### Giữ nguyên ý tưởng

- Một lượt xử lý trả sự kiện qua `Consumer<ChatStreamEvent>`, transport chỉ là adapter
- Kiểm tra chủ phiên hai lần: một lần ở thread HTTP, một lần trong worker
- Citation lấy từ `Result.sources()`, lưu cùng tin trợ lý
- Kho và hội thoại tách bảng
- Nạp tài liệu bằng queue, trạng thái `PROCESSING` / `SUCCESS` / `FAILED`, tiến độ riêng
- Một model nhúng cho cả lúc nạp và lúc hỏi, cùng số chiều với cột vector
- Index HNSW cosine
- Quyền theo từng phiên trên kênh realtime
- Xóa phiên trong một transaction, có chốt nếu vẫn muốn lịch sử bất biến

### Đổi tên và cắt khóa ngoại

| Mã hiện tại | Bản mang đi |
| --- | --- |
| `Student` / `student_id` | `actor_id UUID NOT NULL` + `tenant_id UUID NOT NULL` |
| `SenderType.STUDENT` | `USER` |
| `SenderType.AI` | `ASSISTANT` |
| `session.subject` | bỏ khỏi retriever. Nếu UI cần nhãn, để `topic` không tham gia SQL |
| `student.gradeLevel` | bỏ. Phạm vi là `knowledge_base_id` |
| `RagContextHolder(subject, grade)` | tham số tường minh của retriever, hoặc scope trong query object. Bỏ `ThreadLocal` |
| `AiTutorChatAgent` | `KnowledgeAssistant`, prompt inject lúc chạy |
| Câu từ chối giáo dục | bản sao của chính sách sản phẩm |
| Metadata `lessonId`, `gradeLevel` | `sourceId`, `title`, `uri`, `locator` (trang, mục, dòng) |

### Bỏ lại

- `sumCappedChatSeconds`, `chatSecondsByWeekday`
- `books`, `chapters`, `lessons`, `lesson_skills`, `skills`
- `document_type` THEORY / EXERCISE / EXAM
- `LatexAwareSplitter` và chỉ thị LaTeX, trừ khi sản phẩm đích cũng có công thức
- mặc định môn `Toán học`
- pedagogy advisor, question generator, quiz queue
- cột `audio_url` / `intent` cho đến khi có tính năng thật

---

## 8. Hình dạng nên có ở dự án đích

Tách ba cổng. Chatbot phụ thuộc cổng, không phụ thuộc bảng học sinh hay Gemini cụ thể.

```text
ConversationService
  owns sessions and messages for (tenant_id, actor_id)

RetrievalPort
  search(tenantId, knowledgeBaseId, query, limit, maxDistance) -> List<Passage>

LanguageModelPort
  complete(promptProfile, history, passages, userMessage) -> Completion
  stream(...) nếu sản phẩm cần token thật

SafetyPort
  inspectInbound(text) -> allow | reject
  inspectOutbound(text) -> allow | redact     (bản gốc chưa có)

IngestionPort
  submit(source) -> job
  worker: extract -> split -> embed -> upsert chunks -> mark job
```

`ChatStreamProcessor` hiện tại gần với `ConversationService` + orchestration. `CustomPostgresRetriever` gần với `RetrievalPort`, nhưng đang tự đọc `ThreadLocal` và tự gọi embedding. `DynamicGeminiChatLanguageModel` gần với `LanguageModelPort`.

Một lượt hỏi ở hệ mới:

```text
1. Xác thực. Lấy tenant_id và actor_id từ principal.
2. Khóa phiên: tenant + actor + session_id.
3. Chuẩn hóa tin (trim, trần độ dài).
4. SafetyPort inbound. Từ chối thì ghi cả hai tin và dừng, không gọi model.
5. Mở transaction ngắn: insert tin USER, cập nhật last_message_at. Commit.
6. Ngoài transaction:
     passages = RetrievalPort.search(...)
     history  = messages của phiên, lấy N tin mới nhất hoặc bản tóm tắt
     completion = model
7. Transaction ngắn: insert tin ASSISTANT + citations. Commit.
8. Đẩy sự kiện. Nếu model stream thật, đẩy token trong bước 6 và chỉ ghi DB khi xong hoặc khi client hủy (ghi phần đã sinh, đánh dấu incomplete).
```

Bước 5 và 7 tách khỏi bước 6 để không giữ kết nối database trong lúc chờ model. Đây là thay đổi có chủ đích so với `@Transactional` bọc cả `process()`.

Phạm vi kho bắt buộc có `tenant_id`. Thiếu điều kiện này là lỗi, không phải “tìm trên toàn bộ bảng”. Bản gốc tìm toàn cục theo môn và khối.

Ngưỡng: lưu khoảng cách trong câu query (`embedding <=> :vector AS distance`) và `WHERE distance <= :max`. Hết đoạn hoặc đoạn quá xa thì prompt không được bịa theo kiến thức nền, trừ khi hồ sơ sản phẩm cho phép. Ngưỡng cosine distance của `bge-m3` phải đo trên bộ câu của chính kho mới; đừng copy số từ dự án khác.

Bộ nhớ: lúc khởi động không tin RAM. Mỗi lượt đọc lịch sử từ `messages`. Trần theo token của model đích, không chỉ đếm 20 message. Có thể cache Redis theo `session_id` với TTL, nhưng nguồn đúng vẫn là bảng tin. Xóa phiên thì xóa luôn cache.

Prompt theo hồ sơ, ví dụ các khóa:

- `product`: tên sản phẩm, giọng, ngôn ngữ
- `grounding`: `strict` (chỉ trả lời từ passage) hoặc `assisted` (được nói khi nào đang suy diễn)
- `format`: markdown, plain, JSON
- `refusal`: câu khi không đủ căn cứ, câu khi safety chặn

Một process phục vụ nhiều hồ sơ thì hồ sơ là dữ liệu, không phải annotation Java.

---

## 9. Schema gợi ý

Đủ cho một trợ lý kho tri thức đa tenant. Không có học sinh, môn, khối.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sources (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases (id),
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_uri VARCHAR(1024) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
    error_message TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_sources_status CHECK (status IN ('PROCESSING', 'SUCCESS', 'FAILED'))
);

CREATE TABLE passages (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    source_id UUID NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_passages_source_ordinal UNIQUE (source_id, ordinal)
);

CREATE INDEX idx_passages_hnsw
    ON passages USING hnsw (embedding vector_cosine_ops);

CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases (id),
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_actor
    ON conversations (tenant_id, actor_id, last_message_at DESC NULLS LAST);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    citations JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_messages_sender CHECK (sender IN ('USER', 'ASSISTANT'))
);

CREATE INDEX idx_messages_conversation
    ON messages (conversation_id, created_at);
```

Truy hồi tối thiểu:

```sql
SELECT p.content, p.metadata, (p.embedding <=> cast(:vector AS vector)) AS distance
FROM passages p
JOIN sources s ON s.id = p.source_id
WHERE p.tenant_id = :tenantId
  AND s.knowledge_base_id = :knowledgeBaseId
  AND s.status = 'SUCCESS'
ORDER BY p.embedding <=> cast(:vector AS vector)
LIMIT :k;
```

Lọc `distance` ở tầng ứng dụng sau khi đã có số đo, hoặc thêm điều kiện trong SQL sau khi đã chốt ngưỡng. Luôn có `tenant_id` trong `WHERE`.

Nếu sản phẩm cần sửa hoặc sinh lại câu trả lời, đừng gắn trigger bất biến của AI Tutor. Trigger đó hợp audit học tập, vướng chatbot thông thường. Nếu vẫn muốn audit, thêm bảng `message_events` append-only và để bảng `messages` sửa được.

Số chiều `1024` chỉ đúng với `bge-m3`. Đổi model thì đổi hằng số, cột, index, và nạp lại passage. Giữ một hằng số duy nhất mà cả writer lẫn checker đều đọc, giống `DocumentChunk.EMBEDDING_DIMENSIONS`.

---

## 10. Các bước tích hợp

Thứ tự này để có một lát cắt chạy được trước khi thêm stream và UI.

### Bước 1. Kho vector trước, chat sau

Dựng Postgres với image `pgvector/pgvector:pg16`. Chạy schema mục 9. Cắm một `EmbeddingModel` và từ chối khởi động nếu `embed("ping").length` khác chiều cột.

Viết worker nạp một file `.txt` hoặc `.md` trước. LlamaParse, Cloudinary và PDF là adapter thêm sau. Hợp đồng worker:

1. Đặt `sources.status = PROCESSING`.
2. Tách chữ. Rỗng thì `FAILED`, không ghi passage.
3. Cắt đoạn có overlap. Đoạn rỗng thì bỏ.
4. Xóa passage cũ của source này trước khi insert lô mới, để nạp lại không nhân đôi.
5. Nhúng theo lô (bản gốc dùng 100).
6. Ghi `metadata` tối thiểu: `title`, `fileName`, `uri`, và `locator` nếu extractor có trang hoặc heading.
7. Commit passage và `SUCCESS` trong cùng transaction.
8. Lỗi: rollback passage, transaction khác ghi `FAILED` và `error_message`.

Queue có thể là RabbitMQ như gốc (`queue bền`, consumer gọi processor, exception thì `markFailed`). Một dự án nhỏ có thể dùng job trong database. Đừng lấy queue `curriculum.extraction` hay `quiz.generation`.

### Bước 2. Retriever có phạm vi

Một lớp, một method `search`. Đầu vào bắt buộc `tenantId`, `knowledgeBaseId`, `query`, `limit`. Bên trong: embed câu hỏi bằng **cùng** model bước 1, query SQL mục 9, bỏ passage vượt ngưỡng.

Không dùng `ThreadLocal`. Test hai tenant, cùng nội dung file, hỏi một câu, xác nhận tenant A không nhận passage của tenant B.

Test thứ hai: source `FAILED` hoặc `PROCESSING` không xuất hiện. Bản gốc không có mệnh đề status; bản mới thì có.

### Bước 3. Phiên, chưa cần LLM

`POST /conversations` nhận `knowledgeBaseId` và `title`. `GET` danh sách và tin chỉ trong `(tenant, actor)`. Id của người khác trả 404, để không lộ sự tồn tại. Trần độ dài giữ 1000 nếu chưa có lý do đổi; title 255.

Xóa phiên là xóa tin rồi xóa phiên, một transaction. Bỏ `set_config('app.allow_history_maintenance')` nếu không tạo trigger.

### Bước 4. Một lượt trả lời đồng bộ

Ghép retriever + model + ghi tin, theo mục 8 (hai transaction ngắn, model ở giữa). System prompt đọc từ hồ sơ. Lịch sử lấy từ bảng `messages` của đúng phiên, mới nhất trước, cắt theo ngân sách token, rồi đảo lại thứ tự thời gian.

Citation lưu `{ "passageId", "sourceId", "title", "locator", "text" }`. `passageId` giúp UI mở đúng nguồn mà không phải so khớp chuỗi.

API đồng bộ `POST /conversations/{id}/messages` trả tin trợ lý khi đã ghi xong. Dùng API này để test trước khi làm SSE.

Khi không có passage dưới ngưỡng và hồ sơ là `strict`, không gọi model bằng kho rỗng để nó tự bịa. Trả câu từ chối của hồ sơ, vẫn ghi tin.

### Bước 5. Kênh stream

Giữ bộ sự kiện gốc vì UI nào cũng cần bốn mốc đó:

```json
{ "type": "token", "content": "..." }
{ "type": "citations", "citations": [ ] }
{ "type": "done" }
{ "type": "error", "message": "..." }
```

SSE map sang `event: message|citations|done|error`. Client phải:

- gửi `Authorization: Bearer`
- kiểm tra `response.ok` trước khi đọc stream
- đệm chuỗi đến khi đủ một frame ngăn bởi dòng trống
- xử lý `error` và hủy reader khi rời trang

Nếu chọn STOMP, copy mô hình đích có kiểm tra sở hữu (`OwnedChatDestinationAuthorization`): destination khớp một phiên, và phiên thuộc actor trong tenant. Nhớ bean `csrfChannelInterceptor` nếu stack là Spring Security 7 và HTTP đã tắt CSRF. Relay STOMP cần RabbitMQ plugin `stomp`, và proxy phải chuyển header `Upgrade` trên `/ws`.

Đừng phát token giả bằng cách cắt câu đã sinh xong, trừ khi chỉ cần hiệu ứng chữ. Muốn token thật thì dùng streaming API của nhà cung cấp và ghi database khi stream kết thúc.

### Bước 6. Model và khóa

Tách cấu hình chat khỏi cấu hình embedding. Hai thứ đổi độc lập, nhưng mỗi lần đổi embedding là một lần nạp lại kho.

Phần đáng giữ của `DynamicGeminiChatLanguageModel`: đọc key và tên model lúc gọi, timeout hữu hạn, một lần fallback khi quá tải. Phần phải viết lại: danh sách model cấm (`1.5`, `2.5`) là chuyện endpoint Google của project này. Sản phẩm khác dùng nhà cung cấp khác thì cổng `LanguageModelPort` đổi implementation, orchestration không đổi.

`AiModelResolver` cũng đang phục vụ sinh câu hỏi và chấm bài. Nếu dự án mới chỉ có chatbot, đừng copy resolver nguyên xi chỉ vì chatbot gọi nó.

Thiếu key thì fail rõ ở lần gọi, với thông báo của sản phẩm. Bản gốc nhét key giả để process vẫn boot.

### Bước 7. An toàn và quan sát

Thay `ContentSafetyService`. Đặt chính sách ở biên inbound, và thêm outbound nếu sản phẩm không được lặp lại bí mật trong tài liệu.

Không ghi nguyên văn tin bị chặn vào log ứng dụng. Một mã lý do là đủ.

Log có ích, không chứa nội dung tài liệu: `conversationId`, `knowledgeBaseId`, số passage, khoảng cách nhỏ nhất, latency embed, latency model, model name, kích thước prompt ước tính. SRS mục 10.4 muốn bộ câu vàng và tỷ lệ retrieval đúng. Lập bộ đó trên kho của sản phẩm mới; repo này không có bộ ấy để mang theo.

### Bước 8. UI

Sidebar phiên, vùng tin, ô nhập, popup trích dẫn. Đó là phần giao diện đáng giữ về cấu trúc (`ChatSidebar`, `ChatArea`, `CitationModal`). Bỏ avatar học sinh, modal chọn môn, chuỗi “phiên hỏi đáp môn …”.

Popup trích dẫn đọc đúng khóa metadata mà worker ghi (`title`, `fileName`, `locator`), không đọc `page_label` nếu extractor không sinh khóa đó.

Ô nhập chặn quá 1000 ký tự trước khi gọi API, khớp validation backend.

---

## 11. Ánh xạ tên

| AI Tutor | Bản tái sử dụng |
| --- | --- |
| `ChatController` | `ConversationController` |
| `ChatServiceImpl` | `ConversationService` |
| `ChatStreamProcessor` | `ReplyOrchestrator` |
| `CustomPostgresRetriever` | `PgVectorRetrieval` implements `RetrievalPort` |
| `ChunkEmbeddingService` | `EmbeddingPort` (một implementation) |
| `AiTutorChatAgent` | bỏ interface annotation; `PromptProfile` + `LanguageModelPort` |
| `RagContextHolder` | tham số `RetrievalQuery` |
| `ContentSafetyService` | `SafetyPort` |
| `DocumentIngestionProcessor` | `IngestionWorker` |
| `LatexAwareSplitter` | `TextSplitter` của miền dữ liệu đích |
| `ChatSession` / `chat_sessions` | `Conversation` / `conversations` |
| `ChatMessage` / `STUDENT`,`AI` | `Message` / `USER`,`ASSISTANT` |
| `Document` + `DocumentChunk` | `Source` + `Passage` |
| `subject`, `gradeLevel` | `knowledge_base_id`, `tenant_id` |
| event SSE `message` | giữ, hoặc thống nhất tên `token` với STOMP |

---

## 12. Checklist trước khi gọi là xong

1. Hai tenant, hai kho, cùng một câu hỏi: passage và phiên không lọt qua tenant.
2. Actor A không đọc, không đổi tên, không xóa, không stream phiên của actor B.
3. Source `FAILED` không có passage. Source `SUCCESS` hỏi được. Nạp lại một source thì số passage bằng số đoạn mới, không cộng dồn.
4. Câu xa kho, chế độ `strict`: câu từ chối cố định, không có citation.
5. Câu trong kho: citation chứa `passageId` thật, text khớp passage.
6. Restart process rồi hỏi tiếp: model vẫn thấy lịch sử đã lưu.
7. Chạy hai instance: cùng một phiên không mất lịch sử và không dùng bộ nhớ RAM của instance kia.
8. Pool JDBC không tăng connection đang bận suốt thời gian chờ model (model nằm ngoài transaction).
9. Chiều vector lúc ghi và lúc hỏi bằng chiều cột. Một test boot so sánh `embed` với hằng số.
10. Client stream gửi Bearer, ghép được frame bị cắt, và hiện được sự kiện `error`.
11. Bộ câu của chính sản phẩm: retrieval trúng nguồn kỳ vọng ở mức đội chấp nhận được. Không dùng chỉ số 80% của SRS như một số đã đo trên repo này.

---

## 13. Phụ lục — tham số đang hard-code

| Tham số | Giá trị trong mã | Chỗ |
| --- | --- | --- |
| Trần tin người dùng | 1000 | `ChatRequest`, `ChatStreamProcessor.requireMessage` |
| Trần title | 255 | `ChatServiceImpl.requireTitle` |
| Trần subject | 64 | `requireSubject` |
| Top-K | 5 | `CustomPostgresRetriever` |
| Ngưỡng khoảng cách | không có | cùng file |
| Cửa sổ bộ nhớ | 20 message, RAM | `ChatbotConfig` |
| Timeout SSE | 120000 ms | `ChatServiceImpl` |
| Timeout Gemini | 2 phút | `DynamicGeminiChatLanguageModel` |
| Timeout nhúng | 2 phút | `OllamaEmbeddingConfig` |
| Model nhúng | `bge-m3` | `application.yml` |
| Chiều vector | 1024 | `DocumentChunk`, `V1__init_schema.sql` |
| Cắt đoạn | 1000 ký tự, overlap 150 | `LatexAwareSplitter` |
| Lô nhúng | 100 | `DocumentIngestionProcessor` |
| Temperature seed | 0.7 | `system_settings` |
| Model seed | `gemini-1.5-flash`, runtime rơi về `gemini-flash-lite-latest` | seed + `AiModelResolver` |
| LangChain4j | 0.35.0 | `ai-tutor-service/build.gradle` |

Những số này là điểm chỉnh của sản phẩm gốc, không phải hằng số đúng cho mọi miền.
