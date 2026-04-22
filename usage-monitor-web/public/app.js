const refreshButton = document.getElementById("refresh-button");
const summaryCards = document.getElementById("summary-cards");
const configMeta = document.getElementById("config-meta");
const providerGrid = document.getElementById("provider-grid");
const providerCardTemplate = document.getElementById("provider-card-template");

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function formatBooleanValue(value) {
  if (value === true) {
    return "可用";
  }

  if (value === false) {
    return "不可用";
  }

  return "-";
}

function formatBalanceDetails(balanceInfos) {
  if (!Array.isArray(balanceInfos) || balanceInfos.length === 0) {
    return "当前接口未返回更多余额明细。";
  }

  return balanceInfos
    .map((item) => {
      const currency = item.currency ?? "-";
      const total = item.totalBalance ?? "-";
      const granted = item.grantedBalance ?? "-";
      const toppedUp = item.toppedUpBalance ?? "-";
      return `${currency}: 总余额 ${total}, 赠金 ${granted}, 充值 ${toppedUp}`;
    })
    .join(" | ");
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
  fragment.querySelector(".provider-name").textContent = provider.name;
  fragment.querySelector(".provider-model").textContent = provider.model || "未读取到 model";
  fragment.querySelector(".provider-base-url").textContent = provider.baseUrl || "未读取到 base_url";
  fragment.querySelector(".provider-env-file").textContent = provider.envFile || "未找到";
  fragment.querySelector(".provider-source-usage").textContent = formatSource(provider.sources?.usage);
  fragment.querySelector(".provider-source-balance").textContent = formatSource(provider.sources?.balance);

  const chip = fragment.querySelector(".status-chip");
  chip.textContent = statusLabel(provider.status);
  chip.dataset.status = provider.status;

  fragment.querySelector(".metric-usage-total").textContent = formatValue(provider.usage?.metrics?.totalTokens);
  fragment.querySelector(".metric-usage-prompt").textContent = formatValue(provider.usage?.metrics?.promptTokens);
  fragment.querySelector(".metric-usage-completion").textContent = formatValue(provider.usage?.metrics?.completionTokens);
  fragment.querySelector(".metric-usage-request-count").textContent = formatValue(provider.usage?.metrics?.requestCount);
  fragment.querySelector(".metric-usage-updated-at").textContent = formatValue(provider.usage?.metrics?.updatedAt);

  fragment.querySelector(".metric-balance-available").textContent = formatBooleanValue(provider.balance?.metrics?.available);
  fragment.querySelector(".metric-balance-currency").textContent = formatValue(provider.balance?.metrics?.currency);
  fragment.querySelector(".metric-balance-total").textContent = formatValue(provider.balance?.metrics?.totalBalance);
  fragment.querySelector(".metric-balance-granted").textContent = formatValue(provider.balance?.metrics?.grantedBalance);
  fragment.querySelector(".metric-balance-topped-up").textContent = formatValue(provider.balance?.metrics?.toppedUpBalance);
  fragment.querySelector(".metric-balance-entry-count").textContent = formatValue(provider.balance?.metrics?.balanceInfoCount);
  fragment.querySelector(".metric-balance-checked-at").textContent = formatValue(provider.checkedAt);

  const balanceMessage = fragment.querySelector(".balance-message");
  const balanceDetails = fragment.querySelector(".balance-details");

  if (provider.balance?.state === "ok") {
    balanceMessage.textContent = `Balance API 已返回数据，最近检查时间：${provider.checkedAt}`;
    balanceDetails.textContent = `余额明细：${formatBalanceDetails(provider.balance?.metrics?.balanceInfos)}`;
  } else if (provider.balance?.state === "auth_required") {
    balanceMessage.textContent = "Balance API 需要登录态。";
    balanceDetails.textContent = "请先在浏览器里手动登录阿里云，再把登录后的 Cookie 写入 ~/.copilot/qwen.env 的 COPILOT_QWEN_COOKIE，或在 providers.local.json 的 headers 里配置 Cookie。";
  } else if (provider.balance?.state === "no_xhr_found") {
    balanceMessage.textContent = "Balance 接口已请求，但未自动识别到可用的数据入口。";
    balanceDetails.textContent = "这通常说明 Cookie 可用，但页面脚本里的数据接口没有被当前规则命中。你可以把 Network 里看到的 JSON/RPC 接口 URL 补到本地配置，或继续放宽自动识别规则。";
  } else if (provider.balance?.state === "busy") {
    balanceMessage.textContent = "Balance 页面当前繁忙。";
    balanceDetails.textContent = "百炼控制台当前在浏览器里提示“系统繁忙，请刷新页面重试”。先刷新页面或稍后再试，再继续抓取用量/余额。";
  } else if (provider.balance?.state === "error") {
    balanceMessage.textContent = `Balance API 状态：${provider.balance.state}${provider.balance.error ? ` - ${provider.balance.error}` : ""}`;
    balanceDetails.textContent = "Qwen 控制台页面通常需要登录态；如果直接抓取页面失败，请在本地配置中补充 Cookie 或使用可访问的内部数据源。";
  } else {
    balanceMessage.textContent = `Balance API 状态：${provider.balance?.state ?? "unknown"}${provider.balance?.error ? ` - ${provider.balance.error}` : ""}`;
    balanceDetails.textContent = "当前没有可用的余额抓取配置。";
  }

  const usageMessage = fragment.querySelector(".usage-message");
  const usageDetails = fragment.querySelector(".usage-details");

  if (provider.usage?.state === "ok") {
    usageMessage.textContent = `Usage 数据已返回，最近检查时间：${provider.checkedAt}`;
    usageDetails.textContent = `Usage 明细：总 Token ${formatValue(provider.usage?.metrics?.totalTokens)}，输入 ${formatValue(provider.usage?.metrics?.promptTokens)}，输出 ${formatValue(provider.usage?.metrics?.completionTokens)}，请求数 ${formatValue(provider.usage?.metrics?.requestCount)}`;
  } else if (provider.usage?.state === "auth_required") {
    usageMessage.textContent = "Usage API 需要登录态。";
    usageDetails.textContent = "同样需要先完成阿里云手动登录，然后把登录后的 Cookie 提供给本地程序。";
  } else if (provider.usage?.state === "no_xhr_found") {
    usageMessage.textContent = "Usage 接口已请求，但未自动识别到可用的数据入口。";
    usageDetails.textContent = "你现在已经登录成功，接下来要么补接口 URL，要么继续扩展自动识别规则。";
  } else if (provider.usage?.state === "busy") {
    usageMessage.textContent = "Usage 页面当前繁忙。";
    usageDetails.textContent = "百炼控制台当前在浏览器里提示“系统繁忙，请刷新页面重试”。这时页面还没准备好数据入口，刷新后再抓。";
  } else if (provider.usage?.state === "error") {
    usageMessage.textContent = `Usage API 状态：${provider.usage.state}${provider.usage.error ? ` - ${provider.usage.error}` : ""}`;
    usageDetails.textContent = "Qwen 的 usage 统计通常需要控制台监控页或账单页的数据源；如果这里失败，请先确认页面是否可访问或数据源是否已配置。";
  } else {
    usageMessage.textContent = `Usage API 状态：${provider.usage?.state ?? "unknown"}${provider.usage?.error ? ` - ${provider.usage.error}` : ""}`;
    usageDetails.textContent = "当前没有可用的 usage 抓取配置。";
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
