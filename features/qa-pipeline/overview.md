# TASK: Self-host Qwen3-VL-2B VLM Server for Automated QA Annotation

You are a senior ML/AI infrastructure engineer.

I want you to help me build a **self-hosted Vision-Language Model (VLM) inference server** for automatically generating labels for an image-based Question Answering (QA) dataset.

Your responsibility is not only to write configuration/code, but to **actually verify that the entire pipeline works end-to-end**.

---

## 1. CONTEXT

### Current machine

* OS: Windows
* GPU: NVIDIA GeForce GTX 1660 Ti
* VRAM: 6 GB
* NVIDIA Driver: 580.88
* CUDA capability exposed by driver: CUDA 13.0
* Docker: Installed and working
* Docker GPU passthrough: VERIFIED

The following command has already been tested successfully:

```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

Therefore, **do not spend time reconfiguring Docker GPU support unless a real problem appears**.

---

# 2. TARGET ARCHITECTURE

The desired architecture is:

```text
                    GPU SERVER
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   Docker Container                                           │
│   ┌──────────────────────────────────────────────────────┐   │
│   │ llama.cpp server                                     │   │
│   │                                                      │   │
│   │ Qwen3-VL-2B                                         │   │
│   │ GGUF Q4_K_M                                         │   │
│   │ + mmproj projector                                  │   │
│   │                                                      │   │
│   │ OpenAI-compatible HTTP API                          │   │
│   └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         │ HTTP :8080                         │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          ▼
                  LOCAL PROCESSING PC
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│ Dataset processing script                                    │
│                                                              │
│  1. Read images                                              │
│  2. Send image + question to VLM API                        │
│  3. Receive structured JSON                                  │
│  4. Save results                                             │
│  5. Resume failed/interrupted jobs                           │
│                                                              │
│                          ↓                                   │
│                  Annotation Dashboard                        │
│                                                              │
│  Image + Question + AI Answer + Metadata                    │
│                    ↓                                         │
│             Human verification/editing                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The server **does NOT need a GUI**.

It only needs to expose a reliable inference API.

---

# 3. TARGET MODEL

Target model:

**Qwen3-VL-2B**

Expected format:

* GGUF
* Quantization: Q4_K_M
* Vision-language model
* Requires the appropriate **multimodal projector / mmproj** file

Important:

Before downloading anything, **verify that the selected Qwen3-VL-2B GGUF and mmproj are actually compatible with the current llama.cpp version**.

Do not assume that a random GGUF repository is compatible.

Check:

1. Model architecture
2. GGUF compatibility
3. Required mmproj
4. llama.cpp support
5. CUDA support
6. VRAM requirements
7. Required context size
8. Image input support
9. OpenAI-compatible API support

If the exact requested combination is technically incompatible, **stop and explain the incompatibility before implementing a broken setup**.

---

# 4. TARGET RUNTIME

Use:

```text
ghcr.io/ggml-org/llama.cpp:server-cuda
```

The server should run inside Docker.

Expected API:

```text
http://<server-ip>:8080
```

Use llama.cpp's **OpenAI-compatible API** where possible.

The final system should support requests conceptually similar to:

```http
POST /v1/chat/completions
```

with:

* text question
* image input
* model inference
* structured JSON response

---

# 5. IMPLEMENTATION PHASES

Implement the system in the following phases.

## PHASE 1 — Workspace

Create a clean project structure.

Suggested structure:

```text
vlm-server/
│
├── docker/
│   ├── docker-compose.yml
│   └── ...
│
├── models/
│   ├── qwen3-vl-2b-q4_k_m.gguf
│   └── mmproj-*.gguf
│
├── data/
│   ├── input/
│   ├── output/
│   └── failed/
│
├── scripts/
│   ├── test_api.py
│   ├── inference.py
│   └── batch_inference.py
│
├── dashboard/
│
├── logs/
│
├── .env.example
├── README.md
└── TODO.md
```

Do not unnecessarily download or duplicate large model files.

Use Docker volumes/bind mounts so that model files persist outside the container.

---

