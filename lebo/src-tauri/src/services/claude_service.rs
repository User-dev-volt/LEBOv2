use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use crate::services::prompts::OPTIMIZATION_SYSTEM_PROMPT;

pub const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
pub const CLAUDE_MODEL: &str = "claude-sonnet-4-6";
pub const TIMEOUT_SECS: u64 = 45;
pub const MAX_NDJSON_LINE_BYTES: usize = 65_536;

// ── Request structs ──────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ClaudeMessage {
    role: &'static str,
    content: String,
}

#[derive(Serialize)]
struct ClaudeRequest {
    model: &'static str,
    max_tokens: u32,
    stream: bool,
    system: String,
    messages: Vec<ClaudeMessage>,
}

// ── Response structs (SSE parsing) ───────────────────────────────────────────

#[derive(Deserialize)]
struct SseDelta {
    #[serde(rename = "type")]
    delta_type: String,
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
struct SseEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    delta: Option<SseDelta>,
}

// ── Parsed suggestion from one NDJSON line ───────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SuggestionEvent {
    pub rank: u32,
    pub from_node_id: Option<String>,
    pub to_node_id: String,
    pub points_change: i32,
    pub explanation: String,
}

// ── Tauri event payloads ─────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct SuggestionReceivedPayload {
    pub rank: u32,
    pub from_node_id: Option<String>,
    pub to_node_id: String,
    pub points_change: i32,
    pub explanation: String,
}

#[derive(Serialize, Clone)]
pub struct OptimizationCompletePayload {
    pub suggestion_count: u32,
}

#[derive(Serialize, Clone)]
pub struct OptimizationErrorPayload {
    pub error_type: String,
    pub message: String,
}

impl From<&SuggestionEvent> for SuggestionReceivedPayload {
    fn from(s: &SuggestionEvent) -> Self {
        SuggestionReceivedPayload {
            rank: s.rank,
            from_node_id: s.from_node_id.clone(),
            to_node_id: s.to_node_id.clone(),
            points_change: s.points_change,
            explanation: s.explanation.clone(),
        }
    }
}

// ── System prompt ────────────────────────────────────────────────────────────

pub fn build_system_prompt() -> String {
    OPTIMIZATION_SYSTEM_PROMPT.to_string()
}

// ── Main streaming function ───────────────────────────────────────────────────

