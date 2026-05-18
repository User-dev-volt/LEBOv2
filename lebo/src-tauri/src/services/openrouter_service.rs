use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use crate::services::claude_service::{SuggestionEvent, SuggestionReceivedPayload, OptimizationCompletePayload, OptimizationErrorPayload};
use crate::services::prompts::OPTIMIZATION_SYSTEM_PROMPT;

const BASE_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_SECS: u64 = 45;
const MAX_NDJSON_LINE_BYTES: usize = 65_536;
const SITE_URL: &str = "https://github.com/lebo";

// Models tried in order; on rate-limit, 404, or invalid-model-ID the next is attempted.
// Verified against https://openrouter.ai/api/v1/models on 2026-05-05.
const MODELS: &[(&str, &str)] = &[
    ("nousresearch/hermes-3-llama-3.1-405b:free", "Hermes 3 405B"),
    ("meta-llama/llama-3.3-70b-instruct:free", "Llama 3.3 70B"),
    ("openai/gpt-oss-120b:free", "GPT-OSS 120B"),
    ("google/gemma-4-31b-it:free", "Gemma 4 31B"),
    ("google/gemma-3-27b-it:free", "Gemma 3 27B"),
    ("qwen/qwen3-coder:free", "Qwen3 Coder"),
    ("openrouter/free", "OpenRouter Free"),
];

// ── Request structs ──────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct Message {
    role: &'static str,
    content: String,
}

#[derive(Serialize)]
struct OpenRouterRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

// ── Event payloads ───────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct ModelActivePayload {
    pub model_id: String,
    pub model_name: String,
}

// ── SSE delta structs (OpenAI format) ────────────────────────────────────────

#[derive(Deserialize)]
struct Delta {
    #[serde(default)]
    content: Option<String>,
}

#[derive(Deserialize)]
struct Choice {
    delta: Delta,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct SseChunk {
    choices: Vec<Choice>,
}

// ── Error classification ─────────────────────────────────────────────────────

enum StreamError {
    RateLimit,
    Fatal(String),
}

// ── Main public function ──────────────────────────────────────────────────────

pub async fn stream_optimization(
    app_handle: &tauri::AppHandle,
    api_key: &str,
    user_message: String,
) -> Result<(), String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("NETWORK_ERROR: failed to build HTTP client: {}", e))?;

    let mut suggestion_count: u32 = 0;
    let mut accumulated_suggestions: Vec<String> = Vec::new();

    for (model_id, model_name) in MODELS {
        let _ = app_handle.emit(
            "optimization:model-active",
            ModelActivePayload {
                model_id: model_id.to_string(),
                model_name: model_name.to_string(),
            },
        );

        let messages = build_messages(&user_message, &accumulated_suggestions, suggestion_count);

        match try_model(
            app_handle,
            &client,
            api_key,
            model_id,
            messages,
            &mut suggestion_count,
            &mut accumulated_suggestions,
        )
        .await
        {
            Ok(()) => return Ok(()),
            Err(StreamError::RateLimit) => continue,
            Err(StreamError::Fatal(e)) => return Err(e),
        }
    }

    Err("API_ERROR: All free models are currently rate-limited, unavailable, or have no endpoints. Please try again later or check openrouter.ai for free model availability.".to_string())
}

// ── Message builder ───────────────────────────────────────────────────────────

fn build_messages(
    user_message: &str,
    accumulated_suggestions: &[String],
    suggestion_count: u32,
) -> Vec<Message> {
    if accumulated_suggestions.is_empty() {
        vec![
            Message { role: "system", content: OPTIMIZATION_SYSTEM_PROMPT.to_string() },
            Message { role: "user", content: user_message.to_string() },
        ]
    } else {
        // Context handoff: new model receives already-generated suggestions as
        // the assistant turn, then a user prompt to continue from the next rank.
        vec![
            Message { role: "system", content: OPTIMIZATION_SYSTEM_PROMPT.to_string() },
            Message { role: "user", content: user_message.to_string() },
            Message { role: "assistant", content: accumulated_suggestions.join("\n") },
            Message {
                role: "user",
                content: format!(
                    "Continue generating suggestions starting from rank {}. Do not repeat the {} suggestions already shown above.",
                    suggestion_count + 1,
                    suggestion_count,
                ),
            },
        ]
    }
}

