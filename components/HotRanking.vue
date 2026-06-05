<template>
  <div v-if="!loading && items.length > 0" class="hot-ranking">
    <h3 class="hot-ranking__title">🔥 热搜排行</h3>
    <ol class="hot-ranking__list">
      <li
        v-for="item in items"
        :key="item.term"
        class="hot-ranking__item"
        @click="$emit('search', item.term)">
        <span class="hot-ranking__rank" :class="{ 'hot-ranking__rank--top': item.rank <= 3 }">
          {{ item.rank <= 3 ? '🔥' : item.rank }}
        </span>
        <span class="hot-ranking__term">{{ item.term }}</span>
        <span class="hot-ranking__bar-wrap">
          <span class="hot-ranking__bar" :style="{ width: item.heatPercent + '%' }"></span>
        </span>
        <span class="hot-ranking__count">{{ item.score }}次</span>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface RankingItem {
  term: string;
  score: number;
  rank: number;
  displayScore: number;
  heatPercent: number;
}

defineEmits<{
  search: [term: string];
}>();

const loading = ref(false);
const items = ref<RankingItem[]>([]);

async function fetchRanking() {
  loading.value = true;
  try {
    const response = await fetch("/api/hot-searches?limit=10");
    const data = await response.json();
    if (data.code === 0 && data.data?.hotSearches) {
      items.value = data.data.hotSearches;
    }
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchRanking);

defineExpose({ refresh: fetchRanking });
</script>

<style scoped>
.hot-ranking {
  padding: 0 16px 16px;
}

.hot-ranking__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.hot-ranking__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.hot-ranking__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-radius: 6px;
}

.hot-ranking__item:hover {
  background: var(--bg-hover);
}

.hot-ranking__rank {
  width: 24px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-tertiary);
  text-align: center;
  flex-shrink: 0;
}

.hot-ranking__rank--top {
  font-size: 14px;
}

.hot-ranking__term {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-ranking__bar-wrap {
  width: 60px;
  height: 4px;
  background: var(--bg-secondary);
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}

.hot-ranking__bar {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.hot-ranking__count {
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  min-width: 32px;
  text-align: right;
}
</style>