# 6. PHASE 2 — MODEL DOWNLOAD

Find the correct Qwen3-VL-2B GGUF model and corresponding mmproj.

Before downloading:

### Verify

* Is Qwen3-VL-2B supported by llama.cpp?
* Is Q4_K_M available?
* Is the mmproj compatible?
* Are there known limitations?
* Is the model size realistic for 6 GB VRAM?

Prefer authoritative sources and well-maintained repositories.

Do not silently substitute another model.

If a substitution is necessary, explain:

```text
Requested model:
Reason it cannot be used:
Replacement:
Why replacement is appropriate:
```

---

# 7. PHASE 3 — LLAMA.CPP SERVER

Create the Docker configuration.

Requirements:

* GPU enabled
* CUDA backend enabled
* Model mounted from host
* mmproj mounted from host
* Port 8080 exposed
* Restart policy configured
* Logs accessible
* No unnecessary GUI

Example conceptual configuration:

```yaml
services:
  vlm:
    image: ghcr.io/ggml-org/llama.cpp:server-cuda
    ports:
      - "8080:8080"
    volumes:
      - ./models:/models
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
```

However, **do not blindly copy this configuration**.

Determine the correct llama.cpp command-line arguments for:

* model
* mmproj
* context size
* GPU layers
* batch size
* parallel requests
* host
* port
* image/vision support

Tune them conservatively for a **6 GB GPU**.

The priority is:

```text
STABILITY > QUALITY > THROUGHPUT
```

Do not maximize GPU utilization at the cost of crashes/OOM.

---

# 8. PHASE 4 — GPU VERIFICATION

After starting the container, verify:

```bash
docker ps
```

Then inspect logs.

Verify:

```text
Model loaded successfully
Vision projector loaded successfully
CUDA backend initialized
GPU detected
Server listening on port 8080
```

Also verify GPU memory usage with:

```bash
nvidia-smi
```

Record:

* VRAM before model
* VRAM after model
* approximate VRAM usage during inference

If the model causes OOM:

1. Reduce context size
2. Reduce batch size
3. Reduce parallelism
4. Reduce GPU offloading if necessary
5. Re-evaluate model/quantization

Do not immediately switch models.

---

# 9. PHASE 5 — API TEST

Create:

```text
scripts/test_api.py
```

The script must:

1. Load a local test image
2. Send it to the server
3. Ask a simple visual question
4. Receive the response
5. Print latency
6. Print the generated answer
7. Return a non-zero exit code if inference fails

Example conceptual request:

```text
Image:
traffic accident image

Question:
"What vehicles are visible in the image?"
```

Test both:

```text
server health
+
actual multimodal inference
```

A server returning HTTP 200 is **not sufficient**.

The image must actually be processed by the vision encoder.

---

# 10. PHASE 6 — STRUCTURED QA OUTPUT

The primary use case is dataset annotation.

Therefore, do not design the API only around free-form text.

Design the inference prompt/output so that the model returns structured data such as:

```json
{
  "question": "...",
  "answer": "...",
  "confidence": 0.0,
  "reasoning": "...",
  "metadata": {
    "model": "Qwen3-VL-2B",
    "timestamp": "...",
    "latency_ms": 0
  }
}
```

However:

**Do NOT expose chain-of-thought or hidden reasoning.**

If additional explanation is useful, use a short:

```text
evidence
```

or:

```text
answer_basis
```

field containing concise observable evidence from the image.

The system should prioritize:

```text
correctness
structured output
parseability
reproducibility
```

---

# 11. PHASE 7 — BATCH DATASET INFERENCE

Create:

```text
scripts/batch_inference.py
```

Requirements:

### Input

A directory such as:

```text
data/input/
```

containing:

```text
image_001.jpg
image_002.jpg
image_003.jpg
...
```

and QA records.

Prefer a dataset format such as:

```json
[
  {
    "id": "001",
    "image": "image_001.jpg",
    "question": "What happened in the image?"
  }
]
```

### Output

Generate:

```text
data/output/results.jsonl
```

Each line should contain one inference result.