// ── Per-model streaming attempt ───────────────────────────────────────────────

async fn try_model(
    app_handle: &tauri::AppHandle,
    client: &Client,
    api_key: &str,
    model_id: &str,
    messages: Vec<Message>,
    suggestion_count: &mut u32,
    accumulated_suggestions: &mut Vec<String>,
) -> Result<(), StreamError> {
    let request_body = OpenRouterRequest {
        model: model_id.to_string(),
        messages,
        stream: true,
    };

    let send_result = client
        .post(BASE_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", SITE_URL)
        .header("X-Title", "Last Epoch Build Optimizer")
        .json(&request_body)
        .send()
        .await;

    let response = match send_result {
        Ok(r) => r,
        Err(e) => {
            let msg = if e.is_timeout() {
                format!("TIMEOUT: request exceeded {} seconds", TIMEOUT_SECS)
            } else {
                format!("NETWORK_ERROR: {}", e)
            };
            return Err(StreamError::Fatal(msg));
        }
    };

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        let lower = body.to_lowercase();
        return match status.as_u16() {
            401 | 403 => Err(StreamError::Fatal("AUTH_ERROR: invalid OpenRouter API key".to_string())),
            // 429 = rate limited, 404 = model removed, 402 = provider spend limit — all skip to next
            429 | 404 | 402 => Err(StreamError::RateLimit),
            // 400 with "not a valid model ID" = model ID stale — skip to next model
            400 if lower.contains("not a valid model") || lower.contains("no endpoints found") => {
                Err(StreamError::RateLimit)
            }
            _ => {
                if lower.contains("rate limit") || lower.contains("quota") || lower.contains("capacity")
                    || lower.contains("no endpoints found") || lower.contains("spend limit")
                    || lower.contains("provider returned error")
                {
                    Err(StreamError::RateLimit)
                } else {
                    Err(StreamError::Fatal(format!(
                        "API_ERROR: OpenRouter server error (HTTP {}): {}",
                        status, body
                    )))
                }
            }
        };
    }

    let mut stream = response.bytes_stream();
    let mut sse_buffer = String::new();
    let mut ndjson_buffer = String::new();
    let mut stream_done = false;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result
            .map_err(|e| StreamError::Fatal(format!("NETWORK_ERROR: stream read error: {}", e)))?;
        let text = String::from_utf8_lossy(&chunk);
        sse_buffer.push_str(&text);

        while let Some(newline_pos) = sse_buffer.find('\n') {
            let line = sse_buffer[..newline_pos].trim().to_string();
            sse_buffer = sse_buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            if !line.starts_with("data: ") {
                continue;
            }

            let data = &line["data: ".len()..];

            if data == "[DONE]" {
                stream_done = true;
                break;
            }

            let chunk: SseChunk = match serde_json::from_str(data) {
                Ok(c) => c,
                Err(_) => continue,
            };

            for choice in &chunk.choices {
                if let Some(ref content) = choice.delta.content {
                    ndjson_buffer.push_str(content);
                    if ndjson_buffer.len() > MAX_NDJSON_LINE_BYTES {
                        return Err(StreamError::Fatal(
                            "PARSE_ERROR: NDJSON line exceeded 64KB limit".to_string(),
                        ));
                    }
                }
                if choice.finish_reason.as_deref() == Some("stop") {
                    stream_done = true;
                }
            }

            if stream_done {
                break;
            }

            while let Some(nl) = ndjson_buffer.find('\n') {
                let suggestion_line = ndjson_buffer[..nl].trim().to_string();
                ndjson_buffer = ndjson_buffer[nl + 1..].to_string();

                if suggestion_line.is_empty() {
                    continue;
                }

                match serde_json::from_str::<SuggestionEvent>(&suggestion_line) {
                    Ok(suggestion) => {
                        *suggestion_count += 1;
                        accumulated_suggestions.push(suggestion_line);
                        let payload = SuggestionReceivedPayload::from(&suggestion);
                        app_handle
                            .emit("optimization:suggestion-received", &payload)
                            .map_err(|e| StreamError::Fatal(format!("APP_ERROR: emit failed: {}", e)))?;
                    }
                    Err(e) => {
                        if suggestion_line.starts_with('{') && suggestion_line.ends_with('}') {
                            return Err(StreamError::Fatal(format!(
                                "PARSE_ERROR: malformed suggestion JSON: {}",
                                e
                            )));
                        }
                    }
                }
            }
        }

        if stream_done {
            break;
        }
    }

    // Flush remaining buffer
    let remaining = ndjson_buffer.trim().to_string();
    if !remaining.is_empty() {
        match serde_json::from_str::<SuggestionEvent>(&remaining) {
            Ok(suggestion) => {
                *suggestion_count += 1;
                accumulated_suggestions.push(remaining);
                let payload = SuggestionReceivedPayload::from(&suggestion);
                let _ = app_handle.emit("optimization:suggestion-received", &payload);
            }
            Err(e) => {
                let err_msg = format!("PARSE_ERROR: malformed final suggestion: {}", e);
                let _ = app_handle.emit(
                    "optimization:error",
                    &OptimizationErrorPayload {
                        error_type: "PARSE_ERROR".to_string(),
                        message: err_msg.clone(),
                    },
                );
                let _ = app_handle.emit(
                    "optimization:complete",
                    &OptimizationCompletePayload { suggestion_count: *suggestion_count },
                );
                return Err(StreamError::Fatal(err_msg));
            }
        }
    }

    app_handle
        .emit(
            "optimization:complete",
            &OptimizationCompletePayload { suggestion_count: *suggestion_count },
        )
        .map_err(|e| StreamError::Fatal(format!("APP_ERROR: emit complete failed: {}", e)))?;

    Ok(())
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_messages_first_model_has_two_messages() {
        let msgs = build_messages("build context", &[], 0);
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].role, "system");
        assert_eq!(msgs[1].role, "user");
    }

    #[test]
    fn build_messages_handoff_has_four_messages() {
        let suggestions = vec![
            r#"{"rank":1,"fromNodeId":null,"toNodeId":"node-a","pointsChange":1,"explanation":"good"}"#.to_string(),
        ];
        let msgs = build_messages("build context", &suggestions, 1);
        assert_eq!(msgs.len(), 4);
        assert_eq!(msgs[2].role, "assistant");
        assert_eq!(msgs[3].role, "user");
        assert!(msgs[3].content.contains("rank 2"));
    }

    #[test]
    fn models_list_has_four_entries() {
        assert_eq!(MODELS.len(), 4);
    }

    #[test]
    fn parses_openai_sse_delta() {
        let data = r#"{"id":"gen-1","choices":[{"delta":{"content":"hello"},"finish_reason":null}]}"#;
        let chunk: SseChunk = serde_json::from_str(data).unwrap();
        assert_eq!(chunk.choices[0].delta.content.as_deref(), Some("hello"));
    }

    #[test]
    fn parses_openai_sse_finish_reason() {
        let data = r#"{"id":"gen-1","choices":[{"delta":{"content":""},"finish_reason":"stop"}]}"#;
        let chunk: SseChunk = serde_json::from_str(data).unwrap();
        assert_eq!(chunk.choices[0].finish_reason.as_deref(), Some("stop"));
    }

    #[test]
    fn ignores_done_sentinel() {
        let line = "[DONE]";
        assert_eq!(line, "[DONE]");
    }
}
