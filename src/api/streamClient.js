// 流式聊天客户端：使用 fetch + ReadableStream 增量解码
// 协议依据后端：Content-Type: text/event-stream，但数据为纯文本块（非标准 SSE data: 前缀），结尾以 [DONE] 结束，错误以 [ERROR] 开头
// 参考后端实现：见 deepseek-flask-api/services/chat_service.py 的 stream_chat() / stream_headers()
//
// 用法：
// streamChat(
//   { message: '你好', system_message: '你是有帮助的助手', stream: true },
//   {
//     onToken: (t) => { /* UI增量渲染 */ },
//     onDone: () => { /* 完成 */ },
//     onError: (msg) => { /* 错误提示 */ },
//     signal: AbortSignal // 可选，用于取消
//   }
// );
export async function streamChat(payload = {}, handlers = {}) {
  const {
    onToken = () => {},
    onDone = () => {},
    onError = () => {},
    signal
  } = handlers;

  // 始终强制走流式，以匹配逐字打印需求
  const body = JSON.stringify({ ...payload, stream: true });

  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal
    });
  } catch (e) {
    onError(`网络错误：${e?.message || e}`);
    return;
  }

  // 非 2xx 直接读取文本或JSON错误
  if (!res.ok) {
    try {
      const text = await res.text();
      // 尝试解析JSON错误
      try {
        const json = JSON.parse(text);
        if (json && json.error) {
          onError(`后端错误：${json.error}`);
          return;
        }
      } catch {
        // 文本错误
      }
      onError(`HTTP ${res.status}：${text || '请求失败'}`);
    } catch (e) {
      onError(`HTTP ${res.status}：无法读取错误信息`);
    }
    return;
  }

  // 流式读取
  const reader = res.body?.getReader?.();
  if (!reader) {
    // 某些环境下可能未返回流（例如代理干扰），回退一次性读取
    try {
      const fallbackText = await res.text();
      if (fallbackText.includes('[ERROR]')) {
        const idx = fallbackText.indexOf('[ERROR]');
        onError(fallbackText.slice(idx));
        return;
      }
      const doneIdx = fallbackText.indexOf('[DONE]');
      const content = doneIdx >= 0 ? fallbackText.slice(0, doneIdx) : fallbackText;
      if (content) onToken(content);
      onDone();
    } catch (e) {
      onError(`读取响应失败：${e?.message || e}`);
    }
    return;
  }

  const decoder = new TextDecoder('utf-8');
  let done = false;

  while (!done) {
    let result;
    try {
      result = await reader.read();
    } catch (e) {
      onError(`读取流失败：${e?.message || e}`);
      break;
    }
    const { value, done: doneReading } = result || {};
    if (doneReading) break;

    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;

    // 检测错误标记
    const errIdx = chunk.indexOf('[ERROR]');
    if (errIdx >= 0) {
      const errMsg = chunk.slice(errIdx);
      onError(errMsg);
      // 尝试停止进一步读取
      try { await reader.cancel(); } catch {}
      break;
    }

    // 检测结束标记
    const doneIdx = chunk.indexOf('[DONE]');
    if (doneIdx >= 0) {
      const before = chunk.slice(0, doneIdx);
      if (before) onToken(before);
      onDone();
      // 停止读取
      try { await reader.cancel(); } catch {}
      break;
    }

    // 普通内容增量
    onToken(chunk);
  }
}