const refreshButton = document.getElementById("refresh-button");
const summaryCards = document.getElementById("summary-cards");
const configMeta = document.getElementById("config-meta");
const providerGrid = document.getElementById("provider-grid");
const providerCardTemplate = document.getElementById("provider-card-template");

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return String(value);
  }
  return num.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatSource(source) {
  if (!source?.url) {
    return "未配置";
  }

  const auth = source.authConfigured ? "已登录态" : "未登录态";
  const page = source.preflightUrl && source.preflightUrl !== source.url ? `${source.preflightUrl} -> ` : "";
  const discovery = source.discoveredFrom && source.discoveredFrom !== source.url ? `${source.discoveredFrom} -> ` : "";
  return `${source.responseType ?? "json"} · ${auth} · ${page}${discovery}${source.url}`;
}

function statusLabel(status) {
  switch (status) {
    case "ready":
      return "已连接";
    case "partial":
      return "部分可用";
    case "needs_configuration":
      return "待配置";
    case "auth_required":
      return "需登录";
    case "busy":
      return "页面繁忙";
    case "no_xhr_found":
      return "未识别入口";
    case "disabled":
      return "已禁用";
    default:
      return "未知";
  }
}

function createSummaryCard(label, value) {
  const card = document.createElement("article");
  card.className = "summary-card";
  card.innerHTML = `<p>${label}</p><strong>${value}</strong>`;
  return card;
}

function renderSummary(snapshot) {
  const total = snapshot.providers.length;
  const ready = snapshot.providers.filter((provider) => provider.status === "ready").length;
  const partial = snapshot.providers.filter((provider) => provider.status === "partial").length;
  const pending = snapshot.providers.filter((provider) => provider.status === "needs_configuration").length;
  const authRequired = snapshot.providers.filter((provider) => provider.status === "auth_required").length;
  const busy = snapshot.providers.filter((provider) => provider.status === "busy").length;

  summaryCards.innerHTML = "";
  summaryCards.append(
    createSummaryCard("Provider 总数", total),
    createSummaryCard("已连接", ready),
    createSummaryCard("部分可用", partial),
    createSummaryCard("待配置", pending),
    createSummaryCard("需登录", authRequired),
    createSummaryCard("页面繁忙", busy)
  );
}

function renderConfigMeta(snapshot) {
  const list = document.createElement("ul");
  list.innerHTML = `
    <li><strong>当前配置:</strong> ${formatValue(snapshot.configPath)}</li>
    <li><strong>当前系统:</strong> ${formatValue(snapshot.platformLabel)}</li>
    <li><strong>轮询间隔:</strong> ${snapshot.pollingIntervalMs} ms</li>
    <li><strong>最近快照:</strong> ${formatValue(snapshot.generatedAt)}</li>
    <li><strong>候选配置路径:</strong> ${snapshot.candidatePaths.map((item) => `<code>${item}</code>`).join("，") || "-"}</li>
  `;
  configMeta.innerHTML = "";
  configMeta.appendChild(list);
}