Example:

```json
{
  "id": "001",
  "image": "image_001.jpg",
  "question": "What happened in the image?",
  "answer": "...",
  "status": "success",
  "latency_ms": 1234
}
```

---

# 12. IMPORTANT: RESUMABLE INFERENCE

The dataset may contain thousands of samples.

Therefore the batch system must be **fault tolerant**.

Implement:

* checkpointing
* retry
* timeout
* failed sample logging
* resume capability
* duplicate prevention
* incremental output

For example:

```text
results.jsonl
failed.jsonl
```

If the process stops at sample 500:

```bash
python batch_inference.py
```

should continue from approximately sample 501 instead of reprocessing everything.

---

# 13. CONCURRENCY

Do not immediately implement aggressive parallel inference.

First establish:

```text
1 request
→ stable
→ measure latency
→ measure VRAM
```

Then test:

```text
2 concurrent requests
```

Only increase concurrency if GPU memory and latency remain acceptable.

The goal is to determine the optimal:

```text
throughput = samples / second
```

without causing:

```text
CUDA OOM
timeouts
server crashes
```

---

# 14. DATA TRANSFER

The initial architecture says:

```text
Local PC
   ↓
Upload dataset
   ↓
GPU server
```

Do not unnecessarily implement a custom upload server.

Prefer a simple and reliable mechanism such as:

```text
shared folder
rsync
SCP
network drive
```

depending on the actual environment.

The inference API should ideally receive image data directly.

For the first version, keep the architecture simple:

```text
Local dataset
      ↓
Python client
      ↓
HTTP API
      ↓
VLM server
      ↓
JSON result
      ↓
Local results
```

Only introduce dataset-upload infrastructure if it is genuinely necessary.

---

# 15. PHASE 8 — ANNOTATION DASHBOARD

After inference works reliably, create a lightweight dashboard.

The dashboard should display:

```text
┌────────────────────────────────────────────┐
│ Image                                      │
│                                            │
│              [ IMAGE ]                     │
│                                            │
├────────────────────────────────────────────┤
│ Question                                   │
│ What happened in this image?               │
│                                            │
│ AI Answer                                  │
│ A motorcycle collided with a car...        │
│                                            │
│ Evidence                                   │
│ Visible collision between two vehicles.    │
│                                            │
│ [✓ Accept] [Edit] [✗ Reject]               │
└────────────────────────────────────────────┘
```

Annotator actions:

```text
ACCEPT
EDIT
REJECT
NEXT
PREVIOUS
```

Save annotation status.

Example:

```json
{
  "id": "001",
  "ai_answer": "...",
  "final_answer": "...",
  "annotation_status": "accepted",
  "annotator_modified": false
}
```

Do not over-engineer the dashboard.

A simple local web application is sufficient for V1.

---

# 16. OBSERVABILITY

Add basic metrics.

For each inference record:

```text
request_id
image_id
model
latency_ms
status
error
timestamp
```

Track:

```text
total samples
successful samples
failed samples
average latency
P50 latency
P95 latency
throughput
GPU memory
```

This will allow us to evaluate whether the VLM is practical for dataset annotation.

---

# 17. SECURITY

The API may eventually be accessed from another machine.

Therefore:

* Do not expose the API publicly by default.
* Bind it to the required network interface only.
* Avoid hardcoding credentials.
* Document firewall/network requirements.
* If authentication is not provided by llama.cpp, explicitly document that the API should remain behind a trusted network/VPN.

For local development, simple LAN access is acceptable.

---

# 18. ERROR HANDLING

The implementation must explicitly handle:

```text
HTTP errors
connection refused
timeout
invalid image
unsupported image format
malformed JSON
model loading failure
CUDA OOM
server crash
empty model response
rate/concurrency issues
```

Never silently discard failed samples.

---

# 19. VALIDATION CHECKLIST

The implementation is NOT considered complete until all of these pass.

### Infrastructure

* [ ] Docker GPU access works
* [ ] Container starts
* [ ] llama.cpp starts
* [ ] CUDA backend works
* [ ] GPU is used
* [ ] Model loads
* [ ] mmproj loads
* [ ] API responds

