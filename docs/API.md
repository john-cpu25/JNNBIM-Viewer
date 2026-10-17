# JNN BIM Viewer — REST API & Integration Specification
**Document ID:** JNN-DOC-API-001  
**Version:** 1.0.0  
**Backend:** ASP.NET Core .NET 10 Web API (`services/Jnn.Api`)  

---

## 1. Core Endpoints

### 1.1 Projects & Models
- `GET /api/v1/projects`: List active projects with metadata and revision counts.
- `GET /api/v1/projects/{projectId}/models`: List federated models in project.
- `POST /api/v1/projects/{projectId}/models/import`: Upload and initiate ingestion pipeline for `.ifc`, `.rvt`, `.nwc`.
- `GET /api/v1/models/{modelId}/revisions/{revisionId}`: Fetch model manifest, storey hierarchy, and geometry cache stream URLs.
- `GET /api/v1/models/{modelId}/elements/{elementId}`: Fetch comprehensive structural property sets and native parameters.

### 1.2 Clash Detection
- `GET /api/v1/clash/tests?projectId={id}`: List defined clash tests.
- `POST /api/v1/clash/tests`: Create a new clash test (Selection Set A, Selection Set B, Tolerance).
- `POST /api/v1/clash/tests/{testId}/run`: Queue background broad/narrow-phase clash analysis.
- `GET /api/v1/clash/tests/{testId}/results`: Paginated clash items with statuses, coordinates, and element metadata.
- `PATCH /api/v1/clash/results/{clashId}`: Update clash status (`New` -> `Reviewed` -> `Approved` / `Resolved`), assignee, and notes.

### 1.3 Quantity Takeoff
- `GET /api/v1/quantity/summary?projectId={id}&modelId={id}`: Aggregated concrete volumes and formwork areas grouped by level and category.
- `GET /api/v1/quantity/export?format=xlsx|csv`: Download takeoff spreadsheet.

### 1.4 BCF & Issues
- `GET /api/v1/bcf/topics?projectId={id}`: Fetch BCF 2.1/3.0 topics with viewpoint JSON and screenshots.
- `POST /api/v1/bcf/topics`: Create new coordination issue with camera viewpoint snapshot.
- `POST /api/v1/bcf/topics/{topicId}/comments`: Add coordination comment with user attribution.

---

## 2. WebSocket / SignalR Realtime Hub
- Endpoint: `/hubs/bim-coordination`
- Events:
  - `ModelProcessingProgress`: Emits pipeline status (percent, stage, log message).
  - `ClashJobCompleted`: Notifies client that clash detection results are ready.
  - `IssueUpdated`: Broadcasts status updates in collaborative review sessions.
