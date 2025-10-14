<template>
  <div class="app">
    <header class="header">
      <h1 class="title">DeepSeek 对话</h1>
      <p class="subtitle">与后端流式接口实时对话</p>
    </header>
    <main class="main">
      <ChatBox />
    </main>
    <footer class="footer">
      <span>前端: Vue3 + Vite · 后端: Flask (流式)</span>
    </footer>
  </div>
</template>

<script setup>
import ChatBox from './components/ChatBox.vue';
</script>

<style>
:root {
  --bg: #0b0c10;
  --panel: #1f2833;
  --text: #c5c6c7;
  --accent: #66fcf1;
  --accent2: #45a29e;
  --danger: #ff6b6b;
  --muted: #9aa0a6;
}

* { box-sizing: border-box; }

html, body, #app {
  height: 100%;
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei",
    "WenQuanYi Micro Hei", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif;
}

.app {
  min-height: 100%;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: linear-gradient(180deg, rgba(102,252,241,0.06), transparent);
}

.title {
  margin: 0;
  font-size: 20px;
  color: var(--accent);
  letter-spacing: 0.5px;
}

.subtitle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.main {
  padding: 10px;
}

.footer {
  padding: 10px 16px;
  font-size: 12px;
  color: var(--muted);
  border-top: 1px solid rgba(255,255,255,0.06);
}
</style>