pub async fn stream_optimization(
    app_handle: &tauri::AppHandle,
    api_key: &str,
    user_message: String,
) -> Result<(), String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("NETWORK_ERROR: failed to build HTTP client: {}", e))?;

    let request_body = ClaudeRequest {
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        stream: true,
        system: build_system_prompt(),
        messages: vec![ClaudeMessage {
            role: "user",
            content: user_message,
        }],
    };

    let send_result = client
        .post(CLAUDE_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await;

    let response = match send_result {
        Ok(r) => r,
        Err(e) => {
            return Err(if e.is_timeout() {
                format!("TIMEOUT: request exceeded {} seconds", TIMEOUT_SECS)
            } else {
                format!("NETWORK_ERROR: {}", e)
            });
        }
    };

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(match status.as_u16() {
            401 => "AUTH_ERROR: invalid API key".to_string(),
            429 => "API_ERROR: rate limit reached — wait a moment and retry".to_string(),
            _ => format!("API_ERROR: Claude API server error (HTTP {}): {}", status, body),
        });
    }

    let mut stream = response.bytes_stream();
    // sse_buffer accumulates raw bytes until a \n\n SSE frame boundary
    let mut sse_buffer = String::new();
    // ndjson_buffer accumulates assistant text deltas until a \n suggestion boundary
    let mut ndjson_buffer = String::new();
    let mut suggestion_count: u32 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result
            .map_err(|e| format!("NETWORK_ERROR: stream read error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        sse_buffer.push_str(&text);

        // Process complete SSE frames (terminated by \n\n)
        while let Some(frame_end) = sse_buffer.find("\n\n") {
            let frame = sse_buffer[..frame_end].to_string();
            sse_buffer = sse_buffer[frame_end + 2..].to_string();

            if let Some(text_delta) = extract_text_delta(&frame) {
                ndjson_buffer.push_str(&text_delta);

                if ndjson_buffer.len() > MAX_NDJSON_LINE_BYTES {
                    return Err("PARSE_ERROR: NDJSON line exceeded 64KB limit".to_string());
                }

                // Parse any complete lines in the ndjson_buffer
                while let Some(newline_pos) = ndjson_buffer.find('\n') {
                    let line = ndjson_buffer[..newline_pos].trim().to_string();
                    ndjson_buffer = ndjson_buffer[newline_pos + 1..].to_string();

                    if line.is_empty() {
                        continue;
                    }

                    match serde_json::from_str::<SuggestionEvent>(&line) {
                        Ok(suggestion) => {
                            suggestion_count += 1;
                            let payload = SuggestionReceivedPayload::from(&suggestion);
                            app_handle
                                .emit("optimization:suggestion-received", &payload)
                                .map_err(|e| format!("APP_ERROR: emit failed: {}", e))?;
                        }
                        Err(e) => {
                            // Non-fatal: Claude may emit incomplete lines mid-stream.
                            // Only error on lines that look like they should be complete JSON.
                            if line.starts_with('{') && line.ends_with('}') {
                                return Err(format!("PARSE_ERROR: malformed suggestion JSON: {}", e));
                            }
                        }
                    }
                }
            } else if is_message_stop(&frame) {
                // Flush any remaining buffer content
                let remaining = ndjson_buffer.trim().to_string();
                ndjson_buffer.clear();
                if !remaining.is_empty() {
                    match serde_json::from_str::<SuggestionEvent>(&remaining) {
                        Ok(suggestion) => {
                            suggestion_count += 1;
                            let payload = SuggestionReceivedPayload::from(&suggestion);
                            let _ = app_handle.emit("optimization:suggestion-received", &payload);
                        }
                        Err(e) => {
                            let _ = emit_error(
                                app_handle,
                                &format!("PARSE_ERROR: malformed final suggestion: {}", e),
                            );
                            return Err(format!("PARSE_ERROR: malformed final suggestion: {}", e));
                        }
                    }
                }

                app_handle
                    .emit(
                        "optimization:complete",
                        &OptimizationCompletePayload { suggestion_count },
                    )
                    .map_err(|e| format!("APP_ERROR: emit complete failed: {}", e))?;
                return Ok(());
            }
        }
    }

    // Stream ended without message_stop — treat remaining buffer as final attempt
    let remaining = ndjson_buffer.trim().to_string();
    if !remaining.is_empty() {
        if let Ok(suggestion) = serde_json::from_str::<SuggestionEvent>(&remaining) {
            suggestion_count += 1;
            let payload = SuggestionReceivedPayload::from(&suggestion);
            let _ = app_handle.emit("optimization:suggestion-received", &payload);
        }
    }

    app_handle
        .emit(
            "optimization:complete",
            &OptimizationCompletePayload { suggestion_count },
        )
        .map_err(|e| format!("APP_ERROR: emit complete failed: {}", e))?;

    Ok(())
}

// ── SSE frame helpers ────────────────────────────────────────────────────────

fn extract_text_delta(frame: &str) -> Option<String> {
    let data_line = frame
        .lines()
        .find(|l| l.starts_with("data: "))?;
    let json_str = &data_line["data: ".len()..];
    let event: SseEvent = serde_json::from_str(json_str).ok()?;

    if event.event_type != "content_block_delta" {
        return None;
    }

    let delta = event.delta?;
    if delta.delta_type != "text_delta" {
        return None;
    }

    Some(delta.text)
}

fn is_message_stop(frame: &str) -> bool {
    frame.lines().any(|l| l.starts_with("data: ")).then(|| {
        let data_line = frame.lines().find(|l| l.starts_with("data: "))?;
        let json_str = &data_line["data: ".len()..];
        let event: SseEvent = serde_json::from_str(json_str).ok()?;
        if event.event_type == "message_stop" { Some(()) } else { None }
    }).flatten().is_some()
}

