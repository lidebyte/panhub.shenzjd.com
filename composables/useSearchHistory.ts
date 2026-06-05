const STORAGE_KEY = "panhub:search-history";
const MAX_HISTORY = 20;

export function useSearchHistory() {
  const history = useState<string[]>("search-history", () => []);

  function loadHistory() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) history.value = JSON.parse(raw);
    } catch {}
  }

  function addHistory(term: string) {
    const t = term.trim();
    if (!t) return;
    history.value = [t, ...history.value.filter((h) => h !== t)].slice(0, MAX_HISTORY);
    saveHistory();
  }

  function removeHistory(term: string) {
    history.value = history.value.filter((h) => h !== term);
    saveHistory();
  }

  function saveHistory() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value));
    } catch {}
  }

  return { history: readonly(history), loadHistory, addHistory, removeHistory };
}