function renderProviderCard(provider) {
  const fragment = providerCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".provider-card");
  if (provider.id === "deepseek") {
    card.classList.add("is-deepseek");
  }
  fragment.querySelector(".provider-name").textContent = provider.name;
  fragment.querySelector(".provider-model").textContent = provider.model || "未读取到 model";
  fragment.querySelector(".provider-base-url").textContent = provider.baseUrl || "未读取到 base_url";
  fragment.querySelector(".provider-env-file").textContent = provider.envFile || "未找到";
  fragment.querySelector(".provider-source-usage").textContent = formatSource(provider.sources?.usage);
  fragment.querySelector(".provider-checked-at").textContent = formatValue(provider.checkedAt);

  const chip = fragment.querySelector(".status-chip");
  chip.textContent = statusLabel(provider.status);
  chip.dataset.status = provider.status;

  fragment.querySelector(".metric-usage-total").textContent = formatValue(provider.usage?.metrics?.totalTokens);
  fragment.querySelector(".metric-usage-prompt").textContent = formatValue(provider.usage?.metrics?.promptTokens);
  fragment.querySelector(".metric-usage-completion").textContent = formatValue(provider.usage?.metrics?.completionTokens);
  fragment.querySelector(".metric-usage-request-count").textContent = formatValue(provider.usage?.metrics?.requestCount);
  fragment.querySelector(".metric-usage-updated-at").textContent = formatValue(provider.usage?.metrics?.updatedAt);

  const usageMessage = fragment.querySelector(".usage-message");
  const usageDetails = fragment.querySelector(".usage-details");

  if (provider.usage?.state === "ok") {
    usageMessage.textContent = `Usage 数据已返回，最近检查时间：${provider.checkedAt}`;
    usageDetails.textContent = `Usage 明细：总 Token ${formatValue(provider.usage?.metrics?.totalTokens)}，输入 ${formatValue(provider.usage?.metrics?.promptTokens)}，输出 ${formatValue(provider.usage?.metrics?.completionTokens)}，请求数 ${formatValue(provider.usage?.metrics?.requestCount)}`;
  } else if (provider.usage?.state === "auth_required") {
    usageMessage.textContent = "Usage API 需要登录态。";
    const fallback = "请把 DeepSeek 登录后的 Cookie 写入 ~/.copilot/deepseek.env 的 COPILOT_DEEPSEEK_COOKIE（或 COPILOT_PROVIDER_COOKIE）。";
    usageDetails.textContent = provider.usage?.error || fallback;
  } else if (provider.usage?.state === "no_xhr_found") {
    usageMessage.textContent = "Usage 接口已请求，但未自动识别到可用的数据入口。";
    usageDetails.textContent = "你现在已经登录成功，接下来要么补接口 URL，要么继续扩展自动识别规则。";
  } else if (provider.usage?.state === "busy") {
    usageMessage.textContent = "Usage 页面当前繁忙。";
    usageDetails.textContent = "页面当前繁忙，请刷新页面重试。";
  } else if (provider.usage?.state === "error") {
    usageMessage.textContent = `Usage API 状态：${provider.usage.state}${provider.usage.error ? ` - ${provider.usage.error}` : ""}`;
    usageDetails.textContent = "DeepSeek usage 报错时，请先确认 usageApi 配置是否启用，以及 API Key/Cookie 是否仍然有效。";
  } else {
    usageMessage.textContent = `Usage API 状态：${provider.usage?.state ?? "unknown"}${provider.usage?.error ? ` - ${provider.usage.error}` : ""}`;
    usageDetails.textContent = "当前没有可用的 usage 抓取配置。";
  }

  if (provider.id === "deepseek") {
    const deepseek = provider.usage?.metrics?.deepseek;
    const summary = deepseek?.summary ?? {};
    fragment.querySelector(".deepseek-kpi-recharge").textContent = formatNumber(summary.rechargeBalance, 4);
    fragment.querySelector(".deepseek-kpi-cost").textContent = formatNumber(summary.monthlyCost, 6);
    fragment.querySelector(".deepseek-kpi-monthly-usage").textContent = formatNumber(summary.monthlyTokenUsage, 0);
    fragment.querySelector(".deepseek-kpi-total-token").textContent = formatNumber(summary.totalAvailableTokenEstimation, 0);

    const daily = Array.isArray(deepseek?.daily) ? deepseek.daily : [];
    const requestRows = buildFullMonthRows(deepseek?.period, daily, "requests");
    const tokenRows = buildFullMonthRows(deepseek?.period, daily, "tokens");

    fragment.querySelector(".chart-requests").appendChild(createChartRows(requestRows));
    fragment.querySelector(".chart-tokens").appendChild(createChartRows(tokenRows));
    usageMessage.textContent = "";
    usageDetails.textContent = "";
  }

  const warningList = fragment.querySelector(".warning-list");
  warningList.innerHTML = "";
  for (const warning of provider.warnings ?? []) {
    const item = document.createElement("li");
    item.textContent = warning;
    warningList.appendChild(item);
  }

  return fragment;
}

function buildFullMonthRows(period, daily, key) {
  const year = Number(period?.year);
  const month = Number(period?.month);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return (daily ?? []).map((item) => ({
      label: item.date?.slice(5) ?? "-",
      value: Number(item?.[key] ?? 0)
    }));
  }

  const byDate = new Map(
    (daily ?? []).map((item) => [String(item.date ?? ""), Number(item?.[key] ?? 0)])
  );
  const lastDay = new Date(year, month, 0).getDate();
  const rows = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    rows.push({
      label: `${month}/${day}`,
      value: byDate.get(date) ?? 0
    });
  }

  return rows;
}

function createChartRows(rows) {
  const container = document.createElement("div");
  container.className = "chart-rows";
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.textContent = "暂无数据";
    container.appendChild(empty);
    return container;
  }

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "chart-row";
    const percent = Math.max(0, Math.min(100, (row.value / max) * 100));
    const visiblePercent = row.value > 0 ? Math.max(2, percent) : 0;
    item.innerHTML = `
      <span>${row.label}</span>
      <span class="chart-bar-wrap"><span class="chart-bar" style="width:${visiblePercent}%"></span></span>
      <span>${formatNumber(row.value, 0)}</span>
    `;
    container.appendChild(item);
  }

  return container;
}

function renderProviders(snapshot) {
  providerGrid.innerHTML = "";
  for (const provider of snapshot.providers) {
    providerGrid.appendChild(renderProviderCard(provider));
  }
}

async function loadSnapshot(forceRefresh = false) {
  const response = await fetch(`/api/snapshot${forceRefresh ? "?refresh=1" : ""}`);
  if (!response.ok) {
    throw new Error(`加载快照失败: ${response.status}`);
  }

  const snapshot = await response.json();
  renderSummary(snapshot);
  renderConfigMeta(snapshot);
  renderProviders(snapshot);
}

refreshButton.addEventListener("click", () => {
  loadSnapshot(true).catch((error) => {
    window.alert(error.message);
  });
});

loadSnapshot().catch((error) => {
  configMeta.textContent = error.message;
});

setInterval(() => {
  loadSnapshot().catch(() => {});
}, 15000);