### Vision

* [ ] Text-only request works
* [ ] Image request works
* [ ] Model actually interprets image
* [ ] JSON output can be parsed

### Dataset

* [ ] Single sample inference works
* [ ] Batch inference works
* [ ] Results are persisted
* [ ] Failed samples are logged
* [ ] Retry works
* [ ] Resume works
* [ ] Duplicate inference is avoided

### Performance

* [ ] Latency measured
* [ ] VRAM measured
* [ ] Throughput measured
* [ ] Concurrency tested conservatively

### Dashboard

* [ ] Image displayed
* [ ] Question displayed
* [ ] AI answer displayed
* [ ] Annotator can edit
* [ ] Annotator can accept/reject
* [ ] Final annotation persisted

---

# 20. DOCUMENTATION

Create a comprehensive:

```text
README.md
```

It must explain exactly how to:

### Start server

```bash
docker compose up -d
```

### Check logs

```bash
docker compose logs -f
```

### Test API

```bash
python scripts/test_api.py
```

### Run batch inference

```bash
python scripts/batch_inference.py
```

### Start dashboard

Document the actual command after implementation.

Also document:

* model download
* directory structure
* configuration
* environment variables
* GPU requirements
* troubleshooting
* CUDA OOM
* API usage
* dataset format
* output format
* resume behavior

---

# 21. TODO.md

Maintain:

```text
TODO.md
```

with three categories:

## DONE

Completed and verified tasks.

## TODO

Remaining tasks.

## BLOCKED

Tasks blocked by:

* model incompatibility
* hardware limitations
* llama.cpp limitations
* missing dependencies
* network limitations

Never mark a task DONE unless it has actually been tested.

---

# 22. ENGINEERING PRINCIPLES

Follow these principles throughout the implementation:

### 1. Verify before assuming

Do not assume:

```text
"Qwen3-VL + llama.cpp should work"
```

Verify it.

### 2. Smallest working system first

First achieve:

```text
Docker
 ↓
llama.cpp
 ↓
Qwen3-VL
 ↓
image
 ↓
answer
```

Only after this works should you build:

```text
batch inference
 ↓
checkpointing
 ↓
dashboard
```

### 3. Avoid unnecessary complexity

Do not introduce:

* Kubernetes
* Redis
* Celery
* databases
* object storage
* message queues

unless there is a demonstrated need.

This is a single-GPU annotation server.

### 4. Preserve reproducibility

Pin/document:

```text
Docker image
model version
model hash if available
configuration
Python dependencies
```

### 5. Optimize only after measuring

Do not optimize based on assumptions.

Measure:

```text
VRAM
latency
throughput
error rate
```

first.

---

# 23. IMPORTANT HARDWARE CONSTRAINT

The system has only:

```text
GTX 1660 Ti
6 GB VRAM
```

Therefore, treat VRAM as the primary constraint.

Before changing architecture, investigate:

```text
model VRAM
KV cache
context length
vision encoder memory
CUDA overhead
batch size
GPU offloading
```

If Qwen3-VL-2B Q4_K_M cannot reliably run within 6 GB VRAM with the required vision components, report the bottleneck clearly and propose the **smallest viable change**.

Do not silently replace the model.

---

# 24. EXECUTION STRATEGY

Work iteratively.

For every phase:

```text
IMPLEMENT
   ↓
RUN
   ↓
VERIFY
   ↓
RECORD RESULT
   ↓
FIX IF FAILED
   ↓
CONTINUE
```

Do not simply generate all files and claim success.

I want an **actually working system**, not a theoretical configuration.

At the end, report:

```text
1. What was implemented
2. What was successfully tested
3. Exact commands to run the system
4. Model/version used
5. VRAM usage
6. Average inference latency
7. Throughput
8. Known limitations
9. Remaining TODOs
10. Recommended next step
```

If you encounter an incompatibility, **do not hide it or work around it silently**. Explain the technical reason and wait for/choose the smallest justified alternative.