fn emit_error(app_handle: &tauri::AppHandle, message: &str) -> Result<(), String> {
    let (error_type, msg) = if let Some(rest) = message.strip_prefix("AUTH_ERROR: ") {
        ("AUTH_ERROR", rest.to_string())
    } else if let Some(rest) = message.strip_prefix("API_ERROR: ") {
        ("API_ERROR", rest.to_string())
    } else if let Some(rest) = message.strip_prefix("NETWORK_ERROR: ") {
        ("NETWORK_ERROR", rest.to_string())
    } else if let Some(rest) = message.strip_prefix("TIMEOUT: ") {
        ("TIMEOUT", rest.to_string())
    } else if let Some(rest) = message.strip_prefix("PARSE_ERROR: ") {
        ("PARSE_ERROR", rest.to_string())
    } else {
        ("UNKNOWN", message.to_string())
    };

    app_handle
        .emit(
            "optimization:error",
            &OptimizationErrorPayload {
                error_type: error_type.to_string(),
                message: msg,
            },
        )
        .map_err(|e| format!("APP_ERROR: emit error failed: {}", e))
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_suggestion_ndjson() {
        let line = r#"{"rank":1,"from_node_id":"node_a","to_node_id":"node_b","points_change":2,"explanation":"Test explanation."}"#;
        let s: SuggestionEvent = serde_json::from_str(line).unwrap();
        assert_eq!(s.rank, 1);
        assert_eq!(s.from_node_id.as_deref(), Some("node_a"));
        assert_eq!(s.to_node_id, "node_b");
        assert_eq!(s.points_change, 2);
    }

    #[test]
    fn parses_suggestion_with_null_from_node() {
        let line = r#"{"rank":2,"from_node_id":null,"to_node_id":"node_c","points_change":1,"explanation":"Pure addition."}"#;
        let s: SuggestionEvent = serde_json::from_str(line).unwrap();
        assert_eq!(s.rank, 2);
        assert!(s.from_node_id.is_none());
    }

    #[test]
    fn extracts_text_delta_from_sse_frame() {
        let frame = "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"hello\"}}";
        let result = extract_text_delta(frame);
        assert_eq!(result, Some("hello".to_string()));
    }

    #[test]
    fn returns_none_for_non_delta_events() {
        let frame = "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{}}";
        assert!(extract_text_delta(frame).is_none());
    }

    #[test]
    fn detects_message_stop_frame() {
        let frame = "event: message_stop\ndata: {\"type\":\"message_stop\"}";
        assert!(is_message_stop(frame));
    }

    #[test]
    fn does_not_detect_non_stop_frame_as_stop() {
        let frame = "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"x\"}}";
        assert!(!is_message_stop(frame));
    }

    #[test]
    fn rejects_malformed_ndjson_that_looks_complete() {
        let bad_line = "{bad json}";
        let result = serde_json::from_str::<SuggestionEvent>(bad_line);
        assert!(result.is_err());
        // Verify the starts_with/ends_with guard in stream_optimization would trigger
        assert!(bad_line.starts_with('{') && bad_line.ends_with('}'));
    }

    #[test]
    fn ndjson_buffer_splits_on_newline_correctly() {
        let input = "{\"rank\":1,\"from_node_id\":null,\"to_node_id\":\"n1\",\"points_change\":1,\"explanation\":\"e1\"}\n{\"rank\":2,\"from_node_id\":null,\"to_node_id\":\"n2\",\"points_change\":1,\"explanation\":\"e2\"}\n";
        let lines: Vec<&str> = input.split('\n').filter(|l| !l.is_empty()).collect();
        assert_eq!(lines.len(), 2);
        for line in lines {
            let result = serde_json::from_str::<SuggestionEvent>(line);
            assert!(result.is_ok(), "Failed to parse: {}", line);
        }
    }
}
