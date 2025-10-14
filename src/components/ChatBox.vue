<template>
  <div class="chat">
    <div class="messages" ref="scrollEl">
      <div
        v-for="(m, idx) in messages"
        :key="idx"
        class="msg"
        :class="m.role === 'user' ? 'msg-user' : 'msg-assistant'"
      >
        <div class="meta">
          <span class="who">{{ m.role === 'user' ? '你' : '助手' }}</span>
        </div>
        <div class="bubble">
          <pre class="content">{{ m.content }}</pre>
        </div>
      </div>
      <div v-if="errorMsg" class="error">
        <strong>错误：</strong>
        <span>{{ errorMsg }}</span>
      </div>
    </div>

    <form class="input-bar" @submit.prevent="send" @keydown.enter.prevent="send">
      <input
        v-model="inputText"
        class="text"
        type="text"
        name="message"
        placeholder="请输入你的问题..."
        :disabled="sending"
        autocomplete="off"
      />
      <button class="send" type="submit" :disabled="sending || !inputText.trim()">
        {{ sending ? '发送中...' : '发送' }}
      </button>
      <button class="cancel" type="button" v-if="sending" @click="cancel">
        取消
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import { streamChat } from '../api/streamClient.js';

const messages = ref([]);
const inputText = ref('');
const sending = ref(false);
const errorMsg = ref('');

const controller = ref(null);
const scrollEl = ref(null);

function scrollToBottom() {
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

function appendAssistantToken(token) {
  const last = messages.value[messages.value.length - 1];
  if (last && last.role === 'assistant') {
    last.content += token;
  }
}

async function send() {
  const text = inputText.value.trim();
  if (!text || sending.value) return;

  // 清理错误，标记发送中
  errorMsg.value = '';
  sending.value = true;

  // 先追加“你”的消息
  messages.value.push({ role: 'user', content: text });

  // 追加“助手”的占位消息，用于流式填充
  messages.value.push({ role: 'assistant', content: '' });

  // 清空输入
  inputText.value = '';

  // 为本次流创建可取消信号
  controller.value = new AbortController();

  // 确保渲染后滚动到底部
  await nextTick();
  scrollToBottom();

  streamChat(
    { message: text, stream: true },
    {
      onToken: (t) => {
        appendAssistantToken(t);
        scrollToBottom();
      },
      onDone: () => {
        sending.value = false;
        controller.value = null;
        scrollToBottom();
      },
      onError: (msg) => {
        sending.value = false;
        controller.value = null;
        errorMsg.value = msg || '发生未知错误';
        const last = messages.value[messages.value.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          last.content = `【错误】${errorMsg.value}`;
        } else {
          messages.value.push({ role: 'assistant', content: `【错误】${errorMsg.value}` });
        }
        scrollToBottom();
      },
      signal: controller.value?.signal,
    }
  );
}

function cancel() {
  try {
    controller.value?.abort();
  } catch {}
  sending.value = false;
  controller.value = null;
}
</script>

<style>
.chat {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
}

.messages {
  background: var(--panel);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 12px;
  height: calc(100vh - 220px);
  overflow-y: auto;
}

.msg {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}

.msg-user .meta .who {
  color: var(--accent);
}
.msg-assistant .meta .who {
  color: var(--accent2);
}

.meta {
  font-size: 12px;
  margin-bottom: 4px;
  color: var(--muted);
}

.bubble {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 10px 12px;
}

.content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
}

.error {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: var(--danger);
  border-radius: 8px;
  padding: 8px 10px;
  margin-top: 8px;
  font-size: 13px;
}

.input-bar {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.text {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: var(--text);
  outline: none;
}
.text::placeholder {
  color: var(--muted);
}

.send, .cancel {
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: var(--text);
  cursor: pointer;
  height: 40px;
}
.send[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.cancel {
  border-color: rgba(255, 107, 107, 0.3);
  color: var(--danger);
}
</style>